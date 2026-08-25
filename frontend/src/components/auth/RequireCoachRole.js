import React, { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../utils/auth";
import { api } from "../../utils/api";

/**
 * RequireCoachRole — Route guard ensuring only coach-role users can access coach workspace sections.
 * Redirects athlete-role users back to /coach (the athlete-facing My Coach view).
 */
export default function RequireCoachRole({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const [statusInfo, setStatusInfo] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;
    api.getCoachVerificationStatus()
      .then((res) => {
        if (isMounted) {
          setStatusInfo(res);
          setChecking(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setStatusInfo(null);
          setChecking(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [user]);

  if (checking) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-2)" }}>
        Loading Coach Workspace...
      </div>
    );
  }

  const role = statusInfo?.role || user?.role || user?.profile?.role || "athlete";
  const isApproved = statusInfo
    ? (statusInfo.verification_status === "approved" || (!statusInfo.verification_status && (statusInfo.approved || statusInfo.coach_verified)))
    : (user?.verification_status === "approved" || (!user?.verification_status && (user?.approved || user?.coach_verified)));

  if (role !== "coach") {
    return <Navigate to="/coach" replace state={{ from: location }} />;
  }

  if (!isApproved && location.pathname !== "/coach") {
    return <Navigate to="/coach" replace state={{ from: location }} />;
  }

  return children;
}
