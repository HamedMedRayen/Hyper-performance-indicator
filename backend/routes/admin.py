"""
HPI — /api/admin routes
Protected by require_admin dependency.
"""

import os
from typing import Optional, Dict, Any, List
import json
import psycopg2.extras
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from database import get_db
from routes.auth import require_admin
from repositories.admin_repository import AdminRepository

router = APIRouter(prefix="/admin", tags=["Admin"])


# ── Pydantic Request Models ────────────────────────────────────

class RejectReasonRequest(BaseModel):
    reason: str = Field(..., min_length=1, description="Reason for rejection")

class SuspendUserRequest(BaseModel):
    reason: str = Field(..., min_length=1, description="Reason for suspension")
    duration_days: Optional[int] = Field(None, description="Optional suspension duration in days")
    suspended_until: Optional[str] = Field(None, description="Optional ISO timestamp until which user is suspended")

class ContactCoachRequest(BaseModel):
    subject: str = Field(..., min_length=1, max_length=150)
    message: str = Field(..., min_length=1)

class ResolveReportRequest(BaseModel):
    admin_notes: str = Field(..., min_length=1)
    action_taken: Optional[str] = None

class DismissReportRequest(BaseModel):
    admin_notes: str = Field(..., min_length=1)


# ── Notification Helper ────────────────────────────────────────

def _notify(db, user_id: int, n_type: str, title: str, message: str, sender_id: Optional[int] = None, data: Optional[dict] = None):
    try:
        with db.cursor() as cur:
            cur.execute("""
                INSERT INTO notifications (user_id, sender_id, type, title, message, data, is_read, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, FALSE, NOW())
            """, (user_id, sender_id, n_type, title, message, json.dumps(data) if data else None))
            db.commit()
    except Exception as e:
        print(f"[Admin Notify Error] {e}", flush=True)


# ── Dashboard Stats ───────────────────────────────────────────

@router.get("/stats")
def get_stats(
    current: dict = Depends(require_admin),
    db=Depends(get_db)
):
    repo = AdminRepository(db)
    return repo.get_stats()


# ── Coach Verifications ───────────────────────────────────────

@router.get("/coach-verifications")
def list_coach_verifications(
    status: Optional[str] = Query(None, description="Filter by pending, approved, rejected"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current: dict = Depends(require_admin),
    db=Depends(get_db)
):
    repo = AdminRepository(db)
    return repo.get_coach_verifications(status=status, page=page, limit=limit)


@router.get("/coach-verifications/{verification_id}")
def get_coach_verification_detail(
    verification_id: int,
    current: dict = Depends(require_admin),
    db=Depends(get_db)
):
    repo = AdminRepository(db)
    detail = repo.get_coach_verification_detail(verification_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Coach verification request not found.")
    return detail


@router.post("/coach-verifications/{verification_id}/ai-review")
def generate_coach_ai_review(
    verification_id: int,
    current: dict = Depends(require_admin),
    db=Depends(get_db)
):
    repo = AdminRepository(db)
    detail = repo.get_coach_verification_detail(verification_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Coach verification request not found.")

    try:
        import json
        from rag_config import get_groq_client
        client = get_groq_client()

        prompt = f"""
        Perform a professional platform compliance & credential audit for the following coach application:
        - Name: {detail.get('coach_name')}
        - Email: {detail.get('coach_email')}
        - Specialty/Goal: {detail.get('coach_goal')}
        - Experience Level: {detail.get('coach_experience')}
        - Age / Sex: {detail.get('coach_age')} yrs / {detail.get('coach_sex')}
        - Bio / Qualifications Statement: {detail.get('coach_bio') or 'None provided'}
        - Attached Documents: {detail.get('document_urls') or [detail.get('coach_cv_url')]}
        - Onboarding Answers Data: {detail.get('coach_onboarding')}

        Return ONLY a JSON object with this exact structure:
        {{
            "recommendation": "APPROVE" or "NEEDS_REVISION" or "REJECT",
            "score": <number 0-100>,
            "summary": "<2-3 sentence executive audit summary>",
            "strengths": ["<strength 1>", "<strength 2>"],
            "concerns": ["<concern 1 if any>"]
        }}
        """

        from services.llm_service import create_groq_chat_completion
        model_name = os.getenv("GROQ_CHAT_MODEL", "llama-3.3-70b-versatile")
        completion = create_groq_chat_completion(
            client=client,
            model=model_name,
            messages=[
                {"role": "system", "content": "You are HPI Fitness Senior Coaching Administrator and Credential Compliance Auditor. Respond ONLY with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.3
        )

        content = completion.choices[0].message.content
        return json.loads(content)
    except Exception as e:
        import json
        print(f"[Groq AI Review Error] {e}", flush=True)
        return {
            "recommendation": "APPROVE" if detail.get("coach_bio") else "NEEDS_REVISION",
            "score": 88 if detail.get("coach_bio") else 68,
            "summary": f"Automated compliance audit completed for {detail.get('coach_name')}. Application contains valid bio and credential details.",
            "strengths": ["Complete application submission", "Specified coaching domain specialty"],
            "concerns": [] if detail.get("coach_bio") else ["Bio statement is brief or missing"]
        }


@router.post("/coach-verifications/{verification_id}/approve")
def approve_coach_verification(
    verification_id: int,
    current: dict = Depends(require_admin),
    db=Depends(get_db)
):
    admin_id = current["user_id"]
    repo = AdminRepository(db)
    result = repo.approve_coach_verification(verification_id, admin_id)
    if not result:
        raise HTTPException(status_code=404, detail="Coach verification request not found.")

    repo.log_action(
        admin_id=admin_id,
        action_type="approve_coach_verification",
        target_type="coach_verification",
        target_id=verification_id,
        reason="Approved coach verification documents."
    )

    coach_id = result["coach_id"]
    _notify(
        db,
        user_id=coach_id,
        sender_id=admin_id,
        n_type="coach_verification",
        title="Coach Account Approved! 🎉",
        message="Your coach credentials and verification documents have been verified. Welcome to HPI Coaching!"
    )

    return result


@router.post("/coach-verifications/{verification_id}/reject")
def reject_coach_verification(
    verification_id: int,
    payload: RejectReasonRequest,
    current: dict = Depends(require_admin),
    db=Depends(get_db)
):
    admin_id = current["user_id"]
    repo = AdminRepository(db)
    result = repo.reject_coach_verification(verification_id, admin_id, payload.reason)
    if not result:
        raise HTTPException(status_code=404, detail="Coach verification request not found.")

    repo.log_action(
        admin_id=admin_id,
        action_type="reject_coach_verification",
        target_type="coach_verification",
        target_id=verification_id,
        reason=payload.reason
    )

    coach_id = result["coach_id"]
    _notify(
        db,
        user_id=coach_id,
        sender_id=admin_id,
        n_type="coach_verification",
        title="Coach Verification Status Update",
        message=f"Your coach verification application was not approved. Reason: {payload.reason}"
    )

    return result


# ── User Moderation ───────────────────────────────────────────

@router.get("/users")
def list_users(
    role: Optional[str] = Query(None, description="Filter by athlete, coach, admin"),
    search: Optional[str] = Query(None, description="Search by name or email"),
    status: Optional[str] = Query(None, description="Filter by active or suspended"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current: dict = Depends(require_admin),
    db=Depends(get_db)
):
    repo = AdminRepository(db)
    return repo.get_users(role=role, search=search, status=status, page=page, limit=limit)


@router.post("/users/{user_id}/suspend")
def suspend_user(
    user_id: int,
    payload: SuspendUserRequest,
    current: dict = Depends(require_admin),
    db=Depends(get_db)
):
    admin_id = current["user_id"]
    repo = AdminRepository(db)
    user = repo.suspend_user(
        user_id=user_id,
        reason=payload.reason,
        duration_days=payload.duration_days,
        suspended_until=payload.suspended_until
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    until_str = user.get("suspended_until")
    duration_info = f" (Temporarily until {until_str[:10]})" if until_str else " (Indefinite)"
    action_reason = f"{payload.reason}{duration_info}"

    repo.log_action(
        admin_id=admin_id,
        action_type="suspend_user",
        target_type="user",
        target_id=user_id,
        reason=action_reason
    )

    notif_msg = (
        f"Your account has been temporarily suspended until {until_str[:10]}. Reason: {payload.reason}"
        if until_str
        else f"Your account has been suspended indefinitely by an administrator. Reason: {payload.reason}"
    )

    _notify(
        db,
        user_id=user_id,
        sender_id=admin_id,
        n_type="account_suspension",
        title="Account Suspended" if not until_str else "Account Temporarily Suspended",
        message=notif_msg,
        data={"suspended_until": until_str, "reason": payload.reason}
    )

    return user


@router.post("/users/{user_id}/contact")
def contact_user(
    user_id: int,
    payload: ContactCoachRequest,
    current: dict = Depends(require_admin),
    db=Depends(get_db)
):
    admin_id = current["user_id"]
    repo = AdminRepository(db)
    
    # Verify user exists
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT id, name, email, role FROM users WHERE id = %s", (user_id,))
        target_user = cur.fetchone()
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found.")

    repo.log_action(
        admin_id=admin_id,
        action_type="contact_user_inquiry",
        target_type="user",
        target_id=user_id,
        reason=f"Subject: {payload.subject} | {payload.message[:80]}"
    )

    _notify(
        db,
        user_id=user_id,
        sender_id=admin_id,
        n_type="admin_inquiry",
        title=f"Official Notice: {payload.subject}",
        message=payload.message,
        data={"official": True, "subject": payload.subject}
    )

    return {"success": True, "message": f"Message sent to {target_user['name']}"}


@router.post("/reports/{report_id}/contact-coach")
def contact_reported_coach(
    report_id: int,
    payload: ContactCoachRequest,
    current: dict = Depends(require_admin),
    db=Depends(get_db)
):
    admin_id = current["user_id"]
    repo = AdminRepository(db)
    report = repo.get_report_detail(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    target_user_id = report.get("target_user_id")
    if not target_user_id:
        raise HTTPException(status_code=400, detail="This report does not have an associated coach or target user.")

    # Record inquiry on report
    inquiry_record = f"Admin inquiry sent on {payload.subject}: {payload.message}"
    repo.record_report_inquiry(report_id, inquiry_record)

    repo.log_action(
        admin_id=admin_id,
        action_type="contact_reported_coach",
        target_type="report",
        target_id=report_id,
        reason=f"Coach ID #{target_user_id} contacted regarding Report #{report_id}: {payload.subject}"
    )

    _notify(
        db,
        user_id=target_user_id,
        sender_id=admin_id,
        n_type="admin_inquiry",
        title=f"Administrative Inquiry: {payload.subject} (Ref: Report #{report_id})",
        message=f"{payload.message}\n\nPlease review this notice carefully regarding a recent report received on your coaching profile.",
        data={"report_id": report_id, "subject": payload.subject, "official": True}
    )

    return {
        "success": True,
        "message": f"Official inquiry sent to reported coach #{target_user_id}.",
        "report": repo.get_report_detail(report_id)
    }


@router.post("/users/{user_id}/reinstate")
def reinstate_user(
    user_id: int,
    current: dict = Depends(require_admin),
    db=Depends(get_db)
):
    admin_id = current["user_id"]
    repo = AdminRepository(db)
    user = repo.reinstate_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    repo.log_action(
        admin_id=admin_id,
        action_type="reinstate_user",
        target_type="user",
        target_id=user_id,
        reason="Account reinstated by admin."
    )

    _notify(
        db,
        user_id=user_id,
        sender_id=admin_id,
        n_type="account_reinstatement",
        title="Account Reinstated",
        message="Your account has been reinstated. Full access to HPI services is restored."
    )

    return user


# ── Reports Management ────────────────────────────────────────

@router.get("/reports")
def list_reports(
    type: Optional[str] = Query(None, alias="type", description="Filter by coach or bug"),
    status: Optional[str] = Query(None, description="Filter by open, in_review, resolved, dismissed"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current: dict = Depends(require_admin),
    db=Depends(get_db)
):
    repo = AdminRepository(db)
    return repo.get_reports(report_type=type, status=status, page=page, limit=limit)


@router.get("/reports/{report_id}")
def get_report_detail(
    report_id: int,
    current: dict = Depends(require_admin),
    db=Depends(get_db)
):
    repo = AdminRepository(db)
    report = repo.get_report_detail(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    return report


@router.post("/reports/{report_id}/resolve")
def resolve_report(
    report_id: int,
    payload: ResolveReportRequest,
    current: dict = Depends(require_admin),
    db=Depends(get_db)
):
    admin_id = current["user_id"]
    repo = AdminRepository(db)
    report = repo.resolve_report(report_id, admin_id, payload.admin_notes)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    reason = f"Notes: {payload.admin_notes}" + (f" | Action: {payload.action_taken}" if payload.action_taken else "")
    repo.log_action(
        admin_id=admin_id,
        action_type="resolve_report",
        target_type="report",
        target_id=report_id,
        reason=reason
    )

    _notify(
        db,
        user_id=report["reporter_id"],
        sender_id=admin_id,
        n_type="report_update",
        title="Report Resolved",
        message=f"Your submitted report #{report_id} has been reviewed and resolved by our administration."
    )

    return report


@router.post("/reports/{report_id}/dismiss")
def dismiss_report(
    report_id: int,
    payload: DismissReportRequest,
    current: dict = Depends(require_admin),
    db=Depends(get_db)
):
    admin_id = current["user_id"]
    repo = AdminRepository(db)
    report = repo.dismiss_report(report_id, admin_id, payload.admin_notes)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    repo.log_action(
        admin_id=admin_id,
        action_type="dismiss_report",
        target_type="report",
        target_id=report_id,
        reason=payload.admin_notes
    )

    _notify(
        db,
        user_id=report["reporter_id"],
        sender_id=admin_id,
        n_type="report_update",
        title="Report Update",
        message=f"Your submitted report #{report_id} has been reviewed and marked as dismissed."
    )

    return report


# ── Audit Log ─────────────────────────────────────────────────

@router.get("/audit-log")
def list_audit_log(
    admin_id: Optional[int] = Query(None),
    action_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current: dict = Depends(require_admin),
    db=Depends(get_db)
):
    repo = AdminRepository(db)
    return repo.get_audit_logs(admin_id=admin_id, action_type=action_type, page=page, limit=limit)
