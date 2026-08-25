"""
HPI — Admin Repository
Handles database operations for admin actions, coach verifications, user moderation, report management, and statistics.
"""

from typing import Any, Dict, List, Optional, Tuple
import psycopg2
from repositories.base import BaseRepository


class AdminRepository(BaseRepository[Dict[str, Any]]):

    def get_by_id(self, record_id: int) -> Optional[Dict[str, Any]]:
        return self._fetchone("SELECT * FROM admin_actions WHERE id = %s", (record_id,))

    def get_all(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        return self._fetchall("SELECT * FROM admin_actions ORDER BY id DESC LIMIT %s OFFSET %s", (limit, offset))

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self.log_action(
            admin_id=data["admin_id"],
            action_type=data["action_type"],
            target_type=data["target_type"],
            target_id=data.get("target_id"),
            reason=data.get("reason")
        )

    def delete(self, record_id: int) -> bool:
        cur = self._execute("DELETE FROM admin_actions WHERE id = %s", (record_id,))
        self.conn.commit()
        return cur.rowcount > 0

    def log_action(
        self,
        admin_id: int,
        action_type: str,
        target_type: str,
        target_id: Optional[int] = None,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """Record an admin action in the audit log."""
        sql = """
            INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, reason, created_at)
            VALUES (%s, %s, %s, %s, %s, NOW())
            RETURNING id, admin_id, action_type, target_type, target_id, reason, created_at
        """
        row = self._fetchone(sql, (admin_id, action_type, target_type, target_id, reason))
        self.conn.commit()
        return row

    def get_stats(self) -> Dict[str, int]:
        """Get aggregate counts for admin overview cards."""
        total_users = self._fetchone("SELECT COUNT(*) as cnt FROM users")["cnt"]
        pending_verifications = self._fetchone("SELECT COUNT(*) as cnt FROM coach_verifications WHERE status = 'pending'")["cnt"]
        open_reports = self._fetchone("SELECT COUNT(*) as cnt FROM reports WHERE status IN ('open', 'in_review')")["cnt"]
        active_coaches = self._fetchone("""
            SELECT COUNT(*) as cnt FROM users 
            WHERE role = 'coach' 
              AND (verification_status = 'approved' OR (verification_status IS NULL AND (coach_verified = TRUE OR approved = TRUE)))
              AND (verification_status IS NULL OR verification_status NOT IN ('pending', 'rejected', 'unsubmitted'))
        """)["cnt"]

        return {
            "total_users": total_users,
            "pending_verifications": pending_verifications,
            "open_reports": open_reports,
            "active_coaches": active_coaches
        }

    def get_coach_verifications(
        self,
        status: Optional[str] = None,
        page: int = 1,
        limit: int = 20
    ) -> Dict[str, Any]:
        offset = (page - 1) * limit
        where_clauses = []
        params: List[Any] = []

        if status:
            where_clauses.append("cv.status = %s")
            params.append(status)

        where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

        count_sql = f"SELECT COUNT(*) as cnt FROM coach_verifications cv {where_sql}"
        total = self._fetchone(count_sql, tuple(params))["cnt"]

        query_sql = f"""
            SELECT 
                cv.*,
                u.name as coach_name,
                u.email as coach_email,
                u.avatar_url as coach_avatar,
                u.experience as coach_experience,
                u.goal as coach_goal,
                u.age as coach_age,
                u.sex as coach_sex,
                u.bio as coach_bio,
                u.cv_url as coach_cv_url,
                rb.name as reviewer_name
            FROM coach_verifications cv
            JOIN users u ON cv.coach_id = u.id
            LEFT JOIN users rb ON cv.reviewed_by = rb.id
            {where_sql}
            ORDER BY cv.submitted_at DESC
            LIMIT %s OFFSET %s
        """
        params.extend([limit, offset])
        rows = self._fetchall(query_sql, tuple(params))
        for r in rows:
            if r.get("submitted_at"):
                r["submitted_at"] = r["submitted_at"].isoformat()
            if r.get("reviewed_at"):
                r["reviewed_at"] = r["reviewed_at"].isoformat()

        return {"items": rows, "total": total, "page": page, "limit": limit}

    def get_coach_verification_detail(self, verification_id: int) -> Optional[Dict[str, Any]]:
        sql = """
            SELECT 
                cv.*,
                u.name as coach_name,
                u.email as coach_email,
                u.avatar_url as coach_avatar,
                u.experience as coach_experience,
                u.goal as coach_goal,
                u.age as coach_age,
                u.sex as coach_sex,
                u.bio as coach_bio,
                u.cv_url as coach_cv_url,
                u.onboarding_data as coach_onboarding,
                rb.name as reviewer_name
            FROM coach_verifications cv
            JOIN users u ON cv.coach_id = u.id
            LEFT JOIN users rb ON cv.reviewed_by = rb.id
            WHERE cv.id = %s
        """
        row = self._fetchone(sql, (verification_id,))
        if row:
            if row.get("submitted_at"):
                row["submitted_at"] = row["submitted_at"].isoformat()
            if row.get("reviewed_at"):
                row["reviewed_at"] = row["reviewed_at"].isoformat()
        return row

    def approve_coach_verification(self, verification_id: int, admin_id: int) -> Optional[Dict[str, Any]]:
        v = self._fetchone("SELECT coach_id FROM coach_verifications WHERE id = %s", (verification_id,))
        if not v:
            return None
        coach_id = v["coach_id"]

        with self._cursor() as cur:
            cur.execute("""
                UPDATE coach_verifications
                SET status = 'approved', reviewed_at = NOW(), reviewed_by = %s, rejection_reason = NULL
                WHERE id = %s
            """, (admin_id, verification_id))

            cur.execute("""
                UPDATE users
                SET role = 'coach', coach_verified = TRUE, approved = TRUE, verification_status = 'approved', rejection_reason = NULL
                WHERE id = %s
            """, (coach_id,))

        self.conn.commit()
        return self.get_coach_verification_detail(verification_id)

    def reject_coach_verification(self, verification_id: int, admin_id: int, reason: str) -> Optional[Dict[str, Any]]:
        v = self._fetchone("SELECT coach_id FROM coach_verifications WHERE id = %s", (verification_id,))
        if not v:
            return None
        coach_id = v["coach_id"]

        with self._cursor() as cur:
            cur.execute("""
                UPDATE coach_verifications
                SET status = 'rejected', reviewed_at = NOW(), reviewed_by = %s, rejection_reason = %s
                WHERE id = %s
            """, (admin_id, reason, verification_id))

            cur.execute("""
                UPDATE users
                SET coach_verified = FALSE, approved = FALSE, verification_status = 'rejected', rejection_reason = %s
                WHERE id = %s
            """, (reason, coach_id))

        self.conn.commit()
        return self.get_coach_verification_detail(verification_id)

    def get_users(
        self,
        role: Optional[str] = None,
        search: Optional[str] = None,
        status: Optional[str] = None,
        page: int = 1,
        limit: int = 20
    ) -> Dict[str, Any]:
        offset = (page - 1) * limit
        where_clauses = []
        params: List[Any] = []

        if role:
            where_clauses.append("u.role = %s")
            params.append(role)

        if status == "suspended":
            where_clauses.append("u.is_suspended = TRUE")
        elif status == "active":
            where_clauses.append("u.is_suspended = FALSE")

        if search:
            where_clauses.append("(u.name ILIKE %s OR u.email ILIKE %s)")
            term = f"%{search}%"
            params.extend([term, term])

        where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

        total = self._fetchone(f"SELECT COUNT(*) as cnt FROM users u {where_sql}", tuple(params))["cnt"]

        sql = f"""
            SELECT 
                u.id, u.auth_id, u.name, u.email, u.role, u.is_suspended, u.suspension_reason, u.suspended_until,
                u.coach_verified, u.verification_status, u.avatar_url, u.created_at, u.updated_at
            FROM users u
            {where_sql}
            ORDER BY u.id DESC
            LIMIT %s OFFSET %s
        """
        params.extend([limit, offset])
        rows = self._fetchall(sql, tuple(params))
        for r in rows:
            if r.get("created_at"):
                r["created_at"] = r["created_at"].isoformat()
            if r.get("updated_at"):
                r["updated_at"] = r["updated_at"].isoformat()
            if r.get("suspended_until"):
                r["suspended_until"] = r["suspended_until"].isoformat()

        return {"items": rows, "total": total, "page": page, "limit": limit}

    def suspend_user(
        self,
        user_id: int,
        reason: str,
        duration_days: Optional[int] = None,
        suspended_until: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        from datetime import datetime, timedelta, timezone
        
        target_until = None
        if suspended_until:
            try:
                target_until = datetime.fromisoformat(suspended_until.replace("Z", "+00:00"))
            except Exception:
                target_until = None
        elif duration_days and duration_days > 0:
            target_until = datetime.now(timezone.utc) + timedelta(days=duration_days)

        sql = """
            UPDATE users
            SET is_suspended = TRUE, suspension_reason = %s, suspended_until = %s, updated_at = NOW()
            WHERE id = %s
            RETURNING id, name, email, role, is_suspended, suspension_reason, suspended_until
        """
        row = self._fetchone(sql, (reason, target_until, user_id))
        self.conn.commit()
        if row and row.get("suspended_until"):
            row["suspended_until"] = row["suspended_until"].isoformat()
        return row

    def reinstate_user(self, user_id: int) -> Optional[Dict[str, Any]]:
        sql = """
            UPDATE users
            SET is_suspended = FALSE, suspension_reason = NULL, suspended_until = NULL, updated_at = NOW()
            WHERE id = %s
            RETURNING id, name, email, role, is_suspended, suspension_reason, suspended_until
        """
        row = self._fetchone(sql, (user_id,))
        self.conn.commit()
        return row

    def record_report_inquiry(self, report_id: int, notes: str) -> Optional[Dict[str, Any]]:
        sql = """
            UPDATE reports
            SET inquiry_sent = TRUE, inquiry_notes = %s, inquiry_at = NOW()
            WHERE id = %s
            RETURNING id
        """
        self._fetchone(sql, (notes, report_id))
        self.conn.commit()
        return self.get_report_detail(report_id)

    def get_reports(
        self,
        report_type: Optional[str] = None,
        status: Optional[str] = None,
        page: int = 1,
        limit: int = 20
    ) -> Dict[str, Any]:
        offset = (page - 1) * limit
        where_clauses = []
        params: List[Any] = []

        if report_type:
            where_clauses.append("r.report_type = %s")
            params.append(report_type)

        if status:
            where_clauses.append("r.status = %s")
            params.append(status)

        where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

        total = self._fetchone(f"SELECT COUNT(*) as cnt FROM reports r {where_sql}", tuple(params))["cnt"]

        sql = f"""
            SELECT 
                r.*,
                rep.name as reporter_name,
                rep.email as reporter_email,
                targ.name as target_user_name,
                targ.email as target_user_email,
                res.name as resolver_name
            FROM reports r
            JOIN users rep ON r.reporter_id = rep.id
            LEFT JOIN users targ ON r.target_user_id = targ.id
            LEFT JOIN users res ON r.resolved_by = res.id
            {where_sql}
            ORDER BY r.created_at DESC
            LIMIT %s OFFSET %s
        """
        params.extend([limit, offset])
        rows = self._fetchall(sql, tuple(params))
        for r in rows:
            if r.get("created_at"):
                r["created_at"] = r["created_at"].isoformat()
            if r.get("resolved_at"):
                r["resolved_at"] = r["resolved_at"].isoformat()
            if r.get("inquiry_at"):
                r["inquiry_at"] = r["inquiry_at"].isoformat()
            if r.get("inquiry_reply_at"):
                r["inquiry_reply_at"] = r["inquiry_reply_at"].isoformat()

        return {"items": rows, "total": total, "page": page, "limit": limit}

    def get_report_detail(self, report_id: int) -> Optional[Dict[str, Any]]:
        sql = """
            SELECT 
                r.*,
                rep.name as reporter_name,
                rep.email as reporter_email,
                targ.name as target_user_name,
                targ.email as target_user_email,
                res.name as resolver_name
            FROM reports r
            JOIN users rep ON r.reporter_id = rep.id
            LEFT JOIN users targ ON r.target_user_id = targ.id
            LEFT JOIN users res ON r.resolved_by = res.id
            WHERE r.id = %s
        """
        row = self._fetchone(sql, (report_id,))
        if row:
            if row.get("created_at"):
                row["created_at"] = row["created_at"].isoformat()
            if row.get("resolved_at"):
                row["resolved_at"] = row["resolved_at"].isoformat()
            if row.get("inquiry_at"):
                row["inquiry_at"] = row["inquiry_at"].isoformat()
            if row.get("inquiry_reply_at"):
                row["inquiry_reply_at"] = row["inquiry_reply_at"].isoformat()
        return row

    def resolve_report(self, report_id: int, admin_id: int, admin_notes: str) -> Optional[Dict[str, Any]]:
        sql = """
            UPDATE reports
            SET status = 'resolved', resolved_at = NOW(), resolved_by = %s, admin_notes = %s
            WHERE id = %s
            RETURNING id
        """
        self._fetchone(sql, (admin_id, admin_notes, report_id))
        self.conn.commit()
        return self.get_report_detail(report_id)

    def dismiss_report(self, report_id: int, admin_id: int, admin_notes: str) -> Optional[Dict[str, Any]]:
        sql = """
            UPDATE reports
            SET status = 'dismissed', resolved_at = NOW(), resolved_by = %s, admin_notes = %s
            WHERE id = %s
            RETURNING id
        """
        self._fetchone(sql, (admin_id, admin_notes, report_id))
        self.conn.commit()
        return self.get_report_detail(report_id)

    def get_audit_logs(
        self,
        admin_id: Optional[int] = None,
        action_type: Optional[str] = None,
        page: int = 1,
        limit: int = 20
    ) -> Dict[str, Any]:
        offset = (page - 1) * limit
        where_clauses = []
        params: List[Any] = []

        if admin_id:
            where_clauses.append("a.admin_id = %s")
            params.append(admin_id)

        if action_type:
            where_clauses.append("a.action_type = %s")
            params.append(action_type)

        where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

        total = self._fetchone(f"SELECT COUNT(*) as cnt FROM admin_actions a {where_sql}", tuple(params))["cnt"]

        sql = f"""
            SELECT 
                a.*,
                u.name as admin_name,
                u.email as admin_email
            FROM admin_actions a
            JOIN users u ON a.admin_id = u.id
            {where_sql}
            ORDER BY a.created_at DESC
            LIMIT %s OFFSET %s
        """
        params.extend([limit, offset])
        rows = self._fetchall(sql, tuple(params))
        for r in rows:
            if r.get("created_at"):
                r["created_at"] = r["created_at"].isoformat()

        return {"items": rows, "total": total, "page": page, "limit": limit}
