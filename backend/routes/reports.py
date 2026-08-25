"""
HPI — /api/reports routes
User-facing report endpoints for reporting coaches and software bugs.
"""

from typing import Optional, Dict, Any, List
import psycopg2.extras
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from database import get_db
from routes.auth import get_current_user_id
from repositories.report_repository import ReportRepository

router = APIRouter(prefix="/reports", tags=["Reports"])


class CoachReportRequest(BaseModel):
    coach_id: int
    category: str = Field(..., min_length=2, example="Inappropriate behavior")
    description: str = Field(..., min_length=5, example="Detailed description of issue")

class BugReportRequest(BaseModel):
    category: str = Field(..., min_length=2, example="Crash")
    description: str = Field(..., min_length=5, example="UI layout breaks on mobile width")
    screenshot_url: Optional[str] = None
    app_context: Optional[str] = None


@router.post("/coach", status_code=201)
def report_coach(
    payload: CoachReportRequest,
    reporter_id: int = Depends(get_current_user_id),
    db=Depends(get_db)
):
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT id, role FROM users WHERE id = %s", (payload.coach_id,))
        coach = cur.fetchone()
    if not coach:
        raise HTTPException(status_code=404, detail="Coach user not found.")

    repo = ReportRepository(db)
    report = repo.create_coach_report(
        reporter_id=reporter_id,
        coach_id=payload.coach_id,
        category=payload.category,
        description=payload.description
    )
    return report


@router.post("/bug", status_code=201)
def report_bug(
    payload: BugReportRequest,
    reporter_id: int = Depends(get_current_user_id),
    db=Depends(get_db)
):
    repo = ReportRepository(db)
    report = repo.create_bug_report(
        reporter_id=reporter_id,
        category=payload.category,
        description=payload.description,
        screenshot_url=payload.screenshot_url,
        app_context=payload.app_context
    )
    return report


@router.get("/mine")
def get_my_reports(
    reporter_id: int = Depends(get_current_user_id),
    db=Depends(get_db)
):
    repo = ReportRepository(db)
    return repo.get_user_reports(reporter_id)


class InquiryReplyRequest(BaseModel):
    reply: str = Field(..., min_length=2, max_length=3000)


@router.post("/{report_id}/inquiry-reply")
def reply_to_inquiry(
    report_id: int,
    payload: InquiryReplyRequest,
    user_id: int = Depends(get_current_user_id),
    db=Depends(get_db)
):
    import json
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT id, target_user_id, category FROM reports WHERE id = %s", (report_id,))
        report = cur.fetchone()
        if not report:
            raise HTTPException(status_code=404, detail="Report not found.")

        # Verify authorization
        cur.execute("SELECT id, name, role FROM users WHERE id = %s", (user_id,))
        user = cur.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")

        if report["target_user_id"] != user_id and user["role"] != "admin":
            raise HTTPException(status_code=403, detail="You are not authorized to respond to this report inquiry.")

        coach_name = user["name"]

        # Update report with reply
        cur.execute("""
            UPDATE reports
            SET inquiry_reply = %s, inquiry_reply_at = NOW()
            WHERE id = %s
            RETURNING *
        """, (payload.reply.strip(), report_id))
        updated_report = cur.fetchone()
        if updated_report:
            if updated_report.get("created_at"):
                updated_report["created_at"] = updated_report["created_at"].isoformat()
            if updated_report.get("inquiry_at"):
                updated_report["inquiry_at"] = updated_report["inquiry_at"].isoformat()
            if updated_report.get("inquiry_reply_at"):
                updated_report["inquiry_reply_at"] = updated_report["inquiry_reply_at"].isoformat()

        # Notify all admins about the coach's reply
        cur.execute("SELECT id FROM users WHERE role = 'admin'")
        admins = cur.fetchall()
        for adm in admins:
            cur.execute("""
                INSERT INTO notifications (user_id, sender_id, type, title, message, data, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, NOW())
            """, (
                adm["id"],
                user_id,
                "coach_inquiry_reply",
                f"Coach Response: Report #{report_id}",
                f"{coach_name} submitted a statement regarding Report #{report_id} ({report['category']}): \"{payload.reply.strip()[:140]}\"",
                json.dumps({"report_id": report_id, "coach_id": user_id, "official": True})
            ))

        # Log admin audit
        cur.execute("""
            INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, reason, created_at)
            VALUES (%s, %s, %s, %s, %s, NOW())
        """, (
            user_id,
            "coach_inquiry_reply",
            "report",
            report_id,
            f"Coach {coach_name} submitted response: {payload.reply.strip()[:120]}"
        ))

        # Mark corresponding admin_inquiry notification for this coach as read
        cur.execute("""
            UPDATE notifications
            SET is_read = TRUE
            WHERE user_id = %s AND (data->>'report_id')::text = %s
        """, (user_id, str(report_id)))

        db.commit()
        return {
            "success": True,
            "message": "Your official response has been submitted to platform administration.",
            "report": updated_report
        }

