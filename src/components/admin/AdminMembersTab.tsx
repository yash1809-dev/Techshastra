import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Users,
  Search,
  Crown,
  Briefcase,
  ShieldCheck,
  UserCheck,
  UserX,
  ExternalLink,
  RefreshCw,
  Sparkles,
  GraduationCap,
  Github,
  Building,
  CheckCircle2,
  ChevronRight,
  Filter,
} from "lucide-react";
import { getAllStudents as getLocalStudents, type StudentProfile } from "@/lib/studentStore";
import { getAllStudents as getRemoteStudents } from "@/lib/services/studentService";
import {
  getPromotedMembers,
  fetchPromotedMembersRemote,
  promoteStudent,
  demoteMember,
  ROLE_DEFINITIONS,
  WING_METADATA,
  type HierarchyRole,
  type FunctionalWing,
  type PromotedMember,
} from "@/lib/services/hierarchyService";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

interface Props {
  currentAdminName?: string;
}

export default function AdminMembersTab({ currentAdminName = "Super Admin" }: Props) {
  const { toast } = useToast();

  const [students, setStudents] = useState<any[]>([]);
  const [promotedMembers, setPromotedMembers] = useState<PromotedMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "promoted" | "regular">("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [collegeFilter, setCollegeFilter] = useState<string>("all");

  // Direct Promotion Modal State
  const [targetStudent, setTargetStudent] = useState<any | null>(null);
  const [selectedRole, setSelectedRole] = useState<HierarchyRole>("functional_head");
  const [selectedWing, setSelectedWing] = useState<FunctionalWing>("technical");
  const [isPromoting, setIsPromoting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Load promoted hierarchy members
      let promoted = getPromotedMembers();
      if (isSupabaseConfigured()) {
        try {
          const remotePromoted = await fetchPromotedMembersRemote();
          if (remotePromoted.length > 0) {
            promoted = remotePromoted;
          }
        } catch (_err) {}
      }
      setPromotedMembers(promoted);

      // 2. Load all registered students
      let studentList: any[] = [];
      if (isSupabaseConfigured()) {
        try {
          const remote = await getRemoteStudents();
          if (Array.isArray(remote) && remote.length > 0) {
            studentList = remote;
          }
        } catch (_e) {}
      }
      if (studentList.length === 0) {
        studentList = getLocalStudents();
      }

      setStudents(studentList);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Listen for updates across windows
    const handleUpdate = () => loadData();
    window.addEventListener("ts_hierarchy_updated", handleUpdate);

    let channel: any = null;
    if (isSupabaseConfigured()) {
      channel = supabase
        .channel("public:admin_members_tab_live")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "promoted_members" },
          () => loadData()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "student_profiles" },
          () => loadData()
        )
        .subscribe();
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
      window.removeEventListener("ts_hierarchy_updated", handleUpdate);
    };
  }, [loadData]);

  // Create a fast lookup map for promoted status
  const promotedMap = useMemo(() => {
    const map = new Map<string, PromotedMember>();
    for (const m of promotedMembers) {
      if (m.studentId) map.set(m.studentId.toLowerCase(), m);
      if (m.githubUsername) map.set(m.githubUsername.toLowerCase(), m);
      if (m.email) map.set(m.email.toLowerCase(), m);
      if (m.id) map.set(m.id.toLowerCase(), m);
    }
    return map;
  }, [promotedMembers]);

  // Unique colleges for filter dropdown
  const collegesList = useMemo(() => {
    const set = new Set<string>();
    for (const s of students) {
      const col = s.college || s.institution || s.education?.[0]?.institution;
      if (col) set.add(col);
    }
    return Array.from(set).sort();
  }, [students]);

  // Filtered Students List
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const gh = (s.githubUsername || s.github_username || s.username || "").toLowerCase();
      const sId = (s.id || s.studentId || "").toLowerCase();
      const email = (s.email || "").toLowerCase();
      const name = (s.name || s.username || "").toLowerCase();
      const college = (s.college || s.institution || s.education?.[0]?.institution || "").toLowerCase();
      const year = (s.year || s.academicYear || "").toLowerCase();

      const promoted = promotedMap.get(sId) || promotedMap.get(gh) || promotedMap.get(email);

      // Status filter
      if (statusFilter === "promoted" && !promoted) return false;
      if (statusFilter === "regular" && promoted) return false;

      // Year filter
      if (yearFilter !== "all" && !year.includes(yearFilter.toLowerCase())) return false;

      // College filter
      if (collegeFilter !== "all" && !college.includes(collegeFilter.toLowerCase())) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = name.includes(q);
        const matchesGh = gh.includes(q);
        const matchesEmail = email.includes(q);
        const matchesCol = college.includes(q);
        return matchesName || matchesGh || matchesEmail || matchesCol;
      }

      return true;
    });
  }, [students, promotedMap, statusFilter, yearFilter, collegeFilter, searchQuery]);

  // Open Direct Promotion Dialog
  const handleOpenPromote = (student: any) => {
    const gh = (student.githubUsername || student.github_username || student.username || "").toLowerCase();
    const sId = (student.id || student.studentId || "").toLowerCase();
    const email = (student.email || "").toLowerCase();
    const existing = promotedMap.get(sId) || promotedMap.get(gh) || promotedMap.get(email);

    setTargetStudent(student);
    if (existing) {
      setSelectedRole(existing.role);
      if (existing.wing) setSelectedWing(existing.wing);
    } else {
      setSelectedRole("functional_head");
      setSelectedWing("technical");
    }
  };

  // Confirm Direct Promotion
  const handleConfirmPromotion = async () => {
    if (!targetStudent) return;
    setIsPromoting(true);

    const sName = targetStudent.name || targetStudent.username || "Student";
    const sGh = targetStudent.githubUsername || targetStudent.github_username || targetStudent.username || "";
    const sId = targetStudent.id || targetStudent.studentId || sGh;
    const sEmail = targetStudent.email || "";
    const sYear = targetStudent.year || targetStudent.academicYear || "3rd Year";
    const sCourse = targetStudent.course || "B.Tech";
    const sAvatar =
      targetStudent.avatar ||
      targetStudent.avatar_url ||
      targetStudent.profiles?.avatar_url ||
      (sGh ? `https://avatars.githubusercontent.com/${sGh}` : undefined);

    const roleDef = ROLE_DEFINITIONS[selectedRole];
    const wingValue = roleDef.requiresWing ? selectedWing : undefined;

    try {
      await promoteStudent({
        studentId: sId,
        name: sName,
        email: sEmail,
        githubUsername: sGh,
        avatar: sAvatar,
        academicYear: sYear,
        course: sCourse,
        role: selectedRole,
        wing: wingValue,
        promotedBy: currentAdminName,
      });

      toast({
        title: "Member Promoted Successfully! 🎉",
        description: `${sName} is now appointed as ${roleDef.title}${wingValue ? ` (${WING_METADATA[wingValue].label})` : ""}. They now have administrative clearance!`,
      });

      setTargetStudent(null);
      await loadData();
    } catch (err: any) {
      toast({
        title: "Promotion Failed",
        description: err.message || "Failed to promote member directly.",
        variant: "destructive",
      });
    } finally {
      setIsPromoting(false);
    }
  };

  // Direct Demote Member
  const handleDemote = async (student: any) => {
    const gh = (student.githubUsername || student.github_username || student.username || "").toLowerCase();
    const sId = (student.id || student.studentId || "").toLowerCase();
    const email = (student.email || "").toLowerCase();
    const existing = promotedMap.get(sId) || promotedMap.get(gh) || promotedMap.get(email);

    if (!existing) return;

    if (!confirm(`Are you sure you want to demote ${existing.name} back to regular student? Their administrative keys and clearances will be immediately revoked.`)) {
      return;
    }

    try {
      await demoteMember(existing.id || existing.studentId || existing.githubUsername, currentAdminName, existing);
      toast({
        title: "Member Demoted",
        description: `${existing.name} has been removed from leadership and restored to regular student.`,
      });
      await loadData();
    } catch (err: any) {
      toast({
        title: "Demotion Failed",
        description: err.message || "Failed to demote member.",
        variant: "destructive",
      });
    }
  };

  const selectedRoleDef = ROLE_DEFINITIONS[selectedRole];

  return (
    <div className="space-y-6">
      {/* ── Header Banner ── */}
      <Card className="glass border-white/20 dark:border-white/10 shadow-glass overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-emerald-500 to-sky-400" />
        <CardHeader className="p-5 sm:p-6 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-heading font-semibold flex items-center gap-2">
                  Member Directory &amp; Direct Promotions
                  <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                    {students.length} Total Registered
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Directly promote any student profile to leadership, functional heads, or executive positions without requiring an application form.
                </CardDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="gap-1.5 text-xs rounded-xl self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh List
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* ── Filters & Search Toolbar ── */}
      <Card className="border border-border/70 bg-card/60 backdrop-blur-md rounded-2xl">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, @github, email, college, course..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl bg-background/80"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
              <SelectTrigger className="w-full md:w-44 h-9 text-xs rounded-xl bg-background/80">
                <SelectValue placeholder="Status Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Profiles ({students.length})</SelectItem>
                <SelectItem value="promoted">Promoted Leaders ({promotedMembers.length})</SelectItem>
                <SelectItem value="regular">Regular Students ({Math.max(0, students.length - promotedMembers.length)})</SelectItem>
              </SelectContent>
            </Select>

            {/* Year Filter */}
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-full md:w-36 h-9 text-xs rounded-xl bg-background/80">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                <SelectItem value="1st">1st Year</SelectItem>
                <SelectItem value="2nd">2nd Year</SelectItem>
                <SelectItem value="3rd">3rd Year</SelectItem>
                <SelectItem value="4th">4th Year</SelectItem>
              </SelectContent>
            </Select>

            {/* College Filter */}
            {collegesList.length > 0 && (
              <Select value={collegeFilter} onValueChange={setCollegeFilter}>
                <SelectTrigger className="w-full md:w-48 h-9 text-xs rounded-xl bg-background/80">
                  <SelectValue placeholder="College" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Colleges</SelectItem>
                  {collegesList.map((col) => (
                    <SelectItem key={col} value={col}>
                      {col}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
            <span>
              Showing <strong className="text-foreground">{filteredStudents.length}</strong> of {students.length} profiles
            </span>
            {(searchQuery || statusFilter !== "all" || yearFilter !== "all" || collegeFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setYearFilter("all");
                  setCollegeFilter("all");
                }}
                className="text-primary hover:underline text-[11px]"
              >
                Reset Filters
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Members Grid ── */}
      {filteredStudents.length === 0 ? (
        <Card className="border border-dashed border-border/80 rounded-2xl bg-muted/10">
          <CardContent className="py-12 text-center space-y-2">
            <Users className="w-10 h-10 text-muted-foreground mx-auto opacity-50" />
            <h3 className="font-semibold text-sm">No Members Found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              No registered profiles matched your current filters. Try resetting search or filter terms.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.map((student) => {
            const gh = student.githubUsername || student.github_username || student.username || "";
            const sId = student.id || student.studentId || gh;
            const email = student.email || "";
            const displayName = student.name || student.username || "Member";
            const college = student.college || student.institution || student.education?.[0]?.institution || "UTU Sudhowala (Main Campus)";
            const yearCourse = [student.course || "B.Tech", student.year || student.academicYear || "Student"].filter(Boolean).join(" · ");
            const avatar =
              student.avatar ||
              student.avatar_url ||
              student.profiles?.avatar_url ||
              (gh ? `https://avatars.githubusercontent.com/${gh}?s=80` : "");

            const promoted =
              promotedMap.get(sId.toLowerCase()) ||
              promotedMap.get(gh.toLowerCase()) ||
              promotedMap.get(email.toLowerCase());

            return (
              <Card
                key={student.id || gh || email}
                className={`glass border rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-md flex flex-col justify-between ${
                  promoted
                    ? "border-primary/40 bg-primary/[0.03] shadow-xs"
                    : "border-border/60 hover:border-border"
                }`}
              >
                <CardContent className="p-4 space-y-3.5">
                  {/* Top Bar: Avatar + Name + Current Role Badge */}
                  <div className="flex items-start gap-3">
                    <div className="relative w-12 h-12 rounded-2xl overflow-hidden ring-2 ring-primary/20 flex-shrink-0 bg-primary/10 flex items-center justify-center font-heading text-primary font-bold text-base select-none">
                      <span>{displayName[0]?.toUpperCase() || "M"}</span>
                      {avatar && (
                        <img
                          src={avatar}
                          alt={displayName}
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="font-heading font-medium text-sm text-foreground truncate">
                          {displayName}
                        </h4>
                        {promoted && (
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1.5 py-0 font-medium shrink-0 ${
                              promoted.tier === 1
                                ? "border-amber-500/40 text-amber-500 bg-amber-500/10"
                                : promoted.tier === 2
                                ? "border-primary/40 text-primary bg-primary/10"
                                : "border-emerald-500/40 text-emerald-500 bg-emerald-500/10"
                            }`}
                          >
                            {promoted.tier === 1 ? "Tier 1 Exec" : promoted.tier === 2 ? "Tier 2 Lead" : "Volunteer"}
                          </Badge>
                        )}
                      </div>

                      {gh ? (
                        <a
                          href={`https://github.com/${gh}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 font-mono truncate"
                        >
                          <Github size={11} className="shrink-0" />
                          <span>@{gh}</span>
                        </a>
                      ) : (
                        <p className="text-xs text-muted-foreground font-mono truncate">No GitHub</p>
                      )}

                      <p className="text-[11px] text-foreground/50 truncate mt-0.5">
                        {yearCourse}
                      </p>
                    </div>
                  </div>

                  {/* College & Details */}
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
                    <Building size={11} className="shrink-0 text-primary/70" />
                    <span className="truncate">{college}</span>
                  </div>

                  {/* Promotion Status Ribbon */}
                  <div className="p-2 rounded-xl bg-background/60 border border-border/50 text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {promoted ? (
                        <>
                          <Crown size={13} className="text-primary shrink-0" />
                          <span className="font-medium text-foreground truncate">
                            {promoted.roleTitle}
                            {promoted.wing && (
                              <span className="text-muted-foreground font-normal ml-1">
                                ({WING_METADATA[promoted.wing]?.label || promoted.wing})
                              </span>
                            )}
                          </span>
                        </>
                      ) : (
                        <>
                          <Users size={13} className="text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground truncate">Student / Member</span>
                        </>
                      )}
                    </div>
                    {promoted?.adminKey && (
                      <span className="text-[10px] font-mono text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shrink-0">
                        Admin Key ✓
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleOpenPromote(student)}
                      className={`h-8 flex-1 text-xs gap-1.5 rounded-xl font-medium ${
                        promoted
                          ? "bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30"
                          : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
                      }`}
                    >
                      <Sparkles size={12} />
                      {promoted ? "Change Position" : "Promote to Position"}
                    </Button>

                    {promoted && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDemote(student)}
                        className="h-8 px-2.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-xl"
                        title="Demote to Student"
                      >
                        <UserX size={14} />
                      </Button>
                    )}

                    {gh && (
                      <Button
                        size="sm"
                        variant="ghost"
                        asChild
                        className="h-8 px-2 text-muted-foreground hover:text-foreground rounded-xl"
                        title="Open Member Profile"
                      >
                        <a href={`/members/${gh}`} target="_blank" rel="noreferrer">
                          <ExternalLink size={13} />
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Direct Promotion Dialog ── */}
      <Dialog open={Boolean(targetStudent)} onOpenChange={(open) => !open && setTargetStudent(null)}>
        <DialogContent className="max-w-md rounded-2xl glass">
          <DialogHeader>
            <DialogTitle className="text-base font-heading font-semibold flex items-center gap-2">
              <Crown className="w-4 h-4 text-primary" />
              Direct Appointment &amp; Promotion
            </DialogTitle>
            <DialogDescription className="text-xs">
              Promote this student directly without an application form. Their administrative credentials will be automatically enabled.
            </DialogDescription>
          </DialogHeader>

          {targetStudent && (
            <div className="space-y-4 py-2">
              {/* Candidate Info Box */}
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-3 text-xs">
                <div className="w-10 h-10 rounded-xl bg-primary/10 overflow-hidden flex items-center justify-center font-bold text-primary shrink-0 relative">
                  <span>{(targetStudent.name || targetStudent.username || "S")[0]?.toUpperCase()}</span>
                  {(targetStudent.avatar || targetStudent.avatar_url || targetStudent.profiles?.avatar_url) && (
                    <img
                      src={targetStudent.avatar || targetStudent.avatar_url || targetStudent.profiles?.avatar_url}
                      alt="Avatar"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">
                    {targetStudent.name || targetStudent.username}
                  </p>
                  <p className="text-muted-foreground font-mono text-[11px] truncate">
                    @{targetStudent.githubUsername || targetStudent.github_username || targetStudent.username}
                  </p>
                  <p className="text-[10px] text-foreground/50 truncate">
                    {[targetStudent.course || "B.Tech", targetStudent.year || targetStudent.academicYear || "Student"].join(" · ")}
                  </p>
                </div>
              </div>

              {/* Role Select */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Select Position / Role</Label>
                <Select value={selectedRole} onValueChange={(val: any) => setSelectedRole(val)}>
                  <SelectTrigger className="text-xs rounded-xl h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="president">President (Tier 1 Executive Board)</SelectItem>
                    <SelectItem value="vice_president">Vice President (Tier 1 Executive Board)</SelectItem>
                    <SelectItem value="general_secretary">General Secretary (Tier 1 Executive Board)</SelectItem>
                    <SelectItem value="treasurer">Treasurer (Tier 1 Executive Board)</SelectItem>
                    <SelectItem value="functional_head">Functional Head / Wing Lead (Tier 2)</SelectItem>
                    <SelectItem value="functional_co_head">Functional Co-Head (Tier 2)</SelectItem>
                    <SelectItem value="volunteer">Club Volunteer / Core Member (Tier 3)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">{selectedRoleDef.description}</p>
              </div>

              {/* Wing Select (if required) */}
              {selectedRoleDef.requiresWing && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Assign Department / Functional Wing</Label>
                  <Select value={selectedWing} onValueChange={(val: any) => setSelectedWing(val)}>
                    <SelectTrigger className="text-xs rounded-xl h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(WING_METADATA).map(([key, meta]) => (
                        <SelectItem key={key} value={key}>
                          {meta.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    {WING_METADATA[selectedWing]?.description}
                  </p>
                </div>
              )}

              {/* Clearance Tier Notice */}
              <div className="p-3 rounded-xl bg-muted/40 border border-border/60 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <ShieldCheck size={13} className="text-emerald-500" />
                  <span>
                    Clearance Tier {selectedRoleDef.tier}
                    {selectedRoleDef.tier === 1 ? " (Executive Access)" : selectedRoleDef.tier === 2 ? " (Wing Lead Access)" : " (Team Volunteer Access)"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Upon appointment, the member can access their Admin Clearance Key directly from their profile to log into authorized administrative tabs.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTargetStudent(null)}
              disabled={isPromoting}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmPromotion}
              disabled={isPromoting}
              className="rounded-xl text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
            >
              {isPromoting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Promoting...
                </>
              ) : (
                <>
                  <UserCheck className="w-3.5 h-3.5" /> Confirm Promotion
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
