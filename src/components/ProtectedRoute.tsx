/**
 * ProtectedRoute — guards admin-only pages.
 *
 * Reads ts_admin_session from sessionStorage.
 * Adds a 30-minute idle timeout: after 25 min of inactivity a warning banner
 * appears; after 30 min the session is cleared and the user is redirected to /auth.
 * Any mouse/key/touch event resets the idle timer.
 */
import { useEffect, useState, useRef, useCallback } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { type AdminRole } from "@/lib/adminStore";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { getPromotedMembers } from "@/lib/services/hierarchyService";

const IDLE_WARN_MS  = 25 * 60 * 1000;  // 25 min → show warning
const IDLE_LIMIT_MS = 30 * 60 * 1000;  // 30 min → force logout

interface ProtectedRouteProps {
  children: React.ReactNode | ((props: { userRole: AdminRole }) => React.ReactNode);
  requireAdmin?: boolean;
}

const ProtectedRoute = ({ children, requireAdmin = false }: ProtectedRouteProps) => {
  const [loading, setLoading]   = useState(true);
  const [userRole, setUserRole] = useState<AdminRole | null>(null);
  const [showWarn, setShowWarn] = useState(false);
  const navigate = useNavigate();

  const warnTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doLogout = useCallback(() => {
    sessionStorage.removeItem("ts_admin_session");
    sessionStorage.removeItem("ts_admin_token");
    sessionStorage.removeItem("ts_active_session_id");
    navigate("/auth", { replace: true });
  }, [navigate]);

  const resetIdle = useCallback(() => {
    setShowWarn(false);
    if (warnTimer.current)  clearTimeout(warnTimer.current);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    warnTimer.current  = setTimeout(() => setShowWarn(true),  IDLE_WARN_MS);
    logoutTimer.current = setTimeout(doLogout,                 IDLE_LIMIT_MS);
  }, [doLogout]);

  useEffect(() => {
    let isMounted = true;

    const verifySession = async () => {
      const raw = sessionStorage.getItem("ts_admin_session");
      const token = sessionStorage.getItem("ts_admin_token");

      if (!raw) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const session = JSON.parse(raw);
        const validRoles = ["super_admin", "admin", "member", "faculty"];
        if (!session || !validRoles.includes(session.role)) {
          doLogout();
          if (isMounted) setLoading(false);
          return;
        }

        // Check if session is a Promoted Leader
        const isLeaderSession =
          Boolean(session.isPromotedLeader || session.loginType === "leader_key") ||
          Boolean(token?.startsWith("ts_leader_"));

        if (isLeaderSession) {
          const promoted = getPromotedMembers();
          const match = promoted.find(
            (m) =>
              (session.userId && (m.studentId === session.userId || m.id === session.userId)) ||
              (session.name && m.name.toLowerCase() === session.name.toLowerCase()) ||
              (session.name && m.githubUsername.toLowerCase() === session.name.toLowerCase())
          );
          if (match && match.tier <= 2) {
            if (isMounted) {
              const mapped: AdminRole = match.tier === 1 ? "super_admin" : "member";
              setUserRole(mapped);
              setLoading(false);
            }
            return;
          }
        }

        const isLocalOrSuperAdmin =
          session.role === "super_admin" ||
          session.userId === "super_admin" ||
          Boolean(token?.startsWith("ts_local_"));

        // Server-backed verification if connected to Supabase
        if (isSupabaseConfigured()) {
          if (!token) {
            if (!isLocalOrSuperAdmin) {
              doLogout();
              if (isMounted) setLoading(false);
              return;
            }
          } else {
            // Pass the stored token as x-admin-token header so the RPC
            // can look it up in admin_sessions table (SQL reads request.headers)
            const rpcClient = supabase.rpc as any;
            const { data: isValid, error } = await rpcClient("is_admin_session", {}, {
              headers: { "x-admin-token": token },
            });

            if (!isLocalOrSuperAdmin && (error || !isValid)) {
              // Expired, revoked, or forged token
              doLogout();
              if (isMounted) setLoading(false);
              return;
            }

            // If session claims to be super_admin, verify via is_super_admin_session
            if (session.role === "super_admin" && !isLocalOrSuperAdmin) {
              const { data: isSuper, error: superErr } = await rpcClient("is_super_admin_session", {}, {
                headers: { "x-admin-token": token },
              });
              if (superErr || !isSuper) {
                // Downgrade to member to prevent privilege escalation
                session.role = "member";
                sessionStorage.setItem("ts_admin_session", JSON.stringify(session));
              }
            }
          }
        }

        if (isMounted) {
          const normalized: AdminRole = session.role === "admin" ? "member" : (session.role as AdminRole);
          setUserRole(normalized);
          setLoading(false);
        }
      } catch (_e) {
        doLogout();
        if (isMounted) setLoading(false);
      }
    };

    verifySession();

    return () => {
      isMounted = false;
    };
  }, [doLogout]);

  // Start idle timers once authenticated
  useEffect(() => {
    if (!userRole) return;
    resetIdle();
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    events.forEach(ev => window.addEventListener(ev, resetIdle, { passive: true }));
    return () => {
      events.forEach(ev => window.removeEventListener(ev, resetIdle));
      if (warnTimer.current)  clearTimeout(warnTimer.current);
      if (logoutTimer.current) clearTimeout(logoutTimer.current);
    };
  }, [userRole, resetIdle]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!userRole) return <Navigate to="/auth" replace />;
  if (requireAdmin && !userRole) return <Navigate to="/auth" replace />;

  return (
    <>
      {/* Idle warning banner */}
      {showWarn && (
        <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-4 px-6 py-3 bg-amber-500 text-amber-950 text-sm font-medium shadow-lg">
          <span className="flex items-center gap-2">
            <AlertTriangle size={16} />
            Your session will expire in 5 minutes due to inactivity.
          </span>
          <Button size="sm" variant="outline"
            className="border-amber-800 text-amber-950 hover:bg-amber-600 h-7 text-xs"
            onClick={resetIdle}>
            Stay Logged In
          </Button>
        </div>
      )}

      {typeof children === "function" && userRole
        ? <>{children({ userRole })}</>
        : <>{children}</>
      }
    </>
  );
};

export default ProtectedRoute;
