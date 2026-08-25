"""
HPI — /api/ai-recommend
Unified AI Workout Recommendation endpoint.
Uses real user data (history, fatigue, injuries, goals) + Groq LLM to generate
a deeply personalized workout plan. Falls back to AI-only if data is sparse.
"""
import os
import json
import logging
from pathlib import Path
from typing import Optional, List

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

load_dotenv(Path(__file__).parent.parent / ".env", override=False)

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from database import get_db
from routes.auth import get_current_user_id

log = logging.getLogger("hpi.ai-recommend")
router = APIRouter(prefix="/ai-recommend", tags=["AI Recommend"])


COACH_BACKSTORY = """You are Coach Rurik Anders, an AI fitness recommender coach.

WHO YOU ARE
You spent your first six years coaching in the cardiac rehab wing of a public
hospital, not a commercial gym. Your clients were 55-to-70-year-olds with
stents and A1c numbers their doctors were watching closely, and you learned
fast that "just move more" is not a program — it's a way to lose someone's
trust the first time it goes wrong. You moved into general strength coaching
later, but the rehab instinct never left: read the whole person before you
write a single set. A profile isn't a template lookup, it's a set of
constraints you design inside of.

You are not a doctor and you never diagnose. You are the coach who asks the
second question instead of assuming the first answer is the whole picture —
which is exactly why a flat "yes" on a health field isn't enough for you and
you factor in whatever detail you're given.

HOW YOU THINK ABOUT SEX-BASED DIFFERENCES
You program from evidence, not stereotype, and you hold both of these at once:
- On average, women have a higher relative risk of ACL injury in cutting,
  pivoting, and landing movements, linked to hip-to-knee (Q-angle) alignment,
  neuromuscular landing patterns, and hormonal effects on ligament laxity
  across the menstrual cycle. Your response isn't to avoid jump training —
  it's to front-load landing mechanics, control eccentric loading, and
  progress plyometric volume more gradually than you would for a lifter
  without that risk profile.
- Bone density declines faster in women after menopause, so your answer is
  more progressive loaded resistance training over time, not less — axial
  loading is one of the best tools for bone density, dosed correctly.
- Pregnancy and postpartum status change the plan directly, when disclosed:
  no heavy Valsalva holds, no supine heavy loading past the point it's
  contraindicated, conservative impact work, and a standing recommendation to
  clear any new program with their doctor or a pelvic-floor specialist.
- None of this is a ceiling on what a woman can train for. It's the same
  respect you'd give any lifter's actual physiology instead of running
  identical programming for everyone and hoping nothing goes wrong.

HOW YOU HANDLE DISCLOSED CONDITIONS
- Hypertension changes exercise SELECTION, not just intensity. Max-effort
  isometric holds and heavy 1-3 rep singles that require breath-holding spike
  systolic pressure hard — you avoid prescribing them. You favor continuous,
  moderate-intensity work, steer clear of strict inversions and sustained
  overhead isometric holds, and progress load gradually rather than front-
  loading heavy compound maxes in week one.
- Diabetes changes exercise TIMING and monitoring, not just movement choice.
  You avoid programming long fasted high-intensity sessions, you always note
  that the person should keep a fast-acting carb source nearby during
  training, and you flag the signs of hypoglycemia (shakiness, sudden
  fatigue, confusion, cold sweat) as a reason to stop and check blood sugar
  mid-session, not push through.
- If a condition is marked "Yes" or comes with a free-text detail, you factor
  it into which exercises you select — not a generic disclaimer bolted onto
  an unchanged plan — and you add exactly one short, concrete safety note. If
  it's "No", you don't manufacture a note out of nothing.
- You never diagnose, and you always recommend clearing a new program with a
  doctor when any condition is disclosed. That's a standing line, not a
  hedge.

HOW YOU WRITE A PLAN
You build around the person's stated experience level, primary goal, and
days-per-week availability first — the health flags shape what's inside the
plan, they don't override the goal. A beginner gets movement competency and
conservative volume; an advanced lifter gets real loading and less hand-
holding. You write like a coach talking to one specific person, not a
brochure.

- Never give medical diagnoses; recommend clearing new programs with a doctor when a condition is disclosed.

Output ONLY valid JSON matching: { splitName, weeklySummary, days: [{ day, focus, exercises: [{ name, sets, reps, rest }] }], safetyNote, coachNote }."""


class AIRecommendPayload(BaseModel):
    goal: str = "muscle_gain"          # muscle_gain | strength | fat_loss | general_fitness
    experience: str = "intermediate"   # beginner | intermediate | advanced
    days_available: int = 4
    gender: str = "Male"
    age: Optional[int] = None
    injuries: Optional[List[str]] = []
    extra_notes: Optional[str] = ""
    hypertension: Optional[str] = "No"
    diabetes: Optional[str] = "No"
    other_illness: Optional[str] = "No"
    system: Optional[str] = None


def fetch_user_context(user_id: int, db) -> dict:
    """Pull relevant user data from DB to build AI context."""
    cursor = db.cursor()
    ctx = {}

    # 1. Last 10 sessions with volume
    try:
        cursor.execute("""
            SELECT w.workout_name, w.session_date,
                   COALESCE(SUM(s.weight_kg * s.reps), 0) AS volume
            FROM workouts w
            LEFT JOIN sets s ON s.workout_id = w.id
            WHERE w.user_id = %s
            GROUP BY w.id, w.workout_name, w.session_date
            ORDER BY w.session_date DESC LIMIT 10
        """, (user_id,))
        ctx["recent_sessions"] = cursor.fetchall() or []
    except Exception as e:
        log.warning(f"Error fetching recent sessions: {e}")
        try: db.rollback()
        except Exception: pass

    # 2. Most trained muscle groups (top 5)
    try:
        cursor.execute("""
            SELECT ex.muscle_group, COUNT(*) as freq
            FROM sets s
            JOIN workouts w ON w.id = s.workout_id
            JOIN exercises ex ON ex.id = s.exercise_id
            WHERE w.user_id = %s AND ex.muscle_group IS NOT NULL AND ex.muscle_group != ''
            GROUP BY ex.muscle_group ORDER BY freq DESC LIMIT 5
        """, (user_id,))
        ctx["top_muscles"] = [r["muscle_group"] for r in (cursor.fetchall() or [])]
    except Exception as e:
        log.warning(f"Error fetching top muscles: {e}")
        try: db.rollback()
        except Exception: pass

    # 3. Latest fatigue check
    try:
        cursor.execute("""
            SELECT label, borg_score FROM fatigue_checks
            WHERE user_id = %s ORDER BY logged_at DESC LIMIT 1
        """, (user_id,))
        ctx["latest_fatigue"] = cursor.fetchone()
    except Exception as e:
        log.warning(f"Error fetching fatigue checks: {e}")
        try: db.rollback()
        except Exception: pass

    # 4. Active injuries
    try:
        cursor.execute("""
            SELECT body_part, severity FROM injuries
            WHERE user_id = %s AND status = 'active'
        """, (user_id,))
        ctx["active_injuries"] = cursor.fetchall() or []
    except Exception as e:
        log.warning(f"Error fetching active injuries: {e}")
        try: db.rollback()
        except Exception: pass

    # 5. Total sessions & streak
    try:
        cursor.execute("""
            SELECT COUNT(*) as total,
                   MAX(session_date) as last_session
            FROM workouts WHERE user_id = %s
        """, (user_id,))
        ctx["stats"] = cursor.fetchone()
    except Exception as e:
        log.warning(f"Error fetching stats: {e}")
        try: db.rollback()
        except Exception: pass
    finally:
        cursor.close()

    return ctx


def build_prompt(payload: AIRecommendPayload, ctx: dict) -> str:
    sessions = ctx.get("recent_sessions", [])
    top_muscles = ctx.get("top_muscles", [])
    fatigue = ctx.get("latest_fatigue")
    injuries = ctx.get("active_injuries", [])
    stats = ctx.get("stats")

    data_summary = ""

    if sessions:
        session_lines = "\n".join(
            f"  - {s['session_date']}: {s['workout_name']} ({int(s['volume'])}kg volume)"
            for s in sessions[:6]
        )
        data_summary += f"\nRecent training history:\n{session_lines}"

    if top_muscles:
        data_summary += f"\nMost trained muscle groups: {', '.join(top_muscles)}"

    if fatigue:
        data_summary += f"\nLatest fatigue check: {fatigue['label']} (Borg {fatigue['borg_score']}/20)"

    if injuries:
        inj_lines = ", ".join(f"{i['body_part']} (severity {i['severity']}/10)" for i in injuries)
        data_summary += f"\nActive injuries: {inj_lines}"

    if stats and stats["total"]:
        data_summary += f"\nTotal sessions logged: {stats['total']}"

    has_data = bool(sessions or top_muscles or injuries)

    base = (
        f"You are Coach Rurik, an elite AI fitness coach inside the Hpi app. "
        f"Generate a detailed, personalized {payload.days_available}-day/week workout plan.\n\n"
        f"USER PROFILE:\n"
        f"- Goal: {payload.goal.replace('_', ' ').title()}\n"
        f"- Experience: {payload.experience.title()}\n"
        f"- Gender: {payload.gender}\n"
    )
    if payload.age:
        base += f"- Age: {payload.age}\n"
    if payload.hypertension:
        base += f"- Hypertension: {payload.hypertension}\n"
    if payload.diabetes:
        base += f"- Diabetes: {payload.diabetes}\n"
    if payload.other_illness and payload.other_illness != "No":
        base += f"- Other Condition/Illness: {payload.other_illness}\n"
    if payload.injuries:
        base += f"- Self-reported limitations: {', '.join(payload.injuries)}\n"
    if payload.extra_notes:
        base += f"- Additional notes: {payload.extra_notes}\n"

    if has_data:
        base += f"\nTRAINING DATA FROM APP:{data_summary}\n"
        base += "\nUse this real training data to identify weaknesses, overworked muscles, recovery needs, and progression opportunities.\n"
    else:
        base += "\nNo training history available yet — generate a smart plan based purely on the profile.\n"

    base += f"""
RESPOND IN VALID JSON ONLY (no markdown, no extra text).
You may respond with JSON matching:
{{
  "splitName": "string",
  "weeklySummary": "string",
  "days": [
    {{
      "day": "Monday",
      "focus": "string",
      "exercises": [
        {{"name": "string", "sets": 3, "reps": "8-12", "rest": 60}}
      ]
    }}
  ],
  "safetyNote": "string",
  "coachNote": "string"
}}
or with standard plan_name / split_type / summary / sessions keys.

CRITICAL CONSTRAINTS:
1. The schedule MUST have exactly {payload.days_available} workout days.
2. If hypertension or diabetes is 'Yes' or has free-text detail, factor it into exercise selection and add one short safety note. If 'No', skip the note.
"""
    return base


@router.post("/")
async def ai_recommend(
    payload: AIRecommendPayload,
    user_id: int = Depends(get_current_user_id),
    db=Depends(get_db),
):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured.")

    # 1. Pull user context from DB
    ctx = fetch_user_context(user_id, db)

    # 2. Build the prompt
    prompt = build_prompt(payload, ctx)

    # 3. Call Groq
    try:
        from groq import Groq
        client = Groq(api_key=api_key)
        system_prompt = payload.system if payload.system else COACH_BACKSTORY
        from services.llm_service import create_groq_chat_completion
        model_name = os.getenv("GROQ_CHAT_MODEL", "llama-3.3-70b-versatile")
        completion = create_groq_chat_completion(
            client=client,
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
            max_tokens=2500,
        )
        raw = completion.choices[0].message.content.strip()

        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        if raw.endswith("```"):
            raw = raw[:-3]

        plan = json.loads(raw.strip())

        # Normalize schema for complete compatibility across UI fields
        if "splitName" in plan and "plan_name" not in plan:
            plan["plan_name"] = plan["splitName"]
        if "splitName" in plan and "split_type" not in plan:
            plan["split_type"] = plan["splitName"]
        if "weeklySummary" in plan and "summary" not in plan:
            plan["summary"] = plan["weeklySummary"]

        coaching_notes = plan.get("coaching_notes", [])
        if not isinstance(coaching_notes, list):
            coaching_notes = [str(coaching_notes)]
        if plan.get("coachNote"):
            coaching_notes.append(plan["coachNote"])
        if plan.get("safetyNote"):
            coaching_notes.append(f"Safety Note: {plan['safetyNote']}")
        plan["coaching_notes"] = coaching_notes

        # Convert `days` array to `sessions` and `weekly_schedule` if `days` is returned
        from services.exercise_service import get_exercise_by_id_or_name

        if "days" in plan and ("sessions" not in plan or not plan["sessions"]):
            sessions = []
            weekly_schedule = {
                "Monday": "Rest", "Tuesday": "Rest", "Wednesday": "Rest",
                "Thursday": "Rest", "Friday": "Rest", "Saturday": "Rest", "Sunday": "Rest"
            }
            standard_days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            
            for idx, d in enumerate(plan.get("days", [])):
                day_name = d.get("day", f"Day {idx+1}")
                focus = d.get("focus", "Workout")
                session_label = f"{day_name} — {focus}" if day_name else focus
                
                ex_list = []
                for ex in d.get("exercises", []):
                    rest_val = ex.get("rest", 60)
                    if isinstance(rest_val, str):
                        rest_clean = int("".join(filter(str.isdigit, rest_val)) or "60")
                    else:
                        rest_clean = int(rest_val)
                    raw_name = ex.get("name", "")
                    matched_ex = get_exercise_by_id_or_name(db, raw_name) if raw_name else None
                    resolved_name = matched_ex["name"] if matched_ex and matched_ex.get("name") else raw_name

                    ex_list.append({
                        "name": resolved_name,
                        "sets": ex.get("sets", 3),
                        "reps": str(ex.get("reps", "8-12")),
                        "rest_sec": rest_clean,
                        "notes": ""
                    })

                sessions.append({
                    "label": session_label,
                    "focus": focus,
                    "exercises": ex_list
                })

                mapped_day = None
                for std_day in standard_days:
                    if std_day.lower() in day_name.lower():
                        mapped_day = std_day
                        break
                if mapped_day:
                    weekly_schedule[mapped_day] = session_label
                elif idx < len(standard_days):
                    weekly_schedule[standard_days[idx]] = session_label

            plan["sessions"] = sessions
            plan["weekly_schedule"] = weekly_schedule
        elif "sessions" in plan:
            # Also resolve exercise names if plan has sessions key
            for session in plan.get("sessions", []):
                for ex in session.get("exercises", []):
                    raw_name = ex.get("name", "")
                    matched_ex = get_exercise_by_id_or_name(db, raw_name) if raw_name else None
                    if matched_ex and matched_ex.get("name"):
                        ex["name"] = matched_ex["name"]

        if "plan_name" in plan and "splitName" not in plan:
            plan["splitName"] = plan["plan_name"]
        if "summary" in plan and "weeklySummary" not in plan:
            plan["weeklySummary"] = plan["summary"]

        plan["data_used"] = bool(ctx.get("recent_sessions"))
        plan["fatigue_level"] = ctx["latest_fatigue"]["label"] if ctx.get("latest_fatigue") else None
        return plan

    except json.JSONDecodeError as e:
        log.error(f"JSON parse error from Groq: {e}")
        raise HTTPException(status_code=500, detail="AI returned malformed response. Try again.")
    except Exception as e:
        log.error(f"Groq error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

