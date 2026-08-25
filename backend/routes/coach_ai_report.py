import os
import json
import logging
from pathlib import Path
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env", override=False)

from database import get_db
from routes.auth import get_current_user_id

log = logging.getLogger("hpi.coach-ai-report")
router = APIRouter(prefix="", tags=["Coach AI Report Agent"])

class AIReportReq(BaseModel):
    prompt: Optional[str] = ""
    preset_token: Optional[str] = None
    coach_feedback: Optional[str] = None
    previous_report: Optional[str] = None

BACKSTORY_PATH = Path(__file__).parent / "AI_Athlete_Coach_v2.md"
if BACKSTORY_PATH.exists():
    SYSTEM_BACKSTORY = BACKSTORY_PATH.read_text(encoding="utf-8")
else:
    SYSTEM_BACKSTORY = """You are an expert AI Performance Coach responsible for analyzing an athlete's training, nutrition, sleep, recovery, and injury data.

Your job is NOT simply to summarize the data. Your job is to determine whether the data is reliable enough to support a coaching conclusion, identify meaningful patterns, and provide practical recommendations.

You must behave like a skeptical human coach: DO NOT blindly trust the numbers you receive.
"""

def perform_data_quality_audit(ctx: dict, analysis_window_days: int = 14) -> dict:
    workouts = ctx.get("recent_workouts", [])
    nutrition = ctx.get("nutrition_logs", [])
    sleep = ctx.get("sleep_logs", [])
    injuries = ctx.get("active_injuries", [])

    # 1. Training (Unique Session Dates)
    unique_workout_dates = set(str(w.get("session_date"))[:10] for w in workouts if w.get("session_date"))
    logged_workout_days = len(unique_workout_dates)
    workout_coverage_pct = round((logged_workout_days / analysis_window_days) * 100) if analysis_window_days > 0 else 0

    if logged_workout_days == 0:
        workout_reliability = "NO DATA"
    elif workout_coverage_pct >= 70:
        workout_reliability = "HIGH"
    elif workout_coverage_pct >= 40:
        workout_reliability = "MODERATE"
    else:
        workout_reliability = "LOW"

    # 2. Nutrition (Unique Dates + Calories Verification)
    unique_nutrition_dates = set(str(n.get("date"))[:10] for n in nutrition if n.get("date"))
    logged_nutrition_days = len(unique_nutrition_dates)
    nutrition_coverage_pct = round((logged_nutrition_days / analysis_window_days) * 100) if analysis_window_days > 0 else 0
    
    total_logged_calories = sum(float(n.get("calories", 0) or 0) for n in nutrition)
    avg_recorded_calories = round(total_logged_calories / logged_nutrition_days) if logged_nutrition_days > 0 else 0
    
    # Flag suspicious calories (e.g. < 800 kcal/day or > 6000 kcal/day average across window)
    suspicious_calories = (logged_nutrition_days > 0 and (avg_recorded_calories < 800 or avg_recorded_calories > 6000))
    incomplete_nutrition_logging = (nutrition_coverage_pct < 60) or suspicious_calories

    if logged_nutrition_days == 0:
        nutrition_reliability = "NO DATA"
    elif incomplete_nutrition_logging or nutrition_coverage_pct < 40:
        nutrition_reliability = "LOW"
    elif nutrition_coverage_pct >= 70:
        nutrition_reliability = "HIGH"
    else:
        nutrition_reliability = "MODERATE"

    # 3. Sleep (Unique Dates)
    unique_sleep_dates = set(str(s.get("date"))[:10] for s in sleep if s.get("date"))
    logged_sleep_days = len(unique_sleep_dates)
    sleep_coverage_pct = round((logged_sleep_days / analysis_window_days) * 100) if analysis_window_days > 0 else 0
    avg_recorded_sleep = round(sum(float(s.get("hours", 0) or 0) for s in sleep) / logged_sleep_days, 1) if logged_sleep_days > 0 else 0

    if logged_sleep_days == 0:
        sleep_reliability = "NO DATA"
    elif sleep_coverage_pct >= 70:
        sleep_reliability = "HIGH"
    elif sleep_coverage_pct >= 40:
        sleep_reliability = "MODERATE"
    else:
        sleep_reliability = "LOW"

    # 4. Injuries
    active_injury_count = len(injuries)
    injury_reliability = "HIGH" if active_injury_count > 0 else "HIGH (None Logged)"

    # 5. Overall Confidence
    reliabilities = [workout_reliability, nutrition_reliability, sleep_reliability]
    low_count = reliabilities.count("LOW") + reliabilities.count("NO DATA")
    if low_count >= 2:
        overall_confidence = "LOW"
    elif low_count == 1:
        overall_confidence = "MODERATE"
    else:
        overall_confidence = "HIGH"

    return {
        "analysis_window_days": analysis_window_days,
        "training": {
            "expected_days": analysis_window_days,
            "logged_unique_days": logged_workout_days,
            "total_records": len(workouts),
            "coverage_pct": workout_coverage_pct,
            "reliability": workout_reliability
        },
        "nutrition": {
            "expected_days": analysis_window_days,
            "logged_unique_days": logged_nutrition_days,
            "total_records": len(nutrition),
            "coverage_pct": nutrition_coverage_pct,
            "recorded_avg_calories": avg_recorded_calories,
            "suspicious_calories": suspicious_calories,
            "incomplete_logging": incomplete_nutrition_logging,
            "reliability": nutrition_reliability
        },
        "sleep": {
            "expected_days": analysis_window_days,
            "logged_unique_days": logged_sleep_days,
            "total_records": len(sleep),
            "coverage_pct": sleep_coverage_pct,
            "recorded_avg_sleep_hrs": avg_recorded_sleep,
            "reliability": sleep_reliability
        },
        "injuries": {
            "active_records": active_injury_count,
            "reliability": injury_reliability
        },
        "overall_confidence": overall_confidence
    }

def verify_coach_and_athlete(coach_id: int, athlete_id: int, cur):
    cur.execute("SELECT role FROM users WHERE id = %s", (coach_id,))
    usr = cur.fetchone()
    if not usr or usr['role'] != 'coach':
        raise HTTPException(status_code=403, detail="Only coaches can generate AI reports.")

    cur.execute("""
        SELECT id FROM coach_relationships
        WHERE coach_id = %s AND athlete_id = %s AND status = 'active'
    """, (coach_id, athlete_id))
    if not cur.fetchone():
        raise HTTPException(status_code=403, detail="Athlete is not active on your roster.")

def fetch_athlete_full_context(athlete_id: int, coach_id: int, cur) -> dict:
    ctx = {}

    # 1. Profile
    cur.execute("""
        SELECT id, name, email, avatar_url, bodyweight, sex, age, height_cm, experience, goal
        FROM users WHERE id = %s
    """, (athlete_id,))
    ctx["profile"] = cur.fetchone() or {}

    # 2. Workouts (Last 30 days)
    cur.execute("""
        SELECT w.id, w.workout_name, w.session_date, w.duration_sec, w.notes,
               COALESCE(SUM(s.weight_kg * s.reps), 0) AS total_volume,
               COUNT(DISTINCT s.exercise_id) AS total_exercises,
               COUNT(s.id) AS total_sets
        FROM workouts w
        LEFT JOIN sets s ON s.workout_id = w.id
        WHERE w.user_id = %s
        GROUP BY w.id, w.workout_name, w.session_date, w.duration_sec, w.notes
        ORDER BY w.session_date DESC LIMIT 15
    """, (athlete_id,))
    ctx["recent_workouts"] = cur.fetchall() or []

    # 3. Top PRs / Set loads
    cur.execute("""
        SELECT e.name as exercise_name, MAX(s.weight_kg) as max_weight, MAX(s.one_rm_est) as top_est_1rm
        FROM sets s
        JOIN workouts w ON s.workout_id = w.id
        JOIN exercises e ON s.exercise_id = e.id
        WHERE w.user_id = %s AND s.weight_kg > 0
        GROUP BY e.name
        ORDER BY max_weight DESC LIMIT 10
    """, (athlete_id,))
    ctx["prs"] = cur.fetchall() or []

    # 4. Nutrition logs (Last 14 days)
    cur.execute("""
        SELECT date::text, calories, protein_g, carbs_g, fat_g
        FROM nutrition_logs
        WHERE user_id = %s
        ORDER BY date DESC LIMIT 14
    """, (athlete_id,))
    ctx["nutrition_logs"] = cur.fetchall() or []

    # Target
    cur.execute("""
        SELECT final_calories, final_protein, final_carbs, final_fat, goal
        FROM nutrition_targets
        WHERE user_id = %s
        ORDER BY created_at DESC LIMIT 1
    """, (athlete_id,))
    ctx["nutrition_target"] = cur.fetchone() or {}

    # 5. Sleep logs (Last 14 days)
    cur.execute("""
        SELECT date::text, hours, quality, notes
        FROM sleep_logs
        WHERE user_id = %s
        ORDER BY date DESC LIMIT 14
    """, (athlete_id,))
    ctx["sleep_logs"] = cur.fetchall() or []

    # 6. Active Injuries
    cur.execute("""
        SELECT body_part, severity, description, status, start_date::text
        FROM injury_logs
        WHERE user_id = %s AND status = 'active'
        ORDER BY start_date DESC
    """, (athlete_id,))
    ctx["active_injuries"] = cur.fetchall() or []

    # 7. Recent Coach Notes & Directives
    cur.execute("""
        SELECT note, created_at::text
        FROM coach_notes
        WHERE athlete_id = %s AND coach_id = %s
        ORDER BY created_at DESC LIMIT 10
    """, (athlete_id, coach_id))
    ctx["coach_notes"] = cur.fetchall() or []

    return ctx

def build_report_prompt(athlete_name: str, payload: AIReportReq, ctx: dict) -> str:
    profile = ctx.get("profile", {})
    workouts = ctx.get("recent_workouts", [])
    nutrition = ctx.get("nutrition_logs", [])
    target = ctx.get("nutrition_target", {})
    sleep = ctx.get("sleep_logs", [])
    injuries = ctx.get("active_injuries", [])
    prs = ctx.get("prs", [])
    notes = ctx.get("coach_notes", [])

    # Compute authoritative Pre-LLM Data Quality Audit
    audit = perform_data_quality_audit(ctx, analysis_window_days=14)

    total_vol = sum(w.get("total_volume", 0) for w in workouts)
    avg_sleep = audit["sleep"]["recorded_avg_sleep_hrs"]
    avg_cal = audit["nutrition"]["recorded_avg_calories"]

    prompt_text = payload.prompt.strip() if payload.prompt else ""
    if payload.preset_token:
        prompt_text = f"[{payload.preset_token}] {prompt_text}"

    user_msg = f"""
You are acting as Head Strength & Conditioning Coach and Lead Sports Scientist analyzing athlete data.

ATHLETE PROFILE:
- Name: {profile.get('name', athlete_name)}
- Age: {profile.get('age', 'N/A')}, Gender: {profile.get('sex', 'M')}
- Bodyweight: {profile.get('bodyweight', 0)} kg, Height: {profile.get('height_cm', 0)} cm
- Primary Goal: {profile.get('goal', 'General Fitness')}

================================================================================
PRE-CALCULATED DATA QUALITY & RELIABILITY AUDIT (AUTHORITATIVE):
================================================================================
{json.dumps(audit, indent=2)}

MANDATORY FORMATTING & VISUAL LAYOUT RULES (CRITICAL FOR APP RENDERING):
1. Structure the output into standard Executive Markdown sections using `#` for main title and `##` for section titles:
   - `# EXECUTIVE ATHLETE PERFORMANCE & DATA RELIABILITY REPORT`
   - `## 1. Executive Summary & Reliability Status`
   - `## 2. Data Grounding Audit & Reliability Bands`
   - `## 3. Training & Volume Progression`
   - `## 4. Nutrition & Recovery Synchronization`
   - `## 5. Fatigue & Injury Risk Protocol`
   - `## 6. Actionable Coaching Directives & Next Steps`
2. ALWAYS use GFM Markdown Tables (`| Header | Header |`) for structured category audits, metrics, workouts, and itemized lists.
3. Use GFM Callout Blockquotes for highlights and warnings:
   - `> ! Alert title — details` for critical flags or incomplete data alerts.
   - `> ~ Warning title — details` for fatigue or injury risk warnings.
   - `> ? Question title — details` for questions needing athlete confirmation.
   - `> i Insight title — details` for positive progress or key observations.
4. Use `**Bold**` for emphasis on key terms, verdicts, and severity metrics.
5. NO EMOJIS anywhere in the output. Use clean technical Markdown.
6. DO NOT output empty blank lines between rows in Markdown tables. Keep all rows of a table (`| col | col |`) on immediately consecutive lines. Always start section titles with `## `.

MANDATORY DATA QUALITY & COACHING DIRECTIVES:
1. ABSENCE OF DATA IS NOT ABSENCE OF BEHAVIOR.
2. NUTRITION LOGGING VALIDATION & THE 388 KCAL RULE:
   - Nutrition Reliability = {audit['nutrition']['reliability']} (Coverage: {audit['nutrition']['coverage_pct']}%, Logged Unique Days: {audit['nutrition']['logged_unique_days']} of {audit['nutrition']['expected_days']}).
   - Suspicious Calories Flag = {audit['nutrition']['suspicious_calories']} (Recorded Average = {audit['nutrition']['recorded_avg_calories']} kcal/day).
   - IF Nutrition Reliability is LOW or suspicious_calories is True:
     * YOU MUST NOT prescribe a calorie increase/decrease based on this recorded average.
     * YOU MUST explicitly output a Coaching Alert:
       "> ! **Nutrition Logging Alert** — The recorded calorie average of {audit['nutrition']['recorded_avg_calories']} kcal/day is not considered reliable because nutrition logging appears incomplete ({audit['nutrition']['logged_unique_days']} of {audit['nutrition']['expected_days']} unique days logged). This value should not be interpreted as actual daily intake."
     * Action: Direct the primary recommendation to improving nutrition logging.
3. SLEEP LOGGING VALIDATION:
   - Sleep Reliability = {audit['sleep']['reliability']} (Coverage: {audit['sleep']['coverage_pct']}%, Logged Unique Days: {audit['sleep']['logged_unique_days']} of {audit['sleep']['expected_days']}).
4. TRAINING LOGGING VALIDATION:
   - Training Reliability = {audit['training']['reliability']} (Coverage: {audit['training']['coverage_pct']}%, Logged Unique Days: {audit['training']['logged_unique_days']} of {audit['training']['expected_days']}).

COACH DIRECTIVE / QUESTION:
"{prompt_text or 'Provide a comprehensive weekly training & recovery assessment report for this athlete.'}"

ATHLETE DATA PAYLOAD:
1. Workouts ({len(workouts)} sessions logged across {audit['training']['logged_unique_days']} unique days, {round(total_vol)} kg total volume):
{json.dumps(workouts, indent=2)}

2. Top PRs & Heavy Lifts:
{json.dumps(prs, indent=2)}

3. Nutrition Compliance ({len(nutrition)} records across {audit['nutrition']['logged_unique_days']} unique days, target: {target.get('final_calories', 'N/A')} kcal):
{json.dumps(nutrition, indent=2)}

4. Sleep & Recovery Logs ({len(sleep)} records across {audit['sleep']['logged_unique_days']} unique days, avg {avg_sleep} hrs):
{json.dumps(sleep, indent=2)}

5. Active Injuries & Limitations ({len(injuries)} active):
{json.dumps(injuries, indent=2)}

6. Past Coach Directives & Corrections (MUST BE OBEYED PERMANENTLY):
{json.dumps(notes, indent=2)}
"""


    if payload.coach_feedback and payload.coach_feedback.strip():
        prev_report_snippet = payload.previous_report.strip()[:3500] if payload.previous_report else ""
        user_msg += f"""

=== COACH REAL-TIME REFINEMENT DIRECTIVE & CORRECTION ===
The head coach reviewed the report draft and provided the following REAL-TIME FEEDBACK / CORRECTION:
"{payload.coach_feedback.strip()}"

{"PREVIOUS REPORT DRAFT VERSION TO REFINE (SNIPPET):" if prev_report_snippet else ""}
{prev_report_snippet}

REFINEMENT INSTRUCTIONS:
- You MUST immediately incorporate the coach's feedback and corrections above into the report.
- Adjust training recommendations, volume numbers, exercise choices, nutrition targets, or risk assessments to strictly align with the coach's directive.
- Ensure the same mistake or oversight is NOT repeated.
- Produce a complete, updated, refined report incorporating all feedback while maintaining 100% data grounding and ZERO emojis.
"""

    return user_msg

@router.post("/coach/athlete/{athlete_id}/ai-report")
def generate_athlete_ai_report(
    athlete_id: int,
    payload: AIReportReq,
    coach_id: int = Depends(get_current_user_id),
    db=Depends(get_db)
):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="AI Report service is not configured.")

    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        verify_coach_and_athlete(coach_id, athlete_id, cur)
        
        # Persist feedback so LLM remembers it in all future runs
        if payload.coach_feedback and payload.coach_feedback.strip():
            try:
                cur.execute("""
                    INSERT INTO coach_notes (coach_id, athlete_id, note)
                    VALUES (%s, %s, %s)
                """, (coach_id, athlete_id, f"Coach Feedback Rule: {payload.coach_feedback.strip()}"))
                db.commit()
            except Exception as note_err:
                log.warning(f"Failed to persist coach note rule: {note_err}")
                db.rollback()

        ctx = fetch_athlete_full_context(athlete_id, coach_id, cur)

    prompt = build_report_prompt(ctx.get("profile", {}).get("name", "Athlete"), payload, ctx)

    try:
        from groq import Groq
        client = Groq(api_key=api_key)
        from services.llm_service import create_groq_chat_completion
        model_name = os.getenv("GROQ_CHAT_MODEL", "llama-3.3-70b-versatile")
        completion = create_groq_chat_completion(
            client=client,
            model=model_name,
            messages=[
                {
                    "role": "system", 
                    "content": SYSTEM_BACKSTORY
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.6,
            max_tokens=3000
        )
        report_md = completion.choices[0].message.content.strip()
        import re
        report_md = re.sub(r'[\U00010000-\U0010ffff\u2600-\u26ff\u2700-\u27bf]', '', report_md)

        workouts = ctx.get("recent_workouts", [])
        nutrition = ctx.get("nutrition_logs", [])
        sleep = ctx.get("sleep_logs", [])
        injuries = ctx.get("active_injuries", [])

        data_transparency = {
            "workouts_analyzed": len(workouts),
            "has_workouts": len(workouts) > 0,
            "total_volume_kg": sum(w.get("total_volume", 0) for w in workouts),
            "nutrition_days_analyzed": len(nutrition),
            "has_nutrition": len(nutrition) > 0,
            "sleep_nights_analyzed": len(sleep),
            "has_sleep": len(sleep) > 0,
            "active_injuries": len(injuries),
            "has_injuries": len(injuries) > 0
        }

        return {
            "success": True,
            "report": report_md,
            "athlete_profile": ctx.get("profile", {}),
            "active_injuries": ctx.get("active_injuries", []),
            "data_transparency": data_transparency
        }

    except Exception as e:
        log.error(f"Groq AI Report Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"AI Report generation error: {str(e)}")
