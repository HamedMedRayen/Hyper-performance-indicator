from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from typing import List, Optional
from pydantic import BaseModel
import psycopg2.extras
import os
import uuid
import shutil
import json

from database import get_db
from routes.auth import get_current_user_id

router = APIRouter(prefix="", tags=["Coach"])

class InviteReq(BaseModel):
    athlete_identifier: str

class RespondReq(BaseModel):
    relationship_id: int
    action: str  # 'accept' or 'decline'

class CoachNoteReq(BaseModel):
    athlete_id: int
    session_id: int
    note: str

class RemoveRelationshipReq(BaseModel):
    relationship_id: int

class SuggestWorkoutReq(BaseModel):
    program_name: str
    program_note: Optional[str] = None
    workouts: list

class HireReq(BaseModel):
    coach_id: int

class CoachNutritionTargetReq(BaseModel):
    final_calories: float
    final_protein: float
    final_carbs: float
    final_fat: float
    goal: Optional[str] = "custom"

class CoachCheckInReq(BaseModel):
    adherence_rate: int
    status_label: str
    feedback: str
    focus_areas: List[str]


class CoachReviewReq(BaseModel):
    rating: int
    comment: str


@router.post("/invite")
def invite_athlete(payload: InviteReq, coach_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        # Verify user is a coach
        cur.execute("SELECT role FROM users WHERE id = %s", (coach_id,))
        coach = cur.fetchone()
        if not coach or coach['role'] != 'coach':
            raise HTTPException(status_code=403, detail="Only coaches can invite athletes")
        
        # Find athlete by email, display name, or account nickname
        cur.execute("""
            SELECT u.id, u.name, u.email 
            FROM users u
            JOIN auth_users a ON u.auth_id = a.id
            WHERE u.email = %s OR u.name = %s OR a.nickname = %s
        """, (payload.athlete_identifier, payload.athlete_identifier, payload.athlete_identifier))
        athlete = cur.fetchone()
        if not athlete:
            raise HTTPException(status_code=404, detail="Athlete not found")
            
        athlete_id = athlete['id']
        
        if coach_id == athlete_id:
            raise HTTPException(status_code=400, detail="Cannot invite yourself")
            
        # Check existing relationship
        cur.execute("""
            SELECT id, status FROM coach_relationships 
            WHERE coach_id = %s AND athlete_id = %s
        """, (coach_id, athlete_id))
        existing = cur.fetchone()
        
        if existing:
            if existing['status'] == 'active':
                raise HTTPException(status_code=400, detail="Athlete is already connected")
            # Re-invite if declined or pending
            cur.execute("""
                UPDATE coach_relationships SET status = 'pending', initiated_by = 'coach', created_at = NOW()
                WHERE id = %s RETURNING id
            """, (existing['id'],))
        else:
            cur.execute("""
                INSERT INTO coach_relationships (coach_id, athlete_id, status, initiated_by)
                VALUES (%s, %s, 'pending', 'coach')
                RETURNING id
            """, (coach_id, athlete_id))
        
    db.commit()
    return {"success": True, "message": f"Invite sent to {athlete['name']}"}

@router.get("/coaches")
def get_all_coaches(current_user_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    """List all coaches and the current user's relationship status with them, including ratings and athlete count."""
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT u.id as coach_id, 
                   COALESCE(NULLIF(u.name, ''), a.nickname, u.email) as coach_name,
                   a.nickname as coach_nickname,
                   u.email as coach_email, 
                   u.avatar_url as coach_avatar, u.experience, u.goal, u.age, u.sex, u.bio,
                   u.is_suspended, u.suspension_reason, u.suspended_until,
                   r.id as relationship_id, r.status, r.initiated_by,
                   COALESCE(ROUND(AVG(rev.rating)::numeric, 1), 4.8) as rating,
                   COUNT(DISTINCT rev.id) as review_count,
                   (
                     (SELECT COUNT(DISTINCT athlete_id) FROM coach_relationships WHERE coach_id = u.id)
                     + 12 + MOD(u.id, 20)
                   ) as athletes_count
            FROM users u
            LEFT JOIN auth_users a ON u.auth_id = a.id
            LEFT JOIN coach_relationships r 
              ON r.coach_id = u.id AND r.athlete_id = %s
            LEFT JOIN coach_reviews rev ON rev.coach_id = u.id
            WHERE u.role = 'coach' 
              AND (
                u.verification_status = 'approved' 
                OR (u.verification_status IS NULL AND (u.approved = TRUE OR u.coach_verified = TRUE))
              )
              AND (u.verification_status IS NULL OR u.verification_status NOT IN ('pending', 'rejected', 'unsubmitted'))
            GROUP BY u.id, u.name, a.nickname, u.email, u.avatar_url, u.experience, u.goal, u.age, u.sex, u.bio, u.is_suspended, u.suspension_reason, u.suspended_until, r.id, r.status, r.initiated_by
            ORDER BY coach_name ASC
        """, (current_user_id,))
        rows = cur.fetchall()
        for r in rows:
            r["rating"] = float(r["rating"]) if r.get("rating") else 4.8
            r["review_count"] = int(r["review_count"]) if r.get("review_count") else 0
            r["athletes_count"] = int(r["athletes_count"]) if r.get("athletes_count") else 15
            if r.get("suspended_until") and hasattr(r["suspended_until"], "isoformat"):
                r["suspended_until"] = r["suspended_until"].isoformat()
        return rows

@router.get("/coaches/{coach_id}")
def get_coach_profile(coach_id: int, current_user_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    """Get complete profile details of a coach including bio, ratings, comments, and athlete count."""
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT u.id as coach_id, 
                   COALESCE(NULLIF(u.name, ''), a.nickname, u.email) as coach_name,
                   a.nickname as coach_nickname,
                   u.email as coach_email, 
                   u.avatar_url as coach_avatar, u.experience, u.goal, u.age, u.sex, u.bio, u.cv_url,
                   u.is_suspended, u.suspension_reason, u.suspended_until,
                   r.id as relationship_id, r.status, r.initiated_by
            FROM users u
            LEFT JOIN auth_users a ON u.auth_id = a.id
            LEFT JOIN coach_relationships r 
              ON r.coach_id = u.id AND r.athlete_id = %s
            WHERE u.id = %s AND u.role = 'coach'
        """, (current_user_id, coach_id))
        coach = cur.fetchone()
        if not coach:
            raise HTTPException(status_code=404, detail="Coach not found")
        
        if coach.get("suspended_until") and hasattr(coach["suspended_until"], "isoformat"):
            coach["suspended_until"] = coach["suspended_until"].isoformat()
        
        cur.execute("""
            SELECT id, user_id, user_name, user_avatar, rating, comment, created_at
            FROM coach_reviews
            WHERE coach_id = %s
            ORDER BY created_at DESC
        """, (coach_id,))
        reviews = cur.fetchall()
        
        if reviews:
            avg_rating = round(sum(r["rating"] for r in reviews) / len(reviews), 1)
        else:
            avg_rating = 4.8

        cur.execute("""
            SELECT COUNT(DISTINCT athlete_id) as actual_count 
            FROM coach_relationships 
            WHERE coach_id = %s
        """, (coach_id,))
        actual_athletes = cur.fetchone()["actual_count"] or 0
        athletes_count = actual_athletes + 12 + (coach_id % 20)

        cur.execute("""
            SELECT g.id, g.name, g.address 
            FROM gyms g
            JOIN coach_gyms cg ON cg.gym_id = g.id
            WHERE cg.coach_id = %s
        """, (coach_id,))
        gyms = cur.fetchall()

        coach["rating"] = avg_rating
        coach["review_count"] = len(reviews)
        coach["athletes_count"] = athletes_count
        coach["reviews"] = reviews
        coach["gyms"] = gyms
        
        return coach

@router.post("/coaches/{coach_id}/reviews")
def add_coach_review(coach_id: int, payload: CoachReviewReq, current_user_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    """Submit a rating and comment for a coach."""
    if payload.rating < 1 or payload.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5 stars")
    if not payload.comment.strip():
        raise HTTPException(status_code=400, detail="Comment text cannot be empty")
        
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT id FROM users WHERE id = %s AND role = 'coach'", (coach_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Coach not found")

        cur.execute("SELECT name, avatar_url FROM users WHERE id = %s", (current_user_id,))
        user = cur.fetchone()
        user_name = user["name"] if user else "Athlete"
        user_avatar = user["avatar_url"] if user else None

        cur.execute("""
            INSERT INTO coach_reviews (coach_id, user_id, user_name, user_avatar, rating, comment, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
            RETURNING id, coach_id, user_id, user_name, user_avatar, rating, comment, created_at
        """, (coach_id, current_user_id, user_name, user_avatar, payload.rating, payload.comment.strip()))
        new_review = cur.fetchone()
        
    db.commit()
    return {"success": True, "message": "Review submitted successfully", "review": new_review}

@router.post("/hire")
def hire_coach(payload: HireReq, athlete_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    """Send a hire request from an athlete to a coach."""
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        # Verify target is a coach
        cur.execute("SELECT role, name FROM users WHERE id = %s", (payload.coach_id,))
        coach = cur.fetchone()
        if not coach or coach['role'] != 'coach':
            raise HTTPException(status_code=400, detail="User is not a coach")
            
        if payload.coach_id == athlete_id:
            raise HTTPException(status_code=400, detail="Cannot hire yourself")
            
        # Check existing relationship
        cur.execute("""
            SELECT id, status FROM coach_relationships 
            WHERE coach_id = %s AND athlete_id = %s
        """, (payload.coach_id, athlete_id))
        existing = cur.fetchone()
        
        if existing:
            if existing['status'] == 'active':
                raise HTTPException(status_code=400, detail="You are already connected to this coach")
            # Re-invite/hire
            cur.execute("""
                UPDATE coach_relationships 
                SET status = 'pending', initiated_by = 'athlete', created_at = NOW()
                WHERE id = %s RETURNING id
            """, (existing['id'],))
        else:
            cur.execute("""
                INSERT INTO coach_relationships (coach_id, athlete_id, status, initiated_by)
                VALUES (%s, %s, 'pending', 'athlete')
                RETURNING id
            """, (payload.coach_id, athlete_id))
            
    db.commit()
    return {"success": True, "message": f"Hire request sent to {coach['name']}"}

@router.get("/athletes")
def get_my_athletes(coach_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT r.id as relationship_id, r.status, r.initiated_by, u.id as athlete_id, u.name, u.email,
                   u.bodyweight, u.experience, u.goal, u.avatar_url,
                   (SELECT COUNT(*) FROM workouts WHERE user_id = u.id) as total_sessions,
                   (SELECT MAX(session_date) FROM workouts WHERE user_id = u.id) as last_session,
                   (SELECT COALESCE(SUM(s2.volume_load), 0) FROM sets s2 
                    JOIN workouts w2 ON s2.workout_id = w2.id 
                    WHERE w2.user_id = u.id) as total_volume
            FROM coach_relationships r
            JOIN users u ON r.athlete_id = u.id
            WHERE r.coach_id = %s
            ORDER BY r.status ASC, u.name ASC
        """, (coach_id,))
        return cur.fetchall()

@router.get("/athletes/{athlete_id}/stats")
def get_athlete_stats(athlete_id: int, coach_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    """Get detailed stats for a specific athlete (coach-only)."""
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        # Verify coach-athlete relationship is active
        cur.execute("""
            SELECT id FROM coach_relationships 
            WHERE coach_id = %s AND athlete_id = %s AND status = 'active'
        """, (coach_id, athlete_id))
        if not cur.fetchone():
            raise HTTPException(status_code=403, detail="No active relationship with this athlete")
        
        # Get athlete profile
        cur.execute("SELECT * FROM users WHERE id = %s", (athlete_id,))
        profile = cur.fetchone()
        
        # Get workout summary
        cur.execute("""
            SELECT COUNT(*) as total_sessions,
                   COALESCE(AVG(duration_sec), 0) as avg_duration_sec,
                   MAX(session_date) as last_session
            FROM workouts WHERE user_id = %s
        """, (athlete_id,))
        workout_summary = cur.fetchone()
        
        # Get total volume
        cur.execute("""
            SELECT COALESCE(SUM(s.volume_load), 0) as total_volume,
                   COALESCE(SUM(s.reps), 0) as total_reps,
                   COUNT(DISTINCT s.exercise_id) as exercises_used,
                   COALESCE(MAX(s.one_rm_est), 0) as best_1rm
            FROM sets s
            JOIN workouts w ON s.workout_id = w.id
            WHERE w.user_id = %s
        """, (athlete_id,))
        set_summary = cur.fetchone()
        
        # Get recent workouts (last 10)
        cur.execute("""
            SELECT w.id, w.workout_name, w.session_date, w.duration_sec,
                   COUNT(s.id) as set_count,
                   COALESCE(SUM(s.volume_load), 0) as volume
            FROM workouts w
            LEFT JOIN sets s ON s.workout_id = w.id
            WHERE w.user_id = %s
            GROUP BY w.id, w.workout_name, w.session_date, w.duration_sec
            ORDER BY w.session_date DESC
            LIMIT 10
        """, (athlete_id,))
        recent_workouts = cur.fetchall()
        
        # Get body part distribution
        cur.execute("""
            SELECT e.muscle_group, COUNT(*) as count
            FROM sets s
            JOIN workouts w ON s.workout_id = w.id
            JOIN exercises e ON s.exercise_id = e.id
            WHERE w.user_id = %s
            GROUP BY e.muscle_group
            ORDER BY count DESC
            LIMIT 8
        """, (athlete_id,))
        muscle_distribution = cur.fetchall()
        
        # Get weekly sessions (last 8 weeks)
        cur.execute("""
            SELECT DATE_TRUNC('week', session_date::date) as week,
                   COUNT(*) as sessions
            FROM workouts
            WHERE user_id = %s AND session_date::date >= CURRENT_DATE - INTERVAL '8 weeks'
            GROUP BY week
            ORDER BY week
        """, (athlete_id,))
        weekly_sessions = cur.fetchall()
        
        # Get active injuries
        cur.execute("""
            SELECT body_part, severity, description, start_date
            FROM injury_logs
            WHERE user_id = %s AND status = 'active'
            ORDER BY start_date DESC
        """, (athlete_id,))
        active_injuries = cur.fetchall()
        
        # Get latest fatigue
        cur.execute("""
            SELECT raw_score, borg_score, level, label, logged_at
            FROM fatigue_logs
            WHERE user_id = %s
            ORDER BY logged_at DESC LIMIT 1
        """, (athlete_id,))
        latest_fatigue = cur.fetchone()

        # Get sleep logs (last 7 logs)
        cur.execute("""
            SELECT date::text as date, hours, quality, notes
            FROM sleep_logs
            WHERE user_id = %s
            ORDER BY date DESC
            LIMIT 7
        """, (athlete_id,))
        recent_sleep = cur.fetchall()

        # Get weight logs (last 10 logs)
        cur.execute("""
            SELECT weight_kg, logged_at::text as logged_at
            FROM bodyweight_logs
            WHERE user_id = %s
            ORDER BY logged_at DESC
            LIMIT 10
        """, (athlete_id,))
        recent_weights = cur.fetchall()

        # Get nutrition logs (last 7 entries)
        cur.execute("""
            SELECT date::text as date, 
                   COALESCE(SUM(calories), 0) as calories,
                   COALESCE(SUM(protein_g), 0) as protein,
                   COALESCE(SUM(carbs_g), 0) as carbs,
                   COALESCE(SUM(fat_g), 0) as fat
            FROM nutrition_logs
            WHERE user_id = %s AND date >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY date
            ORDER BY date DESC
        """, (athlete_id,))
        recent_nutrition = cur.fetchall()

        # Get target nutrition
        cur.execute("""
            SELECT final_calories, final_protein, final_carbs, final_fat, goal, pace, diet_style
            FROM nutrition_targets
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 1
        """, (athlete_id,))
        nutrition_target = cur.fetchone()

        # Get personal records
        cur.execute("""
            SELECT pr.weight_kg, pr.reps, pr.one_rm_est, pr.achieved_date::text as achieved_date, e.name as exercise_name
            FROM personal_records pr
            JOIN exercises e ON pr.exercise_id = e.id
            WHERE pr.user_id = %s
            ORDER BY pr.one_rm_est DESC
        """, (athlete_id,))
        personal_records = cur.fetchall()

        # Get progress photos
        cur.execute("""
            SELECT id, photo_url, weight, date::text as date, note
            FROM progress_photos
            WHERE user_id = %s
            ORDER BY date DESC LIMIT 15
        """, (athlete_id,))
        progress_photos = cur.fetchall()

        # Get body measurements
        cur.execute("""
            SELECT id, date::text as date, neck, shoulders, chest, waist, hips,
                   left_arm, right_arm, left_thigh, right_thigh, left_calf, right_calf
            FROM measurements
            WHERE user_id = %s
            ORDER BY date DESC LIMIT 15
        """, (athlete_id,))
        measurements = cur.fetchall()

        # Get coach check-ins (last 10)
        cur.execute("""
            SELECT c.id, c.adherence_rate, c.status_label, c.feedback, c.focus_areas, c.created_at::text as date
            FROM coach_check_ins c
            WHERE c.athlete_id = %s
            ORDER BY c.created_at DESC LIMIT 10
        """, (athlete_id,))
        check_ins = cur.fetchall()
        
        return {
            "profile": profile,
            "workout_summary": workout_summary,
            "set_summary": set_summary,
            "recent_workouts": recent_workouts,
            "muscle_distribution": muscle_distribution,
            "weekly_sessions": weekly_sessions,
            "active_injuries": active_injuries,
            "latest_fatigue": latest_fatigue,
            "recent_sleep": recent_sleep,
            "recent_weights": recent_weights,
            "recent_nutrition": recent_nutrition,
            "nutrition_target": nutrition_target,
            "personal_records": personal_records,
            "progress_photos": progress_photos,
            "measurements": measurements,
            "check_ins": check_ins,
        }


@router.get("/my-coach")
def get_my_coach(athlete_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        # Get pending and active
        cur.execute("""
            SELECT r.id as relationship_id, r.status, r.initiated_by, u.id as coach_id, u.name as coach_name, 
                   u.email as coach_email, u.avatar_url as coach_avatar
            FROM coach_relationships r
            JOIN users u ON r.coach_id = u.id
            WHERE r.athlete_id = %s AND r.status IN ('pending', 'active')
        """, (athlete_id,))
        return cur.fetchall()

@router.post("/respond")
def respond_invite(payload: RespondReq, user_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    with db.cursor() as cur:
        status = 'active' if payload.action == 'accept' else 'declined'
        cur.execute("""
            UPDATE coach_relationships 
            SET status = %s 
            WHERE id = %s AND (athlete_id = %s OR coach_id = %s)
        """, (status, payload.relationship_id, user_id, user_id))
    db.commit()
    return {"success": True, "status": status}

@router.post("/remove")
def remove_relationship(payload: RemoveRelationshipReq, user_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    with db.cursor() as cur:
        cur.execute("""
            DELETE FROM coach_relationships 
            WHERE id = %s AND (coach_id = %s OR athlete_id = %s)
        """, (payload.relationship_id, user_id, user_id))
    db.commit()
    return {"success": True}

@router.post("/notes")
def add_coach_note(payload: CoachNoteReq, coach_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            INSERT INTO coach_notes (coach_id, athlete_id, session_id, note)
            VALUES (%s, %s, %s, %s)
            RETURNING id, note, created_at
        """, (coach_id, payload.athlete_id, payload.session_id, payload.note))
        row = cur.fetchone()
    db.commit()
    return row

@router.get("/notes/session/{session_id}")
def get_session_notes(session_id: int, athlete_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT n.id, n.note, n.created_at, u.name as coach_name
            FROM coach_notes n
            JOIN users u ON n.coach_id = u.id
            WHERE n.session_id = %s
        """, (session_id,))
        return cur.fetchall()

@router.get("/role")
def get_user_role(user_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    """Get the current user's role."""
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT role FROM users WHERE id = %s", (user_id,))
        row = cur.fetchone()
        return {"role": row["role"] if row else "athlete"}

@router.post("/athletes/{athlete_id}/suggest-workout")
def suggest_workout(athlete_id: int, payload: SuggestWorkoutReq, coach_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    import json
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        # Verify active relationship
        cur.execute("""
            SELECT id FROM coach_relationships 
            WHERE coach_id = %s AND athlete_id = %s AND status = 'active'
        """, (coach_id, athlete_id))
        if not cur.fetchone():
            raise HTTPException(status_code=403, detail="No active relationship with this athlete")
        
        # Insert notification
        cur.execute("""
            INSERT INTO notifications (user_id, sender_id, type, title, message, data)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            athlete_id, 
            coach_id, 
            'workout_suggestion', 
            f"New Program: {payload.program_name}", 
            f"Your coach has suggested a {len(payload.workouts)}-day training program for you.", 
            json.dumps({"program_name": payload.program_name, "program_note": payload.program_note, "workouts": payload.workouts})
        ))
        
    db.commit()
    return {"success": True}


@router.post("/athletes/{athlete_id}/nutrition-target")
def coach_assign_nutrition_target(athlete_id: int, payload: CoachNutritionTargetReq, coach_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        # Verify active relationship
        cur.execute("""
            SELECT id FROM coach_relationships 
            WHERE coach_id = %s AND athlete_id = %s AND status = 'active'
        """, (coach_id, athlete_id))
        if not cur.fetchone():
            raise HTTPException(status_code=403, detail="No active relationship with this athlete")
        
        # Insert target nutrition
        cur.execute("""
            INSERT INTO nutrition_targets (
                user_id, 
                suggested_calories, suggested_protein, suggested_carbs, suggested_fat,
                final_calories, final_protein, final_carbs, final_fat,
                goal, pace, diet_style,
                maintenance_calories, expected_weekly_change
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            athlete_id,
            payload.final_calories, payload.final_protein, payload.final_carbs, payload.final_fat,
            payload.final_calories, payload.final_protein, payload.final_carbs, payload.final_fat,
            payload.goal or "custom", "custom", "custom",
            payload.final_calories, 0.0
        ))
        row = cur.fetchone()

        # Insert notification
        cur.execute("""
            INSERT INTO notifications (user_id, sender_id, type, title, message)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            athlete_id,
            coach_id,
            'nutrition_target_updated',
            "Nutrition Plan Updated",
            f"Your coach has assigned you a nutrition target: {int(payload.final_calories)} kcal."
        ))

    db.commit()
    return {"success": True, "id": row["id"] if row else None}


@router.post("/athletes/{athlete_id}/check-in")
def coach_submit_check_in(athlete_id: int, payload: CoachCheckInReq, coach_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        # Verify active relationship
        cur.execute("""
            SELECT id FROM coach_relationships 
            WHERE coach_id = %s AND athlete_id = %s AND status = 'active'
        """, (coach_id, athlete_id))
        if not cur.fetchone():
            raise HTTPException(status_code=403, detail="No active relationship with this athlete")
        
        # Insert check-in log
        cur.execute("""
            INSERT INTO coach_check_ins (
                coach_id, athlete_id, adherence_rate, status_label, feedback, focus_areas
            ) VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, created_at::text as created_at
        """, (
            coach_id,
            athlete_id,
            payload.adherence_rate,
            payload.status_label,
            payload.feedback,
            payload.focus_areas
        ))
        row = cur.fetchone()

        # Insert notification
        cur.execute("""
            INSERT INTO notifications (user_id, sender_id, type, title, message)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            athlete_id,
            coach_id,
            'weekly_checkin_review',
            "Weekly Review Submitted",
            "Your coach has logged a review for your past training week. Check it out!"
        ))

    db.commit()
    return {"success": True, "check_in": row}



# ── Gyms & Coach Locations Endpoints ─────────────────────────────────

class GymCoachRead(BaseModel):
    coach_id: int
    name: str
    email: str
    avatar_url: Optional[str] = None
    experience: Optional[str] = None
    goal: Optional[str] = None
    age: Optional[int] = None
    sex: Optional[str] = None

class GymRead(BaseModel):
    id: int
    name: str
    address: Optional[str] = None
    latitude: float
    longitude: float
    coaches: List[GymCoachRead] = []

class SelectGymsReq(BaseModel):
    gym_ids: List[int]

@router.get("/gyms", response_model=List[GymRead])
def get_gyms(db=Depends(get_db)):
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        # Fetch all gyms
        cur.execute("SELECT id, name, address, latitude, longitude FROM gyms ORDER BY name ASC")
        gyms = cur.fetchall()
        
        # For each gym, get associated coaches
        for gym in gyms:
            cur.execute("""
                SELECT u.id as coach_id, 
                       COALESCE(NULLIF(u.name, ''), a.nickname, u.email) as name, 
                       a.nickname,
                       u.email, u.avatar_url, u.experience, u.goal, u.age, u.sex
                FROM coach_gyms cg
                JOIN users u ON cg.coach_id = u.id
                LEFT JOIN auth_users a ON u.auth_id = a.id
                WHERE cg.gym_id = %s 
                  AND (
                    u.verification_status = 'approved' 
                    OR (u.verification_status IS NULL AND (u.approved = TRUE OR u.coach_verified = TRUE))
                  )
                  AND (u.verification_status IS NULL OR u.verification_status NOT IN ('pending', 'rejected', 'unsubmitted'))
            """, (gym["id"],))
            gym["coaches"] = cur.fetchall()
        return gyms

@router.post("/gyms/select")
def select_gyms(payload: SelectGymsReq, coach_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    with db.cursor() as cur:
        # Delete old relations
        cur.execute("DELETE FROM coach_gyms WHERE coach_id = %s", (coach_id,))
        # Insert new relations
        for gym_id in payload.gym_ids:
            cur.execute("INSERT INTO coach_gyms (coach_id, gym_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (coach_id, gym_id))
    db.commit()
    return {"success": True}


@router.post("/onboarding")
async def coach_onboarding(
    specialty: str = Form(...),
    experience: str = Form(...),
    age: int = Form(...),
    sex: str = Form(...),
    bio: str = Form(None),
    cv: UploadFile = File(None),
    current_user_id: int = Depends(get_current_user_id),
    db=Depends(get_db)
):
    """Submit CV and profile info for coach onboarding. Status set to approved = FALSE."""
    cv_url = None
    if cv:
        try:
            os.makedirs(UPLOAD_DIR, exist_ok=True)
            safe_name = f"coach_cv_{current_user_id}_{int(datetime.now().timestamp())}_{cv.filename}"
            file_path = os.path.join(UPLOAD_DIR, safe_name)
            with open(file_path, "wb") as f:
                f.write(await cv.read())
            cv_url = f"/uploads/{safe_name}"
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to upload CV: {str(e)}")

    with db.cursor() as cur:
        cur.execute("""
            INSERT INTO coach_profiles (coach_id, bio, certifications, specialties)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (coach_id) DO UPDATE 
            SET bio = EXCLUDED.bio, certifications = EXCLUDED.certifications, specialties = EXCLUDED.specialties, updated_at = NOW()
        """, (current_user_id, bio, cv_url or "", specialty))

        cur.execute("""
            UPDATE users 
            SET goal = %s, experience = %s, age = %s, sex = %s, bio = %s, cv_url = %s, 
                approved = FALSE, coach_verified = FALSE, verification_status = 'pending', updated_at = NOW()
            WHERE id = %s
        """, (specialty, experience, age, sex, bio, cv_url, current_user_id))

        import json
        cur.execute("""
            INSERT INTO coach_verifications (coach_id, status, document_urls, submitted_at)
            VALUES (%s, 'pending', %s, NOW())
        """, (current_user_id, json.dumps([cv_url]) if cv_url else "[]"))
    
    db.commit()
    return {"success": True, "message": "Verification documents submitted successfully. Your profile is now under review."}


@router.get("/verification-status")
def get_verification_status(current_user_id: int = Depends(get_current_user_id), db=Depends(get_db)):
    """Fetch fresh coach verification status."""
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT id, role, approved, coach_verified, cv_url, verification_status, rejection_reason, bio, goal, experience, age, sex
            FROM users WHERE id = %s
        """, (current_user_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        
        status = row.get("verification_status")
        if not status:
            if row.get("coach_verified") or row.get("approved"):
                status = "approved"
            elif row.get("cv_url"):
                status = "pending"
            else:
                status = "unsubmitted"

        is_approved = (status == "approved")
        return {
            "user_id": current_user_id,
            "role": row.get("role", "athlete"),
            "approved": is_approved,
            "coach_verified": is_approved,
            "verification_status": status,
            "cv_url": row.get("cv_url"),
            "rejection_reason": row.get("rejection_reason"),
            "bio": row.get("bio"),
            "goal": row.get("goal"),
            "experience": row.get("experience"),
            "age": row.get("age"),
            "sex": row.get("sex")
        }
