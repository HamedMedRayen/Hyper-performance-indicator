"""
HPI — /api/auth routes
Register, login, get current user.
"""
import psycopg2
import psycopg2.extras
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import Optional

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from database import get_db
from services.auth_service import (
    register_user, login_user, create_access_token,
    decode_token, get_user_id_for_auth,
    get_or_create_user_social, generate_email_otp, verify_email_otp, verify_google_token
)
from services.email_service import send_otp_email

router = APIRouter(prefix="/auth", tags=["Auth"])
bearer = HTTPBearer(auto_error=False)

from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)

# ── Pydantic models ───────────────────────────────────────────

class RegisterRequest(BaseModel):
    nickname: str = Field(..., min_length=3, max_length=40)
    email: str = Field(..., example="user@example.com")
    password: str = Field(..., min_length=6)
    role: str = Field(default="athlete", description="athlete or coach")

class LoginRequest(BaseModel):
    nickname: str
    password: str

class SocialLoginRequest(BaseModel):
    token: str

class OtpRequest(BaseModel):
    email: str

class OtpVerifyRequest(BaseModel):
    email: str
    otp: str

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    nickname: str
    avatar_url: Optional[str] = None
    onboarding_completed: bool = False


# ── Dependency: current user ──────────────────────────────────

def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    db: psycopg2.extensions.connection = Depends(get_db),
) -> dict:
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    payload = decode_token(creds.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    auth_id = payload.get("auth_id")
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT * FROM auth_users WHERE id = %s", (auth_id,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="User not found.")
    user_id = get_user_id_for_auth(db, auth_id)
    return {"auth_id": auth_id, "nickname": row["nickname"], "user_id": user_id}


def get_current_user_id(current=Depends(get_current_user)) -> int:
    uid = current.get("user_id")
    if not uid:
        raise HTTPException(status_code=401, detail="Profile not found.")
    return uid


def _check_and_refresh_suspension(db, user_id: int, user_row: dict) -> dict:
    from datetime import datetime, timezone
    if user_row.get("is_suspended"):
        suspended_until = user_row.get("suspended_until")
        if suspended_until:
            now_utc = datetime.now(timezone.utc)
            if isinstance(suspended_until, str):
                try:
                    suspended_until = datetime.fromisoformat(suspended_until.replace("Z", "+00:00"))
                except Exception:
                    pass
            if isinstance(suspended_until, datetime) and suspended_until <= now_utc:
                with db.cursor() as cur:
                    cur.execute("""
                        UPDATE users 
                        SET is_suspended = FALSE, suspension_reason = NULL, suspended_until = NULL, updated_at = NOW()
                        WHERE id = %s
                    """, (user_id,))
                    db.commit()
                user_row["is_suspended"] = False
                user_row["suspension_reason"] = None
                user_row["suspended_until"] = None
    return user_row


def require_admin(
    current: dict = Depends(get_current_user),
    db: psycopg2.extensions.connection = Depends(get_db),
) -> dict:
    user_id = current.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT role, is_suspended, suspension_reason, suspended_until FROM users WHERE id = %s", (user_id,))
        u = cur.fetchone()
    if not u:
        raise HTTPException(status_code=404, detail="User profile not found.")
    
    u = _check_and_refresh_suspension(db, user_id, u)
    if u.get("is_suspended"):
        raise HTTPException(status_code=403, detail="Account is suspended.")
    if u.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required.")
    return {**current, "role": u["role"]}


def get_optional_user_id(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    db: psycopg2.extensions.connection = Depends(get_db),
) -> Optional[int]:
    if not creds:
        return None
    try:
        payload = decode_token(creds.credentials)
        if not payload:
            return None
        auth_id = payload.get("auth_id")
        return get_user_id_for_auth(db, auth_id)
    except Exception:
        return None


# ── Routes ────────────────────────────────────────────────────

@router.post("/register", response_model=AuthResponse, status_code=201)
def register(payload: RegisterRequest, db: psycopg2.extensions.connection = Depends(get_db)):
    try:
        auth_user = register_user(db, payload.nickname, payload.password, payload.email, payload.role)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT id, avatar_url, onboarding_completed, role FROM users WHERE auth_id = %s", (auth_user["id"],))
        u_row = cur.fetchone()
    
    user_id = u_row["id"]
    token = create_access_token({"auth_id": auth_user["id"], "nickname": auth_user["nickname"]})
    is_admin = u_row.get("role") == "admin"
    return AuthResponse(
        access_token=token,
        user_id=user_id,
        nickname=auth_user["nickname"],
        avatar_url=u_row.get("avatar_url"),
        onboarding_completed=True if is_admin else bool(u_row.get("onboarding_completed", False))
    )


@router.post("/login", response_model=AuthResponse)
@limiter.limit("5/minute")
def login(request: Request, payload: LoginRequest, db: psycopg2.extensions.connection = Depends(get_db)):
    auth_user = login_user(db, payload.nickname, payload.password)
    if not auth_user:
        raise HTTPException(status_code=401, detail="Invalid nickname or password.")

    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT id, avatar_url, onboarding_completed, role FROM users WHERE auth_id = %s", (auth_user["id"],))
        u_row = cur.fetchone()
        
    user_id = u_row["id"]
    token = create_access_token({"auth_id": auth_user["id"], "nickname": auth_user["nickname"]})
    is_admin = u_row.get("role") == "admin"
    return AuthResponse(
        access_token=token,
        user_id=user_id,
        nickname=auth_user["nickname"],
        avatar_url=u_row.get("avatar_url"),
        onboarding_completed=True if is_admin else bool(u_row.get("onboarding_completed", False))
    )


@router.post("/google", response_model=AuthResponse)
def google_login(payload: SocialLoginRequest, db: psycopg2.extensions.connection = Depends(get_db)):
    info = verify_google_token(payload.token)
    if not info:
        raise HTTPException(status_code=401, detail="Invalid Google token.")
        
    auth_user = get_or_create_user_social(db, info["email"], info["name"], "google")
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT id, avatar_url, onboarding_completed, role FROM users WHERE auth_id = %s", (auth_user["id"],))
        u_row = cur.fetchone()

    user_id = u_row["id"]
    token = create_access_token({"auth_id": auth_user["id"], "nickname": auth_user["nickname"]})
    is_admin = u_row.get("role") == "admin"
    return AuthResponse(
        access_token=token,
        user_id=user_id,
        nickname=auth_user["nickname"],
        avatar_url=u_row.get("avatar_url"),
        onboarding_completed=True if is_admin else bool(u_row.get("onboarding_completed", False))
    )


@router.post("/email-otp-request")
@limiter.limit("3/minute")
def email_otp_request(request: Request, payload: OtpRequest, db: psycopg2.extensions.connection = Depends(get_db)):
    otp = generate_email_otp(db, payload.email)
    sent = send_otp_email(payload.email, otp)
    if not sent:
        raise HTTPException(status_code=500, detail="Failed to send email.")
    return {"message": "OTP sent to email."}


@router.post("/email-otp-verify", response_model=AuthResponse)
def email_otp_verify(payload: OtpVerifyRequest, db: psycopg2.extensions.connection = Depends(get_db)):
    auth_user = verify_email_otp(db, payload.email, payload.otp)
    if not auth_user:
        raise HTTPException(status_code=401, detail="Invalid or expired OTP.")
        
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT id, avatar_url, onboarding_completed, role FROM users WHERE auth_id = %s", (auth_user["id"],))
        u_row = cur.fetchone()

    user_id = u_row["id"]
    token = create_access_token({"auth_id": auth_user["id"], "nickname": auth_user["nickname"]})
    is_admin = u_row.get("role") == "admin"
    return AuthResponse(
        access_token=token,
        user_id=user_id,
        nickname=auth_user["nickname"],
        avatar_url=u_row.get("avatar_url"),
        onboarding_completed=True if is_admin else bool(u_row.get("onboarding_completed", False))
    )


@router.get("/me")
def me(current=Depends(get_current_user), db: psycopg2.extensions.connection = Depends(get_db)):
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            "SELECT * FROM users WHERE id = %s", (current["user_id"],)
        )
        row = cur.fetchone()
    
    if row:
        row = _check_and_refresh_suspension(db, current["user_id"], row)
        if row.get("suspended_until") and hasattr(row["suspended_until"], "isoformat"):
            row["suspended_until"] = row["suspended_until"].isoformat()
        if row.get("created_at") and hasattr(row["created_at"], "isoformat"):
            row["created_at"] = row["created_at"].isoformat()
        if row.get("updated_at") and hasattr(row["updated_at"], "isoformat"):
            row["updated_at"] = row["updated_at"].isoformat()

    role = row.get("role", "athlete") if row else "athlete"
    avatar_url = row.get("avatar_url") if row else None
    onboarding_completed = True if role == "admin" else (bool(row.get("onboarding_completed", False)) if row else False)
    v_status = row.get("verification_status") if row else "unsubmitted"
    if v_status == "approved":
        coach_verified = True
    elif v_status in ("pending", "rejected", "unsubmitted"):
        coach_verified = False
    else:
        coach_verified = bool(row.get("coach_verified", False) or row.get("approved", False)) if row else False
        v_status = "approved" if coach_verified else ("pending" if (row and row.get("cv_url")) else "unsubmitted")
    verification_status = v_status

    is_suspended = bool(row.get("is_suspended", False)) if row else False
    suspension_reason = row.get("suspension_reason") if row else None
    suspended_until = row.get("suspended_until") if row else None

    profile_dict = dict(row) if row else None
    if profile_dict:
        profile_dict["coach_verified"] = coach_verified
        profile_dict["approved"] = coach_verified
        profile_dict["verification_status"] = verification_status

    return {
        **current, 
        "role": role, 
        "avatar_url": avatar_url, 
        "onboarding_completed": onboarding_completed,
        "coach_verified": coach_verified,
        "verification_status": verification_status,
        "is_suspended": is_suspended,
        "suspension_reason": suspension_reason,
        "suspended_until": suspended_until,
        "profile": profile_dict
    }
