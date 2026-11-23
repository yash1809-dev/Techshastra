import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  isSuperAdminSetupNeeded,
  setSuperAdminCredentials,
  verifySuperAdmin,
  type AdminCredential,
  subscribeToAdminLoginRequests,
  approveAdminLoginRequest,
  rejectAdminLoginRequest,
  type AdminLoginRequest,
  getAdminUsers,
  blockAdmin,
  unblockAdmin,
  deleteAdminCredential,
  createAdminCredential,
} from "@/lib/adminStore";
import {
  getPendingAdminLoginRequestsDB,
  createAdminCredentialDB,
  getAdminCredentialsDB,
  setAdminCredentialBlockDB,
  deleteAdminCredentialDB,
  registerAdminSession,
  logAdminAction,
} from "@/lib/services/adminService";
import { supabase } from "@/lib/supabase/client";
import { addLogEntry, getLogEntries, type LogEntry } from "@/lib/activityLogStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  KeyRound,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  LogOut,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Phone,
  Calendar,
  Laptop,
  Check,
  X,
  UserCheck,
  UserX,
  Trash2,
  AlertTriangle,
  History,
  Settings,
  Sparkles,
  Code2,
  Crown,
} from "lucide-react";
import AdminProblemsTab from "@/components/admin/AdminProblemsTab";
import AdminRolePromotionsTab from "@/components/admin/AdminRolePromotionsTab";
import AdminLeadersTab from "@/components/admin/AdminLeadersTab";

type SuperAdminViewState = "initializing" | "setup" | "login" | "dashboard";

export default function SuperAdmin() {
  const [viewState, setViewState] = useState<SuperAdminViewState>("initializing");
  const [loading, setLoading] = useState(false);
  const [superAdminName, setSuperAdminName] = useState("Super Admin");

  // Setup Form State
  const [setupName, setSetupName] = useState("");
  const [setupMobile, setSetupMobile] = useState("");
  const [setupDob, setSetupDob] = useState("");
  const [setupPasscode, setSetupPasscode] = useState("");
  const [setupConfirm, setSetupConfirm] = useState("");

  // Login Form State
  const [loginName, setLoginName] = useState("");
  const [loginMobile, setLoginMobile] = useState("");
  const [loginDob, setLoginDob] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);

  // Dashboard Data State
  const [pendingRequests, setPendingRequests] = useState<AdminLoginRequest[]>([]);
  const [allRequests, setAllRequests] = useState<AdminLoginRequest[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminCredential[]>([]);
  const [auditLogs, setAuditLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState("requests");

  const navigate = useNavigate();
  const { toast } = useToast();

  // ── 1. INITIALIZATION & SESSION CHECK ─────────────────────────────────────
  const checkInitialState = useCallback(async () => {
    // Check if an existing Super Admin session is already active in sessionStorage
    const rawSession = sessionStorage.getItem("ts_admin_session");
    if (rawSession) {
      try {
        const session = JSON.parse(rawSession);
        if (session.role === "super_admin") {
          setSuperAdminName(session.name || "Super Admin");
          setViewState("dashboard");
          return;
        }
      } catch (_e) {
        // invalid session
      }
    }

    // Check if Super Admin setup is needed globally
    try {
      const needsSetup = await isSuperAdminSetupNeeded();
      setViewState(needsSetup ? "setup" : "login");
    } catch (_err) {
      // Default to login if check fails to prevent open setup
      setViewState("login");
    }
  }, []);

  useEffect(() => {
    checkInitialState();
  }, [checkInitialState]);

  // ── 2. LOAD DASHBOARD DATA ──────────────────────────────────────────────
  const loadDashboardData = useCallback(async () => {
    try {
      // Load admin credentials from DB
      const dbUsers = await getAdminCredentialsDB();
      if (dbUsers.length > 0) {
        setAdminUsers(
          dbUsers.map((u) => ({
            id: u.id,
            name: u.name,
            mobile: u.mobile,
            dob: u.dob,
            email: u.email || undefined,
            role: u.role as any,
            is_blocked: u.is_blocked,
            blocked_at: u.blocked_at || undefined,
            block_reason: u.block_reason || undefined,
            created_at: u.created_at,
          }))
        );
      } else {
        const localUsers = await getAdminUsers();
        setAdminUsers(localUsers);
      }

      // Load DB pending login requests
      const dbRequests = await getPendingAdminLoginRequestsDB();
      if (dbRequests && dbRequests.length > 0) {
        const mapped: AdminLoginRequest[] = dbRequests.map((r) => ({
          id: r.id,
          adminId: r.admin_id,
          adminName: r.admin_name,
          mobile: r.mobile,
          dob: r.dob,
          role: "admin",
          device: r.device || "Unknown Device",
          status: r.status as any,
          requestedAt: r.requested_at,
          respondedAt: r.responded_at || undefined,
          respondedBy: r.responded_by || undefined,
          isNewRegistration: r.is_new_registration ?? false,
        }));
        setPendingRequests(mapped);
      } else {
        setPendingRequests([]);
      }

      // Load activity logs
      setAuditLogs(getLogEntries());
    } catch (_err) {
      console.warn("Failed to load dashboard data:", _err);
    }
  }, []);

  // ── 3. REALTIME SUBSCRIPTION FOR REQUESTS ─────────────────────────────────
  useEffect(() => {
    if (viewState !== "dashboard") return;
    loadDashboardData();

    // Subscribe to realtime updates for incoming admin requests
    const unsubscribe = subscribeToAdminLoginRequests((updated) => {
      setAllRequests(updated);
      setPendingRequests(updated.filter((r) => r.status === "pending"));
    });

    return () => unsubscribe();
  }, [viewState, loadDashboardData]);

  // ── 4. HANDLE ONE-TIME SETUP ──────────────────────────────────────────────
  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupName.trim() || !setupMobile.trim() || !setupDob) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }

    if (setupPasscode && setupPasscode !== setupConfirm) {
      toast({ title: "Passcodes do not match", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Check again to avoid race conditions
      const stillNeeds = await isSuperAdminSetupNeeded();
      if (!stillNeeds) {
        toast({
          title: "Setup Already Configured",
          description: "Super Admin has already been configured. Please sign in.",
          variant: "destructive",
        });
        setViewState("login");
        setLoading(false);
        return;
      }

      await setSuperAdminCredentials(setupName.trim(), setupMobile.trim(), setupDob);

      // Authenticate via secure RPC to acquire valid admin session token for RLS
      try {
        const { data: authRes } = await (supabase.rpc as any)("verify_admin_login", {
          p_name: setupName.trim(),
          p_mobile: setupMobile.trim(),
          p_dob: setupDob,
        });
        if (authRes?.session_token) {
          sessionStorage.setItem("ts_admin_token", authRes.session_token);
        }
        if (authRes?.session_id) {
          sessionStorage.setItem("ts_active_session_id", authRes.session_id);
        }
      } catch (_e) {}

      // Create Super Admin session
      sessionStorage.setItem(
        "ts_admin_session",
        JSON.stringify({
          userId: "super_admin",
          role: "super_admin",
          name: setupName.trim(),
          authenticated_at: new Date().toISOString(),
        })
      );

      setSuperAdminName(setupName.trim());
      addLogEntry({
        actor: setupName.trim(),
        action: "Initialized Super Admin Portal Credentials",
        type: "create_credential",
        revertible: false,
      });

      toast({
        title: "Super Admin Initialized! 🎉",
        description: "Your master credentials are now active and setup is permanently locked.",
      });

      setViewState("dashboard");
    } catch (err: any) {
      toast({
        title: "Setup Error",
        description: err.message || "Failed to set up Super Admin.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ── 5. HANDLE SUPER ADMIN LOGIN ───────────────────────────────────────────
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginName.trim() || !loginMobile.trim() || !loginDob) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const result = await verifySuperAdmin(loginName.trim(), loginMobile.trim(), loginDob);

      if (!result.success) {
        setFailedAttempts((prev) => prev + 1);
        toast({
          title: "Access Denied ⛔",
          description: "Invalid Master Name, Mobile, or Date of Birth. Unauthorized attempt recorded.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const activeName = result.name || loginName.trim();
      setSuperAdminName(activeName);

      // Save Super Admin session
      sessionStorage.setItem(
        "ts_admin_session",
        JSON.stringify({
          userId: "super_admin",
          role: "super_admin",
          name: activeName,
          authenticated_at: new Date().toISOString(),
        })
      );

      await registerAdminSession(activeName, null, "super_admin").catch(() => {});
      logAdminAction(
        "super_admin",
        activeName,
        "super_admin",
        "Logged into Super Admin Portal",
        "admin_sessions"
      ).catch(() => {});

      toast({
        title: "Welcome, Super Admin",
        description: `Verified clearance level 5: ${activeName}`,
      });

      setViewState("dashboard");
    } catch (err: any) {
      toast({
        title: "Verification Error",
        description: err.message || "Failed to verify credentials.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ── 6. HANDLE APPROVE ADMIN REGISTRATION / LOGIN ─────────────────────────
  const handleApprove = async (request: AdminLoginRequest) => {
    try {
      // 1. Always ensure admin account is provisioned in Supabase PostgreSQL
      try {
        await createAdminCredentialDB({
          name: request.adminName.trim(),
          mobile: request.mobile.trim(),
          dob: request.dob.trim(),
          role: "admin",
          is_blocked: false,
        });
      } catch (dbErr) {
        console.warn("createAdminCredentialDB in handleApprove:", dbErr);
      }

      // Also persist to local credentials store
      try {
        createAdminCredential(
          request.adminName.trim(),
          request.mobile.trim(),
          request.dob.trim(),
          "admin"
        );
      } catch (_storeErr) {}

      // 2. Mark request approved in store and DB
      approveAdminLoginRequest(request.id, superAdminName);

      addLogEntry({
        actor: superAdminName,
        action: `Approved admin access for: ${request.adminName} (${request.mobile})`,
        type: "create_credential",
        revertible: false,
      });

      toast({
        title: "Admin Approved! ✓",
        description: `${request.adminName} has been granted Admin access. Their account is now active.`,
      });

      // Reload dashboard lists
      loadDashboardData();
    } catch (err: any) {
      toast({
        title: "Approval Failed",
        description: err.message || "Failed to approve request.",
        variant: "destructive",
      });
    }
  };

  // ── 7. HANDLE REJECT ADMIN REQUEST ───────────────────────────────────────
  const handleReject = async (requestId: string, adminName: string) => {
    // Optimistically remove from state immediately
    setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
    try {
      rejectAdminLoginRequest(requestId, superAdminName);

      addLogEntry({
        actor: superAdminName,
        action: `Rejected admin access request for: ${adminName}`,
        type: "delete_credential",
        revertible: false,
      });

      toast({
        title: "Request Rejected",
        description: `Admin request for ${adminName} has been declined.`,
      });

      loadDashboardData();
    } catch (err: any) {
      toast({
        title: "Rejection Failed",
        description: err.message || "Failed to reject request.",
        variant: "destructive",
      });
    }
  };

  // ── 8. ADMIN DIRECTORY ACTIONS ───────────────────────────────────────────
  const handleToggleBlock = async (user: AdminCredential) => {
    const newStatus = !user.is_blocked;
    try {
      await setAdminCredentialBlockDB(user.id, newStatus, undefined, user.mobile);
      if (newStatus) {
        blockAdmin(user.id, "Suspended by Super Admin");
        addLogEntry({
          actor: superAdminName,
          action: `Suspended admin account: ${user.name} (${user.mobile})`,
          type: "create_credential",
          revertible: false,
        });
      } else {
        unblockAdmin(user.id);
        addLogEntry({
          actor: superAdminName,
          action: `Reactivated admin account: ${user.name} (${user.mobile})`,
          type: "create_credential",
          revertible: false,
        });
      }
      toast({
        title: newStatus ? `Admin Suspended` : `Admin Reactivated`,
        description: `${user.name} is now ${newStatus ? "blocked from logging in" : "active"}.`,
      });
      loadDashboardData();
    } catch (_err) {
      toast({ title: "Failed to update admin status", variant: "destructive" });
    }
  };

  const handleDeleteAdmin = async (user: AdminCredential) => {
    if (!confirm(`Are you sure you want to permanently revoke admin access for ${user.name}?`)) {
      return;
    }
    try {
      await deleteAdminCredentialDB(user.id, user.mobile);
      deleteAdminCredential(user.id);
      addLogEntry({
        actor: superAdminName,
        action: `Permanently deleted admin account: ${user.name} (${user.mobile})`,
        type: "delete_credential",
        revertible: false,
      });
      toast({
        title: "Admin Removed",
        description: `${user.name} has been removed from admins.`,
      });
      loadDashboardData();
    } catch (_err) {
      toast({ title: "Failed to remove admin", variant: "destructive" });
    }
  };

  const handleSignOut = () => {
    sessionStorage.removeItem("ts_admin_session");
    setViewState("login");
    toast({ title: "Signed Out", description: "Super Admin session ended securely." });
  };

  // ── 9. RENDER INITIALIZING ────────────────────────────────────────────────
  if (viewState === "initializing") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <p className="text-sm font-medium text-muted-foreground">Checking Super Admin Security Clearance...</p>
        </div>
      </div>
    );
  }

  // ── 10. RENDER ONE-TIME SETUP ─────────────────────────────────────────────
  if (viewState === "setup") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-amber-500/10 p-4">
        <Card className="w-full max-w-lg border-amber-500/40 shadow-2xl shadow-amber-500/10 animate-in fade-in zoom-in-95 duration-200">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-inner">
                <KeyRound className="w-7 h-7" />
              </div>
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-600 border border-amber-500/30 mb-2">
                <Sparkles className="w-3 h-3" /> One-Time Initialization
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">Super Admin Setup</CardTitle>
              <CardDescription className="text-xs max-w-md mx-auto mt-1">
                Configure your Master Super Admin account. Once initialized, this setup page will be{" "}
                <strong className="text-foreground">permanently locked</strong> across all devices.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSetupSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Master Full Name</Label>
                <Input
                  value={setupName}
                  onChange={(e) => setSetupName(e.target.value)}
                  placeholder="e.g. Master Admin"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Master Mobile Number</Label>
                  <Input
                    value={setupMobile}
                    onChange={(e) => setSetupMobile(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="10-digit number"
                    maxLength={10}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Date of Birth</Label>
                  <Input
                    type="date"
                    value={setupDob}
                    onChange={(e) => setSetupDob(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-lg border border-amber-500/20 bg-amber-500/5 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-500" /> High Security Note:
                </p>
                <p>
                  These credentials give unrestricted Super Admin clearance to approve admin registrations, delete
                  records, and manage the site. Ensure your mobile number and DOB are remembered.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white font-medium"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Initializing...
                  </span>
                ) : (
                  "Complete Setup & Lock Portal"
                )}
              </Button>

              <div className="pt-2 text-center">
                <Link
                  to="/"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Return to TechShastra Website
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── 11. RENDER SUPER ADMIN LOGIN ──────────────────────────────────────────
  if (viewState === "login") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="w-full max-w-md border-primary/20 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary shadow-inner">
                <ShieldCheck className="w-7 h-7" />
              </div>
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 mb-2">
                Level 5 Clearance · Restricted Area
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">Super Admin Portal</CardTitle>
              <CardDescription className="text-xs">
                Enter your Master credentials to access the Super Admin Command Center.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Master Name / ID</Label>
                <Input
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                  placeholder="Master Admin Name"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Master Mobile Number</Label>
                <Input
                  value={loginMobile}
                  onChange={(e) => setLoginMobile(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="Registered Mobile"
                  maxLength={10}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Date of Birth</Label>
                <Input
                  type="date"
                  value={loginDob}
                  onChange={(e) => setLoginDob(e.target.value)}
                  required
                />
              </div>

              {failedAttempts > 0 && (
                <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-xs text-destructive flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>Invalid credentials attempt #{failedAttempts}. Access is strictly monitored.</span>
                </div>
              )}

              <Button type="submit" className="w-full gap-2 font-medium" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Verifying Clearance...
                  </span>
                ) : (
                  <>
                    <Lock className="w-4 h-4" /> Authenticate Super Admin
                  </>
                )}
              </Button>

              <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground border-t border-border/60">
                <Link to="/" className="hover:text-foreground transition-colors">
                  ← Back to Home
                </Link>
                <Link to="/admin" className="hover:text-foreground text-primary transition-colors">
                  Staff / Admin Portal →
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── 12. RENDER SUPER ADMIN DASHBOARD ──────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Top Super Admin Executive Header */}
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="font-bold text-xs sm:text-base leading-tight truncate">
                  Super Admin <span className="hidden sm:inline">Command Center</span>
                </h1>
                <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[9px] sm:text-[10px] shrink-0" variant="outline">
                  Level 5
                </Badge>
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">Logged in as {superAdminName}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-1 sm:gap-2 text-xs px-2 sm:px-3 h-8"
              onClick={() => navigate("/admin")}
            >
              <ExternalLink className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline">Open </span><span className="hidden xs:inline">Main </span>Admin
            </Button>
            <Button variant="ghost" size="sm" className="gap-1 sm:gap-1.5 text-xs text-muted-foreground px-2 sm:px-3 h-8" onClick={handleSignOut}>
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="container mx-auto px-4 py-6 sm:py-8 max-w-6xl space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">Pending Access Requests</p>
                <p className="text-2xl font-bold mt-1 text-foreground">{pendingRequests.length}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Registered Admins</p>
                <p className="text-2xl font-bold mt-1 text-foreground">
                  {adminUsers.filter((u) => u.role === "admin").length}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Security State</p>
                <p className="text-sm font-semibold mt-1 text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Locked & Guarded
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dashboard Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="w-full flex overflow-x-auto no-scrollbar justify-start bg-muted/60 p-1 border border-border/60">
            <TabsTrigger value="requests" className="gap-1.5 sm:gap-2 text-xs shrink-0">
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Admin </span>Access Requests
              {pendingRequests.length > 0 && (
                <Badge className="h-4 px-1.5 text-[10px] bg-amber-500 text-white ml-1">
                  {pendingRequests.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="directory" className="gap-1.5 sm:gap-2 text-xs shrink-0">
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Admin </span>Directory
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-1.5 sm:gap-2 text-xs shrink-0">
              <History className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Audit </span>Logs
            </TabsTrigger>
            <TabsTrigger value="problems" className="gap-1.5 sm:gap-2 text-xs shrink-0">
              <Code2 className="w-3.5 h-3.5" />
              <span>Problems & Tasks</span>
            </TabsTrigger>
            <TabsTrigger value="promotions" className="gap-1.5 sm:gap-2 text-xs shrink-0 bg-amber-500/10 text-amber-500 font-medium">
              <Crown className="w-3.5 h-3.5" />
              <span>Promotions & Applications</span>
            </TabsTrigger>
            <TabsTrigger value="leaders" className="gap-1.5 sm:gap-2 text-xs shrink-0">
              <Users className="w-3.5 h-3.5" />
              <span>Leaders & Directors</span>
            </TabsTrigger>
          </TabsList>

          {/* ── TAB 1: ADMIN ACCESS REQUESTS ── */}
          <TabsContent value="requests" className="space-y-4">
            <Card className="border-amber-500/30">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-amber-500" />
                      Pending Admin Registration & Login Requests
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      Review requests from individuals wanting to join or access the admin panel. Once approved, their account is activated immediately.
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={loadDashboardData}>
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {pendingRequests.length === 0 ? (
                  <div className="py-12 text-center border border-dashed border-border/80 rounded-xl bg-muted/20 space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto opacity-80" />
                    <p className="font-semibold text-sm">All Caught Up!</p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      There are no pending admin requests right now. When someone registers at <code className="text-primary font-mono text-[11px]">/admin</code>, their request will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60 rounded-xl border border-amber-500/30 overflow-hidden bg-background">
                    {pendingRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/20 transition-colors"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{req.adminName}</span>
                            {req.isNewRegistration ? (
                              <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/30">
                                New Registration
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                                Login Request
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground font-mono">
                              ID: {req.id.slice(-8).toUpperCase()}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5 text-primary" /> {req.mobile}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-primary" /> DOB: {req.dob}
                            </span>
                            <span className="flex items-center gap-1">
                              <Laptop className="w-3.5 h-3.5 text-primary" /> {req.device || "Browser"}
                            </span>
                            <span className="flex items-center gap-1 text-[11px]">
                              <Clock className="w-3 h-3" />
                              {new Date(req.requestedAt).toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:flex items-center gap-2 flex-shrink-0 w-full sm:w-auto pt-2 sm:pt-0">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs h-9 sm:h-8"
                            onClick={() => handleApprove(req)}
                          >
                            <Check className="w-3.5 h-3.5" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-1.5 text-xs h-9 sm:h-8"
                            onClick={() => handleReject(req.id, req.adminName)}
                          >
                            <X className="w-3.5 h-3.5" /> Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB 2: ADMIN DIRECTORY ── */}
          <TabsContent value="directory" className="space-y-4">
            <Card className="border-border">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" />
                      Registered Admins Directory
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Manage all approved admins with access to the TECHSHASTRA admin dashboard.
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {adminUsers.length} Total Users
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border rounded-xl border border-border/70 overflow-hidden bg-background">
                  {adminUsers.map((user) => {
                    const isSelf = user.role === "super_admin";
                    return (
                      <div
                        key={user.id}
                        className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          user.is_blocked ? "bg-destructive/5 opacity-70" : ""
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{user.name}</span>
                            <Badge
                              variant={user.role === "super_admin" ? "default" : "outline"}
                              className={`text-[10px] ${
                                user.role === "super_admin"
                                  ? "bg-amber-500 text-white border-transparent"
                                  : "text-foreground"
                              }`}
                            >
                              {user.role === "super_admin" ? "⭐ Super Admin" : "Admin"}
                            </Badge>
                            {user.is_blocked && (
                              <Badge variant="destructive" className="text-[10px]">
                                Suspended
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span>📱 {user.mobile}</span>
                            <span>🎂 DOB: {user.dob}</span>
                            {user.created_at && (
                              <span>Joined: {new Date(user.created_at).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>

                        {!isSelf && (
                          <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-1 sm:pt-0">
                            <Button
                              size="sm"
                              variant={user.is_blocked ? "outline" : "secondary"}
                              className="text-xs h-8 gap-1.5 flex-1 sm:flex-initial"
                              onClick={() => handleToggleBlock(user)}
                            >
                              {user.is_blocked ? (
                                <>
                                  <UserCheck className="w-3.5 h-3.5 text-emerald-500" /> Reactivate
                                </>
                              ) : (
                                <>
                                  <UserX className="w-3.5 h-3.5 text-amber-500" /> Suspend
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-8 text-destructive hover:bg-destructive/10 shrink-0"
                              onClick={() => handleDeleteAdmin(user)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB 3: AUDIT LOGS ── */}
          <TabsContent value="logs" className="space-y-4">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" /> Security & Activity Logs
                </CardTitle>
                <CardDescription className="text-xs">
                  Complete record of credential updates, admin logins, and system changes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {auditLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No activity recorded yet.</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {auditLogs.slice(0, 30).map((log, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg border border-border/60 bg-muted/20 flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5">
                          <p className="font-medium text-foreground">{log.action}</p>
                          <p className="text-muted-foreground text-[11px]">By: {log.actor}</p>
                        </div>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {new Date(log.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB 4: PROBLEMS & TASKS MANAGEMENT ── */}
          <TabsContent value="problems" className="space-y-4">
            <AdminProblemsTab currentAdminName={superAdminName || "Super Admin"} isSuperAdmin={true} />
          </TabsContent>

          {/* ── TAB 5: LEADERSHIP ROLE PROMOTIONS & SUCCESSION ── */}
          <TabsContent value="promotions" className="space-y-4">
            <AdminRolePromotionsTab currentAdminName={superAdminName || "Super Admin"} isSuperAdmin={true} />
          </TabsContent>

          {/* ── TAB 6: LEADERS & DIRECTORS ── */}
          <TabsContent value="leaders" className="space-y-4">
            <AdminLeadersTab currentAdminName={superAdminName || "Super Admin"} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
