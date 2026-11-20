/**
 * /members — Directory & Organizational Hierarchy of TechShastra.
 * 
 * Includes:
 * 1. Official Club Hierarchy & Team structure (Executive Board -> Functional Wings & Heads -> Volunteers under each head).
 * 2. All Registered Student Directory.
 */

import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Github,
  Linkedin,
  Search,
  Users,
  GraduationCap,
  Globe,
  Crown,
  ChevronDown,
  ChevronUp,
  Briefcase,
  Sparkles,
  ShieldCheck,
  Code2,
  Palette,
  Calendar,
  Share2,
  HeartHandshake,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { getAllStudents as getLocalStudents, type StudentProfile } from "@/lib/studentStore";
import { getAllStudents as getRemoteStudents } from "@/lib/services/studentService";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import {
  getStructuredHierarchy,
  getPromotedMembers,
  WING_METADATA,
  type StructuredHierarchy,
  type PromotedMember,
  type FunctionalWing,
} from "@/lib/services/hierarchyService";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

const MemberCard = ({ student, promotedMember }: { student: any; promotedMember?: PromotedMember }) => {
  const ghUser = student.githubUsername || student.github_username || student.username;
  const displayName = student.name || student.username || "Member";
  const avatarSrc =
    student.avatar || student.avatar_url || student.profiles?.avatar_url || (ghUser ? `https://avatars.githubusercontent.com/${ghUser}?s=80` : "");
  const interestsList = student.interests || [];
  const wingLabel = promotedMember?.wing ? WING_METADATA[promotedMember.wing]?.label || promotedMember.wing : null;

  return (
    <motion.div variants={fadeUp}>
      <Link to={`/members/${ghUser}`}>
        <div className="glass rounded-3xl p-6 hover:bg-primary/5 transition-all duration-300 group cursor-pointer h-full flex flex-col gap-4 border border-border/60 hover:border-primary/40 shadow-sm">
          {/* Avatar + name */}
          <div className="flex items-center gap-4">
            <div className="relative w-14 h-14 rounded-2xl overflow-hidden ring-2 ring-primary/20 flex-shrink-0 bg-primary/10 flex items-center justify-center font-heading text-primary font-bold text-lg select-none">
              <span>{displayName[0]?.toUpperCase() || "M"}</span>
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt={displayName}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : null}
            </div>
            <div className="min-w-0">
              <p className="font-heading font-medium tracking-wide text-foreground group-hover:text-primary transition-colors truncate">
                {displayName}
              </p>
              <p className="text-xs text-foreground/40 font-light truncate">@{ghUser}</p>
            </div>
          </div>

          {/* Official Designation Badge if promoted */}
          {promotedMember && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${
                  promotedMember.tier === 1
                    ? "bg-amber-500/10 text-amber-800 dark:text-amber-200 border-amber-500/30"
                    : promotedMember.tier === 2
                    ? "bg-primary/10 text-primary dark:text-primary-foreground border-primary/30"
                    : "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border-emerald-500/30"
                }`}
              >
                {promotedMember.tier === 1 ? (
                  <Crown size={11} className="text-amber-500 shrink-0" />
                ) : promotedMember.tier === 2 ? (
                  <Briefcase size={11} className="text-primary shrink-0" />
                ) : (
                  <Users size={11} className="text-emerald-500 shrink-0" />
                )}
                <span className="truncate">
                  {promotedMember.roleTitle}{wingLabel ? ` · ${wingLabel}` : ""}
                </span>
              </span>
            </div>
          )}

          {/* Course / year */}
          {(student.course || student.year) && (
            <div className="flex items-center gap-1.5 text-xs text-foreground/50 font-light">
              <GraduationCap size={12} />
              {[student.course, student.year].filter(Boolean).join(", ")}
            </div>
          )}

          {/* Bio snippet */}
          {student.bio && (
            <p className="text-xs text-foreground/50 font-light line-clamp-2 italic">{student.bio}</p>
          )}

          {/* Top interests */}
          {interestsList.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-auto">
              {interestsList.slice(0, 3).map((i: string) => (
                <Badge key={i} className="text-[9px] font-light bg-primary/10 text-primary border-0 px-2 py-0.5">
                  {i}
                </Badge>
              ))}
              {interestsList.length > 3 && (
                <Badge variant="secondary" className="text-[9px] font-light px-2 py-0.5">
                  +{interestsList.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Social icons */}
          <div className="flex items-center gap-3 text-foreground/30 pt-1">
            <Github size={14} />
            {(student.linkedinUrl || student.linkedin_url) && <Linkedin size={14} />}
            {(student.portfolioUrl || student.portfolio_url) && <Globe size={14} />}
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

// Promoted Leader Card for Hierarchy
const LeaderCard = ({ member, badgeColor = "primary" }: { member: PromotedMember; badgeColor?: "amber" | "primary" | "muted" }) => {
  const profileLink = member.githubUsername ? `/members/${member.githubUsername}` : "#";

  return (
    <Link to={profileLink} className="block group">
      <div className="p-4 rounded-2xl glass border border-border/80 group-hover:border-primary/50 transition-all duration-300 bg-card/60 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 overflow-hidden flex-shrink-0 flex items-center justify-center font-heading text-primary font-bold">
            {member.avatar ? (
              <img src={member.avatar} alt={member.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
            ) : (
              member.name[0]?.toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <h4 className="font-heading font-medium text-sm text-foreground group-hover:text-primary transition-colors truncate">
              {member.name}
            </h4>
            <p className="text-xs text-muted-foreground truncate font-mono">
              @{member.githubUsername}
            </p>
            <span className="text-[10px] text-foreground/50">{member.academicYear} · {member.course || "B.Tech"}</span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <Badge
            variant="outline"
            className={`text-[10px] font-medium px-2 py-0.5 ${
              badgeColor === "amber"
                ? "border-amber-500/40 text-amber-500 bg-amber-500/10"
                : badgeColor === "primary"
                ? "border-primary/40 text-primary bg-primary/10"
                : "border-border text-muted-foreground"
            }`}
          >
            {member.roleTitle}
          </Badge>
        </div>
      </div>
    </Link>
  );
};

const Members = () => {
  const navigate = useNavigate();
  const { session } = useStudentAuth();
  const [activeView, setActiveView] = useState<"hierarchy" | "all">("hierarchy");
  const [query, setQuery] = useState("");
  const [filterInterest, setFilterInterest] = useState<string | null>(null);
  const [allStudents, setAllStudents] = useState<any[]>([]);

  // Hierarchy Structure State
  const [hierarchy, setHierarchy] = useState<StructuredHierarchy>(() => getStructuredHierarchy());
  const [expandedTier1, setExpandedTier1] = useState(true);
  const [expandedVolunteers, setExpandedVolunteers] = useState<Record<string, boolean>>({
    technical: true,
    design_web: true,
  });

  const toggleVolunteers = (wing: string) => {
    setExpandedVolunteers((prev) => ({ ...prev, [wing]: !prev[wing] }));
  };

  useEffect(() => {
    const loadStudents = async () => {
      try {
        const remote = await getRemoteStudents();
        const local = getLocalStudents().filter((s) => s.is_active);
        const map = new Map<string, any>();
        for (const s of local) {
          const key = (s.githubUsername || s.email || s.id).toLowerCase();
          map.set(key, s);
        }
        for (const s of (remote || []).filter((r: any) => r.is_active)) {
          const key = (s.githubUsername || s.email || s.id).toLowerCase();
          map.set(key, s);
        }
        const merged = Array.from(map.values());
        setAllStudents(merged);
        if (session?.githubUsername) {
          const me = merged.find((m: any) =>
            (m.githubUsername || m.username || "").toLowerCase() === session.githubUsername.toLowerCase()
          );
          const myAvatar = me?.avatar || me?.avatar_url || me?.profiles?.avatar_url;
          if (myAvatar) {
            localStorage.setItem(`ts_avatar_${session.githubUsername}`, myAvatar);
            window.dispatchEvent(new CustomEvent("ts_avatar_updated", { detail: { avatarUrl: myAvatar } }));
          }
        }
      } catch (_e) {
        const local = getLocalStudents().filter((s) => s.is_active);
        setAllStudents(local);
      }
    };
    loadStudents();

    const loadHierarchy = () => {
      setHierarchy(getStructuredHierarchy());
    };
    loadHierarchy();

    const avatarHandler = (e: Event) => {
      const { avatarUrl, studentId } = (e as CustomEvent<{ avatarUrl: string; studentId: string }>).detail || {};
      if (avatarUrl) {
        setAllStudents((prev) =>
          prev.map((s) => (s.id === studentId || s.studentId === studentId ? { ...s, avatar: avatarUrl } : s))
        );
      }
    };

    window.addEventListener("ts_avatar_updated", avatarHandler);
    window.addEventListener("ts_hierarchy_updated", loadHierarchy);
    return () => {
      window.removeEventListener("ts_avatar_updated", avatarHandler);
      window.removeEventListener("ts_hierarchy_updated", loadHierarchy);
    };
  }, []);

  // Collect all unique interests for filter chips
  const allInterests = useMemo(() => {
    const set = new Set<string>();
    allStudents.forEach((s) => (s.interests || []).forEach((i: string) => set.add(i)));
    return Array.from(set).sort();
  }, [allStudents]);

  // Lookup map for fast promoted member resolution on member cards
  const promotedMap = useMemo(() => {
    const map = new Map<string, PromotedMember>();
    const all = getPromotedMembers();
    for (const m of all) {
      if (m.studentId) map.set(m.studentId.toLowerCase(), m);
      if (m.githubUsername) map.set(m.githubUsername.toLowerCase(), m);
      if (m.name) map.set(m.name.toLowerCase(), m);
    }
    return map;
  }, [hierarchy]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return allStudents.filter((s) => {
      const name = (s.name || s.username || "").toLowerCase();
      const gh = (s.githubUsername || s.github_username || "").toLowerCase();
      const course = (s.course || "").toLowerCase();
      const skills: string[] = s.skills || [];
      const interests: string[] = s.interests || [];

      const matchQuery =
        !q ||
        name.includes(q) ||
        gh.includes(q) ||
        course.includes(q) ||
        skills.some((sk) => sk.toLowerCase().includes(q)) ||
        interests.some((i) => i.toLowerCase().includes(q));

      const matchInterest = !filterInterest || interests.includes(filterInterest);
      return matchQuery && matchInterest;
    });
  }, [allStudents, query, filterInterest]);

  const wingIcons: Record<FunctionalWing, any> = {
    technical: Code2,
    design_web: Palette,
    logistics_events: Calendar,
    content_social: Share2,
    community: HeartHandshake,
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-20 sm:py-24 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-14 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-[10px] tracking-[0.2em] uppercase text-primary font-medium">
            <Users size={12} /> TechShastra Society
          </div>
          <h1 className="text-4xl md:text-7xl font-heading font-light tracking-tight">
            <span className="text-foreground">Club </span>
            <span className="text-primary italic">Leadership & Members</span>
          </h1>
          <p className="text-sm sm:text-base text-foreground/50 max-w-xl mx-auto font-light">
            Meet the official executive board, department heads, and volunteers architecting the future of TechShastra.
          </p>
        </div>

        {/* View Switcher: Official Hierarchy vs All Registered */}
        <div className="flex items-center justify-center mb-10">
          <div className="p-1.5 rounded-2xl glass border border-border/80 flex items-center gap-2 shadow-sm">
            <button
              onClick={() => setActiveView("hierarchy")}
              className={`px-4 sm:px-5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${
                activeView === "hierarchy"
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Crown size={14} />
              <span>Official Leadership & Hierarchy</span>
            </button>
            <button
              onClick={() => setActiveView("all")}
              className={`px-4 sm:px-5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${
                activeView === "all"
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users size={14} />
              <span>Registered Students ({allStudents.length})</span>
            </button>
          </div>
        </div>

        {/* Your profile shortcut */}
        {session && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 sm:p-5 glass rounded-2xl flex items-center justify-between flex-wrap gap-3 border border-border/60"
          >
            <div className="flex items-center gap-2 text-xs sm:text-sm text-foreground/70 font-light">
              <Sparkles size={14} className="text-primary" />
              <span>
                Signed in as <strong className="text-foreground font-medium">{session.name}</strong>
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full text-xs h-8 border-border hover:bg-primary/5 hover:text-primary gap-1.5"
              onClick={() => navigate(`/members/${session.githubUsername}`)}
            >
              <span>My Profile & Applications</span>
              <ArrowRight size={12} />
            </Button>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* VIEW 1: OFFICIAL CLUB HIERARCHY TREE                               */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeView === "hierarchy" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            
            {/* ── TIER 1: EXECUTIVE BOARD (Core Leadership) ── */}
            <div className="rounded-3xl glass border border-amber-500/20 bg-amber-500/[0.015] shadow-lg p-5 sm:p-7 space-y-5">
              <div
                onClick={() => setExpandedTier1(!expandedTier1)}
                className="flex items-center justify-between cursor-pointer select-none"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 sm:p-2.5 rounded-2xl bg-amber-500/10 text-amber-500">
                    <Crown size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500">
                        Tier 1 · Core Leadership
                      </span>
                      <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-500 py-0">
                        {hierarchy.tier1.length} Appointed
                      </Badge>
                    </div>
                    <h3 className="text-base sm:text-xl font-heading font-medium text-foreground tracking-wide mt-0.5">
                      Executive Board
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                >
                  {expandedTier1 ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
              </div>

              {expandedTier1 && (
                <div className="pt-2 border-t border-border/40">
                  <p className="text-xs text-muted-foreground mb-4 font-light">
                    Responsible for strategy, faculty coordination, approvals, and final decision-making.
                  </p>

                  {hierarchy.tier1.length === 0 ? (
                    <div className="p-4 sm:p-5 rounded-2xl bg-muted/10 border border-dashed border-border/60 text-center space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">
                        No Executive Board positions filled yet.
                      </p>
                      <p className="text-[11px] text-foreground/50 font-light">
                        Leaders will appear here once promoted from active registered student profiles.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                      {hierarchy.tier1.map((leader) => (
                        <LeaderCard key={leader.id} member={leader} badgeColor="amber" />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── TIER 2: FUNCTIONAL HEADS (Core Team) & TIER 3 VOLUNTEERS ── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                    Tier 2 & 3 · Departmental Execution
                  </span>
                  <h3 className="text-base sm:text-lg font-heading font-medium text-foreground tracking-wide mt-0.5">
                    Functional Wings & Sub-Teams
                  </h3>
                </div>
                <span className="text-xs text-muted-foreground font-light">
                  5 Core Functional Wings
                </span>
              </div>

              {/* Grid of 5 Wings */}
              <div className="space-y-4">
                {hierarchy.tier2.map((wingGroup) => {
                  const Icon = wingIcons[wingGroup.wing] || Users;
                  const isVolunteersOpen = !!expandedVolunteers[wingGroup.wing];

                  return (
                    <div
                      key={wingGroup.wing}
                      className="rounded-3xl glass border border-border/80 bg-card/40 p-5 sm:p-6 space-y-4 shadow-sm"
                    >
                      {/* Wing Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/40">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                            <Icon size={18} />
                          </div>
                          <div>
                            <h4 className="text-sm sm:text-base font-heading font-medium text-foreground tracking-wide">
                              {wingGroup.metadata.label}
                            </h4>
                            <p className="text-xs text-muted-foreground font-light line-clamp-1">
                              {wingGroup.metadata.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <Badge variant="outline" className="text-[10px] border-border text-foreground/80 py-0.5">
                            {wingGroup.heads.length} Head(s)
                          </Badge>
                          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary py-0.5">
                            {wingGroup.volunteers.length} Volunteer(s)
                          </Badge>
                        </div>
                      </div>

                      {/* Department Heads (Tier 2) */}
                      <div className="space-y-2">
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block">
                          Department Head(s) & Co-Head(s)
                        </span>

                        {wingGroup.heads.length === 0 ? (
                          <div className="p-3 rounded-2xl bg-muted/20 border border-dashed border-border/60 text-xs text-muted-foreground text-center">
                            Position open for 2nd / 3rd Year candidates. Apply from your profile.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {wingGroup.heads.map((head) => (
                              <LeaderCard key={head.id} member={head} badgeColor="primary" />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Dropdown list of Volunteers currently serving under this head */}
                      <div className="pt-2 border-t border-border/30">
                        <button
                          type="button"
                          onClick={() => toggleVolunteers(wingGroup.wing)}
                          className="flex items-center justify-between w-full p-2.5 rounded-2xl bg-background/50 border border-border/60 text-xs text-foreground/80 hover:text-foreground hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Users size={14} className="text-primary" />
                            <span className="font-medium">
                              Volunteers Serving Under {wingGroup.metadata.label}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              ({wingGroup.volunteers.length} active)
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-[11px] text-primary">
                            <span>{isVolunteersOpen ? "Collapse Team" : "Expand Team"}</span>
                            {isVolunteersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </div>
                        </button>

                        {/* Volunteers List Accordion Body */}
                        {isVolunteersOpen && (
                          <div className="mt-3 space-y-2 pl-0 sm:pl-3">
                            {wingGroup.volunteers.length === 0 ? (
                              <div className="p-4 rounded-2xl bg-muted/10 border border-dashed border-border/60 text-center space-y-1">
                                <p className="text-xs text-muted-foreground">
                                  No volunteers appointed to this wing yet.
                                </p>
                                <p className="text-[11px] text-foreground/50">
                                  1st and 2nd Year members can apply to join this wing from their profile page.
                                </p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                {wingGroup.volunteers.map((vol) => (
                                  <LeaderCard key={vol.id} member={vol} badgeColor="muted" />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* VIEW 2: ALL REGISTERED STUDENTS DIRECTORY                          */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeView === "all" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Search */}
            <div className="relative mb-4">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/30" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search registered members by name, username, course, skill, interest…"
                className="pl-10 glass h-13 rounded-2xl border-0 focus-visible:ring-1 focus-visible:ring-primary/30 text-xs sm:text-sm font-light"
              />
            </div>

            {/* Interest filters */}
            {allInterests.length > 0 && (
              <div className="flex overflow-x-auto no-scrollbar scroll-smooth sm:flex-wrap gap-2 mb-6 py-1">
                <button
                  onClick={() => setFilterInterest(null)}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-light transition-all duration-300 ${
                    !filterInterest ? "bg-primary text-primary-foreground" : "glass text-foreground/50 hover:text-foreground"
                  }`}
                >
                  All
                </button>
                {allInterests.map((i) => (
                  <button
                    key={i}
                    onClick={() => setFilterInterest(filterInterest === i ? null : i)}
                    className={`shrink-0 px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-light transition-all duration-300 ${
                      filterInterest === i ? "bg-primary text-primary-foreground" : "glass text-foreground/50 hover:text-foreground"
                    }`}
                  >
                    {i}
                  </button>
                ))}
              </div>
            )}

            {/* Grid */}
            {filtered.length === 0 ? (
              <div className="text-center py-24 text-foreground/40 font-light">
                {allStudents.length === 0 ? "No members registered yet." : "No registered members match your search."}
              </div>
            ) : (
              <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((s) => {
                  const gh = (s.githubUsername || s.github_username || s.username || "").toLowerCase();
                  const sId = (s.id || "").toLowerCase();
                  const sNm = (s.name || "").toLowerCase();
                  const pMember = promotedMap.get(sId) || promotedMap.get(gh) || promotedMap.get(sNm);
                  return <MemberCard key={s.id} student={s} promotedMember={pMember} />;
                })}
              </motion.div>
            )}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default Members;
