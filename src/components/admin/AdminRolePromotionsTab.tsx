/**
 * AdminRolePromotionsTab.tsx
 *
 * Dedicated administrative interface for Super Admin and President to:
 * 1. Review student role applications sorted & filtered by role, wing, and academic year.
 * 2. Promote applicants into official Tier 1 / Tier 2 / Tier 3 positions.
 * 3. Manage active leadership team and demote members (which immediately revokes admin keys).
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  Crown,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Filter,
  Search,
  Users,
  Briefcase,
  ArrowRight,
  ExternalLink,
  Trash2,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
  UserCheck,
  AlertCircle,
  Code2,
  Palette,
  Share2,
  HeartHandshake,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  getRoleApplications,
  getPromotedMembers,
  promoteStudent,
  demoteMember,
  ROLE_DEFINITIONS,
  WING_METADATA,
  type RoleApplication,
  type PromotedMember,
  type HierarchyRole,
  type FunctionalWing,
} from "@/lib/services/hierarchyService";

interface Props {
  currentAdminName?: string;
  isSuperAdmin?: boolean;
}

export const AdminRolePromotionsTab: React.FC<Props> = ({
  currentAdminName = "Super Admin",
  isSuperAdmin = false,
}) => {
  const { toast } = useToast();

  const [applications, setApplications] = useState<RoleApplication[]>([]);
  const [promotedMembers, setPromotedMembers] = useState<PromotedMember[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<"applications" | "team">("applications");

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("All");
  const [wingFilter, setWingFilter] = useState<string>("All");
  const [yearFilter, setYearFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  // Promotion Dialog State
  const [promotingApp, setPromotingApp] = useState<RoleApplication | null>(null);
  const [confirmRole, setConfirmRole] = useState<HierarchyRole>("functional_head");
  const [confirmWing, setConfirmWing] = useState<FunctionalWing>("technical");
  const [isProcessing, setIsProcessing] = useState(false);

  const loadData = () => {
    setApplications(getRoleApplications());
    setPromotedMembers(getPromotedMembers());
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener("ts_applications_updated", handleUpdate);
    window.addEventListener("ts_hierarchy_updated", handleUpdate);
    return () => {
      window.removeEventListener("ts_applications_updated", handleUpdate);
      window.removeEventListener("ts_hierarchy_updated", handleUpdate);
    };
  }, []);

  // Filtered & Sorted Applications
  const filteredApplications = useMemo(() => {
    return applications
      .filter((app) => {
        // Status filter
        if (statusFilter !== "All" && app.status !== statusFilter) return false;
        // Role filter
        if (roleFilter !== "All" && app.appliedRole !== roleFilter) return false;
        // Wing filter
        if (wingFilter !== "All" && app.appliedWing !== wingFilter) return false;
        // Year filter
        if (yearFilter !== "All" && app.academicYear !== yearFilter) return false;
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = app.studentName.toLowerCase().includes(q);
          const matchGh = app.githubUsername.toLowerCase().includes(q);
          const matchEmail = app.studentEmail.toLowerCase().includes(q);
          const matchStatement = app.statement.toLowerCase().includes(q);
          return matchName || matchGh || matchEmail || matchStatement;
        }
        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        return sortOrder === "newest" ? timeB - timeA : timeA - timeB;
      });
  }, [applications, statusFilter, roleFilter, wingFilter, yearFilter, searchQuery, sortOrder]);

  const pendingCount = useMemo(() => applications.filter((a) => a.status === "pending").length, [applications]);

  const handleOpenPromote = (app: RoleApplication) => {
    setPromotingApp(app);
    setConfirmRole(app.appliedRole);
    if (app.appliedWing) {
      setConfirmWing(app.appliedWing);
    } else {
      setConfirmWing("technical");
    }
  };

  const handleConfirmPromotion = async () => {
    if (!promotingApp) return;
    setIsProcessing(true);
    try {
      await promoteStudent({
        applicationId: promotingApp.id,
        studentId: promotingApp.studentId,
        name: promotingApp.studentName,
        email: promotingApp.studentEmail,
        githubUsername: promotingApp.githubUsername,
        avatar: promotingApp.avatar,
        academicYear: promotingApp.academicYear,
        course: promotingApp.course,
        role: confirmRole,
        wing: ROLE_DEFINITIONS[confirmRole].requiresWing ? confirmWing : undefined,
        promotedBy: currentAdminName,
      });

      toast({
        title: "Account Promoted Successfully! 🎉",
        description: `${promotingApp.studentName} is now appointed as ${ROLE_DEFINITIONS[confirmRole].title}. They can now generate their unique Admin Key from their profile.`,
      });

      setPromotingApp(null);
      loadData();
    } catch (err: any) {
      toast({
        title: "Promotion Failed",
        description: err.message || "Failed to promote member.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectApplication = (appId: string, studentName: string) => {
    const raw = getRoleApplications();
    const updated = raw.map((a) =>
      a.id === appId
        ? { ...a, status: "rejected" as const, reviewedBy: currentAdminName, reviewedAt: new Date().toISOString() }
        : a
    );
    localStorage.setItem("ts_role_applications", JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("ts_applications_updated"));
    toast({
      title: "Application Declined",
      description: `Application for ${studentName} was marked as declined.`,
    });
    loadData();
  };

  const handleDemote = async (identifier: string, name: string) => {
    if (!confirm(`Are you sure you want to demote ${name}? Their administrative credentials and keys will be immediately revoked.`)) {
      return;
    }
    await demoteMember(identifier, currentAdminName);
    toast({
      title: "Member Demoted",
      description: `${name} has been removed from official leadership and their admin keys were revoked.`,
    });
    loadData();
  };

  const wingIcons: Record<FunctionalWing, any> = {
    technical: Code2,
    design_web: Palette,
    logistics_events: Calendar,
    content_social: Share2,
    community: HeartHandshake,
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header & Tab Switcher ── */}
      <Card className="glass border-white/20 dark:border-white/10 shadow-glass overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-purple-500 to-sky-400" />
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-heading font-medium tracking-wide">
                  Leadership Structure & Role Promotions
                </CardTitle>
                <CardDescription className="text-xs">
                  Review applicant profiles, approve succession promotions, and manage official organizational hierarchy.
                </CardDescription>
              </div>
            </div>
          </div>

          {/* Sub-tab pills */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-muted/30 border border-border/60">
            <button
              onClick={() => setActiveSubTab("applications")}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeSubTab === "applications"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Briefcase size={13} />
              <span>Role Applications</span>
              {pendingCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveSubTab("team")}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeSubTab === "team"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users size={13} />
              <span>Active Appointed Team</span>
              <span className="text-[10px] text-muted-foreground ml-0.5">({promotedMembers.length})</span>
            </button>
          </div>
        </CardHeader>
      </Card>

      {/* ── TAB 1: APPLICATIONS REVIEW ── */}
      {activeSubTab === "applications" && (
        <div className="space-y-4">
          
          {/* Filter & Sort Controls Bar */}
          <div className="p-4 rounded-2xl glass border border-border/60 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[220px]">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search applicants by name, email, GitHub or statement..."
                  className="pl-9 h-9 text-xs rounded-xl border-border bg-card/60"
                />
              </div>

              {/* Status & Sort */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-9 text-xs rounded-xl border border-border bg-card px-2.5 text-foreground cursor-pointer"
                >
                  <option value="pending">Status: Pending Review</option>
                  <option value="approved">Status: Approved / Promoted</option>
                  <option value="rejected">Status: Declined</option>
                  <option value="All">Status: All Applications</option>
                </select>

                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="h-9 text-xs rounded-xl border border-border bg-card px-2.5 text-foreground cursor-pointer"
                >
                  <option value="newest">Sort: Newest First</option>
                  <option value="oldest">Sort: Oldest First</option>
                </select>
              </div>
            </div>

            {/* Role, Wing, Year Dropdown Filters */}
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/40 text-xs text-muted-foreground">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Filter size={11} /> Filters:
              </span>

              {/* Role filter */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-8 text-xs rounded-lg border border-border bg-card/80 px-2 text-foreground cursor-pointer"
              >
                <option value="All">All Roles</option>
                <option value="vice_president">Vice President</option>
                <option value="functional_head">Functional Head</option>
                <option value="functional_co_head">Functional Co-Head</option>
                <option value="volunteer">Volunteer</option>
              </select>

              {/* Wing filter */}
              <select
                value={wingFilter}
                onChange={(e) => setWingFilter(e.target.value)}
                className="h-8 text-xs rounded-lg border border-border bg-card/80 px-2 text-foreground cursor-pointer"
              >
                <option value="All">All Wings</option>
                {(Object.keys(WING_METADATA) as FunctionalWing[]).map((w) => (
                  <option key={w} value={w}>
                    {WING_METADATA[w].label}
                  </option>
                ))}
              </select>

              {/* Academic Year filter */}
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="h-8 text-xs rounded-lg border border-border bg-card/80 px-2 text-foreground cursor-pointer"
              >
                <option value="All">All Academic Years</option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
              </select>

              {(roleFilter !== "All" || wingFilter !== "All" || yearFilter !== "All" || searchQuery) && (
                <button
                  onClick={() => {
                    setRoleFilter("All");
                    setWingFilter("All");
                    setYearFilter("All");
                    setSearchQuery("");
                  }}
                  className="text-[11px] text-primary hover:underline ml-auto"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Applications Grid */}
          {filteredApplications.length === 0 ? (
            <div className="py-16 text-center glass rounded-2xl border border-border/60 space-y-2">
              <Briefcase size={36} className="mx-auto text-muted-foreground/40 mb-1" />
              <p className="text-sm font-medium text-foreground">No applications match your criteria</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {statusFilter === "pending"
                  ? "There are currently no pending role applications awaiting review."
                  : "Try clearing or broadening your search filters."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredApplications.map((app) => {
                const roleMeta = ROLE_DEFINITIONS[app.appliedRole];
                const wingMeta = app.appliedWing ? WING_METADATA[app.appliedWing] : null;
                const isApproved = app.status === "approved";
                const isRejected = app.status === "rejected";

                return (
                  <Card
                    key={app.id}
                    className={`glass border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
                      isApproved
                        ? "border-emerald-500/30 bg-emerald-500/[0.02]"
                        : isRejected
                        ? "border-red-500/20 opacity-70"
                        : "border-border/80 hover:border-primary/40 shadow-sm"
                    }`}
                  >
                    <CardHeader className="p-4 sm:p-5 pb-3">
                      <div className="flex items-start justify-between gap-3">
                        {/* Applicant details */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 overflow-hidden flex-shrink-0 flex items-center justify-center font-heading text-primary font-bold">
                            {app.avatar ? (
                              <img src={app.avatar} alt={app.studentName} className="w-full h-full object-cover" />
                            ) : (
                              app.studentName[0]?.toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-heading font-medium text-sm text-foreground truncate">
                              {app.studentName}
                            </h4>
                            <p className="text-xs text-muted-foreground truncate">
                              @{app.githubUsername} · {app.academicYear} ({app.course || "B.Tech"})
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-2 py-0.5 capitalize shrink-0 ${
                            isApproved
                              ? "border-emerald-500/40 text-emerald-500 bg-emerald-500/10"
                              : isRejected
                              ? "border-red-500/40 text-red-500 bg-red-500/10"
                              : "border-amber-500/40 text-amber-500 bg-amber-500/10"
                          }`}
                        >
                          {app.status}
                        </Badge>
                      </div>

                      {/* Applied Role & Wing Tags */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-3">
                        <Badge variant="outline" className="text-[10px] border-primary/40 text-primary bg-primary/5">
                          {roleMeta?.title || app.appliedRole}
                        </Badge>
                        {wingMeta && (
                          <Badge variant="outline" className="text-[10px] border-border text-foreground/80">
                            {wingMeta.label}
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          Applied: {new Date(app.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 sm:p-5 pt-0 space-y-3 flex-1 flex flex-col justify-between">
                      {/* Statement snippet */}
                      <div className="p-3 rounded-xl bg-background/50 border border-border/40 text-xs text-foreground/80 leading-relaxed font-light">
                        <p className="line-clamp-3 italic">"{app.statement}"</p>
                      </div>

                      {/* Skills & Links */}
                      <div className="space-y-2 pt-1">
                        {app.skills && app.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {app.skills.slice(0, 4).map((sk) => (
                              <span
                                key={sk}
                                className="text-[9px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground"
                              >
                                {sk}
                              </span>
                            ))}
                            {app.skills.length > 4 && (
                              <span className="text-[9px] px-1.5 py-0.5 text-muted-foreground">
                                +{app.skills.length - 4}
                              </span>
                            )}
                          </div>
                        )}

                        {app.portfolioUrl && (
                          <a
                            href={app.portfolioUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline pt-0.5"
                          >
                            <ExternalLink size={11} /> View Work / Portfolio
                          </a>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="pt-3 border-t border-border/40 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-muted-foreground">
                          {app.studentEmail}
                        </span>

                        <div className="flex items-center gap-2">
                          {!isApproved && (
                            <Button
                              size="sm"
                              onClick={() => handleOpenPromote(app)}
                              className="h-8 text-xs rounded-xl bg-primary text-primary-foreground font-medium gap-1.5 hover:bg-primary/90 shadow-sm"
                            >
                              <UserCheck size={13} /> Promote to Role
                            </Button>
                          )}
                          {!isApproved && !isRejected && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRejectApplication(app.id, app.studentName)}
                              className="h-8 text-xs rounded-xl border-border hover:bg-destructive/10 hover:text-destructive"
                            >
                              Decline
                            </Button>
                          )}
                          {isApproved && (
                            <span className="text-[11px] text-emerald-500 font-medium flex items-center gap-1">
                              <CheckCircle2 size={13} /> Active in Team
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: ACTIVE APPOINTED TEAM ── */}
      {activeSubTab === "team" && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-muted/20 border border-border/60 flex items-center justify-between flex-wrap gap-2 text-xs">
            <span className="text-muted-foreground">
              Showing official appointed members across all 3 tiers. Only these accounts appear in the public hierarchy tree.
            </span>
            <Badge variant="outline" className="border-primary/30 text-primary">
              {promotedMembers.length} Appointed Members
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {promotedMembers.map((m) => {
              const roleMeta = ROLE_DEFINITIONS[m.role];
              const wingMeta = m.wing ? WING_METADATA[m.wing] : null;

              return (
                <Card key={m.id} className="glass border-border/80 hover:border-primary/40 transition-all shadow-sm">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 overflow-hidden flex-shrink-0 flex items-center justify-center font-heading text-primary font-bold">
                          {m.avatar ? (
                            <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" />
                          ) : (
                            m.name[0]?.toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-heading font-medium text-sm text-foreground truncate">{m.name}</h4>
                          <p className="text-xs text-muted-foreground truncate">@{m.githubUsername}</p>
                          <span className="text-[10px] text-foreground/50">{m.academicYear}</span>
                        </div>
                      </div>

                      <Badge
                        variant="outline"
                        className={`text-[9px] px-2 py-0.5 shrink-0 ${
                          m.tier === 1
                            ? "border-amber-500/40 text-amber-500 bg-amber-500/10"
                            : m.tier === 2
                            ? "border-primary/40 text-primary bg-primary/10"
                            : "border-border text-foreground/70"
                        }`}
                      >
                        Tier {m.tier}
                      </Badge>
                    </div>

                    <div className="space-y-1 pt-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-foreground">{m.roleTitle}</span>
                        {wingMeta && (
                          <span className="text-[11px] text-muted-foreground">· {wingMeta.label}</span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Promoted by {m.promotedBy} on {new Date(m.promotedAt).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Admin Key Status (Heads & Tier 1 only) */}
                    {m.tier <= 2 && (
                      <div className="p-2 rounded-xl bg-background/50 border border-border/40 flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <ShieldCheck size={12} className={m.adminKey ? "text-emerald-500" : "text-muted-foreground"} />
                          Admin Clearance:
                        </span>
                        <span className={`font-mono font-medium ${m.adminKey ? "text-emerald-500" : "text-amber-500"}`}>
                          {m.adminKey ? "Key Generated" : "Pending User Activation"}
                        </span>
                      </div>
                    )}

                    {/* Demote Button */}
                    <div className="pt-2 border-t border-border/40 flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDemote(m.studentId, m.name)}
                        className="h-7 text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive px-2 rounded-lg gap-1"
                      >
                        <Trash2 size={12} /> Demote Member
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ── PROMOTION CONFIRMATION MODAL ── */}
      <Dialog open={!!promotingApp} onOpenChange={(o) => !o && setPromotingApp(null)}>
        <DialogContent className="max-w-md rounded-2xl glass border border-border/80">
          <DialogHeader>
            <DialogTitle className="text-base font-heading font-medium text-foreground">
              Confirm Succession Promotion
            </DialogTitle>
            <DialogDescription className="text-xs">
              Assign final designation and wing for {promotingApp?.studentName} ({promotingApp?.academicYear}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Target Designation */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                Official Designation
              </label>
              <select
                value={confirmRole}
                onChange={(e) => setConfirmRole(e.target.value as HierarchyRole)}
                className="w-full h-9 text-xs rounded-xl border border-border bg-card px-3 text-foreground cursor-pointer"
              >
                <option value="vice_president">Vice President (Tier 1 Core)</option>
                <option value="functional_head">Functional Head (Tier 2)</option>
                <option value="functional_co_head">Functional Co-Head (Tier 2)</option>
                <option value="volunteer">Volunteer / Team Member (Tier 3)</option>
                {isSuperAdmin && <option value="president">President (Tier 1 Executive)</option>}
              </select>
            </div>

            {/* Wing Selection */}
            {ROLE_DEFINITIONS[confirmRole].requiresWing && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                  Assigned Wing
                </label>
                <select
                  value={confirmWing}
                  onChange={(e) => setConfirmWing(e.target.value as FunctionalWing)}
                  className="w-full h-9 text-xs rounded-xl border border-border bg-card px-3 text-foreground cursor-pointer"
                >
                  {(Object.keys(WING_METADATA) as FunctionalWing[]).map((w) => (
                    <option key={w} value={w}>
                      {WING_METADATA[w].label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs text-foreground/80 leading-relaxed">
              Upon promotion, this student will be elevated into the official hierarchy tree. If appointed as a Functional Head or Vice President, an <strong>Admin Secret Key</strong> will be unlockable in their profile.
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPromotingApp(null)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isProcessing}
              onClick={handleConfirmPromotion}
              className="rounded-xl text-xs bg-primary text-primary-foreground font-medium gap-1.5 hover:bg-primary/90"
            >
              {isProcessing ? "Promoting..." : "Confirm & Elevate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRolePromotionsTab;
