/**
 * /members/:username — Student profile page.
 *
 * Enhancements over v1:
 *   • GitHub contribution heatmap via ghchart.rshah.org (free SVG embed)
 *   • Top repos sorted by stars → forks → recency (not just push date)
 *   • Recharts PieChart donut for language breakdown
 *   • Shareable link copy button
 *   • GitHub account age ("on GitHub since YYYY")
 *   • All GitHub data cached 30 min (no hammering the API)
 *   • Edit → navigates to /members/:username/edit (full CRUD page)
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  PieChart, Pie, Cell, Tooltip as RechartTooltip, ResponsiveContainer, Legend,
} from "recharts";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Github, Linkedin, MapPin, Building2, Globe, Star, GitFork,
  ExternalLink, FileText, Printer, Loader2, AlertTriangle,
  GraduationCap, Briefcase, Award, Code2, BookOpen, Edit3,
  LogOut, ChevronRight, Copy, Check, Calendar, Users, RefreshCw, Eye, EyeOff, Key, Plus, Crown, ShieldCheck,
} from "lucide-react";
import {
  getStudentByGithub, updateStudent, deleteStudent,
  type StudentProfile, type EducationEntry,
  type ExperienceEntry, type CertificationEntry,
} from "@/lib/studentStore";
import { getStudentByUsername } from "@/lib/services/studentService";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  fetchGHUser, fetchGHRepos, aggregateLanguages,
  langPercents, langColor, topRepos, clearGHCache,
  type GHUser, type GHRepo, type GHLanguageMap,
} from "@/lib/githubApi";
import { openResumePrintWindow, previewResume } from "@/components/ResumeDocument";
import ResumeBuilderModal from "@/components/ResumeBuilderModal";
import { RoleApplicationModal } from "@/components/RoleApplicationModal";
import {
  getPromotedMembers,
  fetchPromotedMembersRemote,
  generateUniqueAdminKey,
  getOwnAdminKey,
  WING_METADATA,
  type PromotedMember,
} from "@/lib/services/hierarchyService";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import ContributionGraph from "@/components/ContributionGraph";
import { buildAutoProfile, profileNeedsAutoFill } from "@/lib/autoProfile";
import { useToast } from "@/components/ui/use-toast";

// ─── MOTION VARIANTS ─────────────────────────────────────────────────────────

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };

// ─── SMALL HELPERS ────────────────────────────────────────────────────────────

const StatPill = ({ label, value }: { label: string; value: number | string }) => (
  <div className="flex flex-col items-center gap-1 px-5 py-3 glass rounded-2xl min-w-[80px]">
    <span className="text-lg font-heading font-light text-foreground">{value}</span>
    <span className="text-[10px] uppercase tracking-widest text-foreground/50">{label}</span>
  </div>
);


const getDesignationBadge = (info: PromotedMember) => {
  const wingLabel = info.wing ? WING_METADATA[info.wing]?.label || info.wing : null;

  if (info.tier === 1) {
    return {
      icon: <Crown size={14} className="text-amber-500 shrink-0" />,
      title: info.roleTitle,
      subtitle: "Executive Board",
      tag: "Tier 1",
      containerClass: "bg-amber-500/10 text-amber-900 dark:text-amber-200 border-amber-500/40 shadow-xs",
      pillClass: "bg-amber-500/20 text-amber-900 dark:text-amber-100 border-amber-500/30",
    };
  }
  if (info.tier === 2) {
    return {
      icon: <Briefcase size={14} className="text-primary shrink-0" />,
      title: wingLabel ? `${info.roleTitle} · ${wingLabel}` : info.roleTitle,
      subtitle: "Functional Head",
      tag: "Tier 2",
      containerClass: "bg-primary/10 text-primary dark:text-primary-foreground border-primary/40 shadow-xs",
      pillClass: "bg-primary/20 text-primary dark:text-primary-foreground border-primary/30",
    };
  }
  return {
    icon: <Users size={14} className="text-emerald-500 shrink-0" />,
    title: wingLabel ? `Club Volunteer · ${wingLabel}` : "Club Volunteer",
    subtitle: "Appointed Member",
    tag: "Tier 3",
    containerClass: "bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 border-emerald-500/40 shadow-xs",
    pillClass: "bg-emerald-500/20 text-emerald-900 dark:text-emerald-100 border-emerald-500/30",
  };
};

const SectionTitle = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
      <Icon size={16} className="text-primary" />
    </div>
    <h2 className="text-sm font-heading uppercase tracking-[0.2em] text-foreground/70">{title}</h2>
  </div>
);

/** Empty section placeholder shown only on own profile */
const EmptyCTA = ({
  icon: Icon, label, editUrl, hint,
}: { icon: React.ElementType; label: string; editUrl: string; hint: string }) => (
  <Link to={editUrl}>
    <div className="flex items-center gap-4 p-5 glass rounded-2xl hover:bg-primary/5 transition-all group cursor-pointer border border-dashed border-foreground/15 hover:border-primary/30">
      <div className="w-9 h-9 rounded-xl bg-foreground/5 group-hover:bg-primary/10 flex items-center justify-center transition-colors flex-shrink-0">
        <Icon size={16} className="text-foreground/30 group-hover:text-primary transition-colors" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-light text-foreground/60 group-hover:text-foreground transition-colors">
          Add {label}
        </p>
        <p className="text-xs text-foreground/30 font-light">{hint}</p>
      </div>
      <Plus size={14} className="text-foreground/25 group-hover:text-primary transition-colors flex-shrink-0" />
    </div>
  </Link>
);

/** Recharts donut for language breakdown */
const LangDonut = ({ langs }: { langs: { lang: string; pct: number }[] }) => {
  const top = langs.slice(0, 7);
  const otherPct = Math.max(0, 100 - top.reduce((s, l) => s + l.pct, 0));
  const data = [
    ...top.map((l) => ({ name: l.lang, value: l.pct, color: langColor(l.lang) })),
    ...(otherPct > 0.5 ? [{ name: "Other", value: otherPct, color: "#8b8b8b" }] : []),
  ];

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <RechartTooltip
            formatter={(value: number) => [`${value}%`, "Usage"]}
            contentStyle={{
              background: "hsl(var(--card))",
              border: "none",
              borderRadius: "12px",
              fontSize: "12px",
              color: "hsl(var(--foreground))",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="space-y-1.5">
        {data.map(({ name, value, color }) => (
          <div key={name} className="flex items-center justify-between text-xs font-light text-foreground/70">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
              {name}
            </span>
            <span className="text-foreground/50">{value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const RepoCard = ({ repo }: { repo: GHRepo }) => (
  <motion.a
    href={repo.html_url}
    target="_blank"
    rel="noopener noreferrer"
    variants={fadeUp}
    className="block glass rounded-2xl p-5 hover:bg-primary/5 transition-all duration-300 group"
  >
    <div className="flex items-start justify-between gap-2">
      <div className="space-y-1 flex-1 min-w-0">
        <p className="font-heading font-light tracking-wide text-foreground truncate group-hover:text-primary transition-colors">
          {repo.name}
        </p>
        {repo.description && (
          <p className="text-xs text-foreground/50 font-light line-clamp-2">{repo.description}</p>
        )}
        {repo.topics.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {repo.topics.slice(0, 4).map((t) => (
              <Badge key={t} variant="secondary" className="text-[9px] font-light px-2 py-0">{t}</Badge>
            ))}
          </div>
        )}
      </div>
      <ExternalLink size={14} className="text-foreground/30 group-hover:text-primary flex-shrink-0 mt-1 transition-colors" />
    </div>
    <div className="flex items-center gap-4 mt-3 text-xs text-foreground/40">
      {repo.language && (
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: langColor(repo.language) }} />
          {repo.language}
        </span>
      )}
      {repo.stargazers_count > 0 && (
        <span className="flex items-center gap-1"><Star size={11} />{repo.stargazers_count}</span>
      )}
      {repo.forks_count > 0 && (
        <span className="flex items-center gap-1"><GitFork size={11} />{repo.forks_count}</span>
      )}
    </div>
  </motion.a>
);

/** Copy-to-clipboard button that shows a checkmark for 2 s */
const CopyLinkButton = ({ url }: { url: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      title="Copy profile link"
      className="flex items-center gap-1.5 text-xs text-foreground/40 hover:text-primary transition-colors"
    >
      {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
      <span className="font-light">{copied ? "Copied!" : "Copy link"}</span>
    </button>
  );
};

// ─── PAGE ─────────────────────────────────────────────────────────────────────

type LoadStatus = "loading" | "error" | "not_found" | "ok";

const MemberProfile = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { session, logout } = useStudentAuth();
  const { toast } = useToast();

  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [ghUser, setGhUser] = useState<GHUser | null>(null);
  const [repos, setRepos] = useState<GHRepo[]>([]);
  const [langMap, setLangMap] = useState<GHLanguageMap>({});
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [repoFilter, setRepoFilter] = useState<"top" | "all" | "starred">("top");
  const [resumeBuilderOpen, setResumeBuilderOpen] = useState(false);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [showAdminKey, setShowAdminKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  // Key value is kept in React state only — read from vault, never from member blob
  const [adminKeyValue, setAdminKeyValue] = useState<string | undefined>(undefined);
  const [promotedInfo, setPromotedInfo] = useState<PromotedMember | null>(null);

  const isOwn = session?.githubUsername?.toLowerCase() === username?.toLowerCase();
  const profileUrl = `${window.location.origin}/members/${username}`;

  // Check if this student is promoted in the hierarchy tree
  useEffect(() => {
    let isMounted = true;
    const checkPromotion = () => {
      if (!isMounted) return;
      const list = getPromotedMembers();
      const found = list.find(
        (m) =>
          (student?.id && m.studentId === student.id) ||
          (username && m.githubUsername?.toLowerCase() === username.toLowerCase()) ||
          (student?.name && m.name.toLowerCase() === student.name.toLowerCase())
      );
      setPromotedInfo(found || null);
      // Load key from vault or cross-device synced record (own profile only)
      if (found && found.hasAdminKey) {
        const existingKey = getOwnAdminKey(found.studentId || found.githubUsername);
        setAdminKeyValue(existingKey);
      } else {
        setAdminKeyValue(undefined);
      }
    };
    checkPromotion();

    // Fetch remote promotions so mobile immediately resolves role & admin key
    fetchPromotedMembersRemote().then(() => {
      if (isMounted) checkPromotion();
    });

    window.addEventListener("ts_hierarchy_updated", checkPromotion);
    return () => {
      isMounted = false;
      window.removeEventListener("ts_hierarchy_updated", checkPromotion);
    };
  }, [student, username]);

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const load = useCallback(async () => {
    if (!username) { setStatus("not_found"); return; }
    setStatus("loading");
    try {
      let s: any = null;
      let searchedRemote = false;

      if (isSupabaseConfigured()) {
        searchedRemote = true;
        try {
          const remote = await getStudentByUsername(username);
          if (remote) {
            s = {
              ...remote,
              githubUsername: remote.github_username || remote.githubUsername,
              name: remote.name || remote.username,
              avatar: (remote as any).avatar || (remote as any).avatar_url || (remote as any).profiles?.avatar_url,
              linkedinUrl: remote.linkedin_url || (remote as any).linkedinUrl,
              portfolioUrl: remote.portfolio_url || (remote as any).portfolioUrl,
              education: remote.education || [],
              experience: remote.experience || [],
              certifications: remote.certifications || [],
            };
          }
        } catch (_e) {}
      }

      // If Supabase was queried and returned null, user was deleted directly from DB.
      // Clean stale entry from local store and show 404 not found.
      if (searchedRemote && !s) {
        const local = getStudentByGithub(username);
        if (local) {
          deleteStudent(local.id);
        }
        setStatus("not_found");
        return;
      }

      if (!s) {
        s = getStudentByGithub(username);
      }
      if (!s) { setStatus("not_found"); return; }
      setStudent(s);

      const [user, repoList] = await Promise.all([
        fetchGHUser(username),
        fetchGHRepos(username),
      ]);
      setGhUser(user);
      setRepos(repoList);
      aggregateLanguages(username, repoList).then((map) => {
        setLangMap(map);
        const isOwner = sessionRef.current?.githubUsername?.toLowerCase() === username.toLowerCase();
        const fresh = getStudentByGithub(username);
        if (isOwner && fresh && profileNeedsAutoFill(fresh)) {
          const { updates, summary } = buildAutoProfile(fresh, user, repoList, map);
          if (Object.keys(updates).length > 0) {
            const saved = updateStudent(fresh.id, updates);
            if (saved) {
              setStudent(saved);
              toastRef.current({
                title: "Profile auto-filled from GitHub ✓",
                description: summary.join(" · "),
              });
            }
          }
        }
      }).catch(() => {});
      setStatus("ok");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      setStatus(msg === "NOT_FOUND" ? "not_found" : "error");
    }
  }, [username]);

  useEffect(() => { load(); }, [load]);

  // Listen for avatar updates dispatched from MemberEdit after save
  useEffect(() => {
    const handler = (e: Event) => {
      const { avatarUrl, studentId, githubUsername } =
        (e as CustomEvent<{ avatarUrl: string; studentId?: string; githubUsername?: string }>).detail || {};
      if (avatarUrl && (studentId || githubUsername)) {
        setStudent((prev) => {
          if (!prev) return prev;
          const isMatch =
            (studentId && (prev.id === studentId || (prev as any).studentId === studentId)) ||
            (githubUsername && (prev.githubUsername || "").toLowerCase() === githubUsername.toLowerCase()) ||
            (username && githubUsername && username.toLowerCase() === githubUsername.toLowerCase());
          return isMatch ? { ...prev, avatar: avatarUrl } : prev;
        });
      }
    };
    window.addEventListener("ts_avatar_updated", handler);
    return () => window.removeEventListener("ts_avatar_updated", handler);
  }, [username]);

  // ── Error states ─────────────────────────────────────────────────────────

  if (status === "not_found") return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-6 text-center px-4">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Github size={36} className="text-primary/60" />
        </div>
        <h1 className="text-3xl font-heading font-light tracking-widest uppercase">Profile Not Found</h1>
        <p className="text-foreground/50 font-light">No TechShastra member with GitHub username <strong>{username}</strong></p>
        <Button onClick={() => navigate("/join")} className="rounded-full px-8">Sign Up</Button>
      </div>
      <Footer />
    </div>
  );

  if (status === "error") return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 px-4">
        <AlertTriangle size={40} className="text-destructive" />
        <p className="text-foreground/60 font-light">Failed to load profile. GitHub API may be rate-limited.</p>
        <Button variant="outline" onClick={load} className="rounded-full">Try Again</Button>
      </div>
      <Footer />
    </div>
  );

  if (status === "loading" || !student) return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      <Navbar />
      <div className="flex-1 flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4 text-center px-4 max-w-md">
          <div className="w-16 h-16 rounded-3xl glass flex items-center justify-center shadow-xl">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-xl font-heading font-light tracking-wide text-foreground">
              {username ? `Loading @${username}` : "Loading Profile"}
            </p>
            <p className="text-foreground/40 text-xs font-light">
              Connecting to TechShastra and syncing developer statistics...
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );

  // ── Derived data ─────────────────────────────────────────────────────────

  const langs = langPercents(langMap);
  const ghSince = ghUser?.created_at
    ? new Date(ghUser.created_at).getFullYear()
    : null;

  const displayRepos = repoFilter === "top"
    ? topRepos(repos, 12)
    : repoFilter === "starred"
      ? repos.filter((r) => r.stargazers_count > 0).slice(0, 18)
      : repos.slice(0, 18);

  const totalStars = repos.reduce((s, r) => s + r.stargazers_count, 0);
  const originalRepos = repos.filter((r) => !r.fork).length;

  // ── Profile completeness ──────────────────────────────────────────────────
  const completenessFields = [
    { label: "Bio",              done: !!(ghUser?.bio ?? student.bio) },
    { label: "Skills",          done: student.skills.length > 0 },
    { label: "Education",       done: student.education.length > 0 },
    { label: "Experience",      done: student.experience.length > 0 },
    { label: "Certifications",  done: student.certifications.length > 0 },
    { label: "LinkedIn",        done: !!student.linkedinUrl },
    { label: "Portfolio",       done: !!student.portfolioUrl },
  ];
  const completenessScore = Math.round(
    (completenessFields.filter((f) => f.done).length / completenessFields.length) * 100
  );
  const missingFields = completenessFields.filter((f) => !f.done).map((f) => f.label);

  // ── Print-only resume ─────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-24 max-w-6xl">

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <motion.div initial="hidden" animate="show" variants={stagger}
          className="flex flex-col md:flex-row items-start gap-6 md:gap-8 mb-8 md:mb-10">

          {/* Top Row on Mobile: Avatar on Left, Name & Details on Right | Desktop: Left Avatar */}
          <div className="flex items-center md:items-start gap-4 md:gap-8 w-full md:w-auto">
            {/* Avatar */}
            <motion.div variants={fadeUp} className="flex-shrink-0">
              <div className="w-20 h-20 xs:w-24 xs:h-24 sm:w-28 sm:h-28 md:w-36 md:h-36 rounded-2xl md:rounded-3xl overflow-hidden ring-4 ring-primary/20 shadow-xl bg-card">
                {student.avatar || ghUser?.avatar_url || student.githubUsername ? (
                  <img
                    src={student.avatar || ghUser?.avatar_url || `https://github.com/${student.githubUsername}.png`}
                    alt={student.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                    <span className="text-3xl md:text-4xl font-heading text-primary">{student.name[0]?.toUpperCase() ?? "U"}</span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Mobile-only Name + Username + Course next to Avatar */}
            <div className="flex-1 min-w-0 md:hidden space-y-1">
              <motion.div variants={fadeUp}>
                <h1 className="text-2xl xs:text-3xl font-heading font-light tracking-tight text-foreground leading-tight">
                  {student.name || ghUser?.name}
                </h1>
                {promotedInfo && (() => {
                  const badge = getDesignationBadge(promotedInfo);
                  return (
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-medium my-1 ${badge.containerClass}`}>
                      {badge.icon}
                      <span className="font-semibold truncate max-w-[170px]">{badge.title}</span>
                    </div>
                  );
                })()}
                <div className="flex items-center gap-2 mt-1 flex-wrap text-xs">
                  <p className="text-foreground/50 font-light">@{student.githubUsername}</p>
                  <CopyLinkButton url={profileUrl} />
                </div>
              </motion.div>

              {student.course && (
                <div className="text-xs text-foreground/60 font-light flex items-center gap-1.5 pt-0.5">
                  <GraduationCap size={12} className="text-primary shrink-0" />
                  <span className="truncate">{student.course}{student.year ? `, ${student.year}` : ""}</span>
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-3 w-full">
            {/* Desktop-only Name + Username */}
            <motion.div variants={fadeUp} className="hidden md:block">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl md:text-5xl font-heading font-light tracking-tight text-foreground">
                  {ghUser?.name ?? student.name}
                </h1>
                {promotedInfo && (() => {
                  const badge = getDesignationBadge(promotedInfo);
                  return (
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium ${badge.containerClass}`}>
                      {badge.icon}
                      <span className="font-semibold tracking-wide">{badge.title}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full border border-current/20 opacity-90">
                        {badge.tag}
                      </span>
                    </div>
                  );
                })()}
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <p className="text-foreground/50 font-light">@{student.githubUsername}</p>
                <CopyLinkButton url={profileUrl} />
              </div>
            </motion.div>

            {(ghUser?.bio ?? student.bio) && (
              <motion.p variants={fadeUp} className="text-xs sm:text-sm md:text-base text-foreground/70 font-light max-w-2xl italic">
                {ghUser?.bio ?? student.bio}
              </motion.p>
            )}

            {/* Meta row */}
            <motion.div variants={fadeUp} className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-foreground/50 font-light">
              {student.course && (
                <span className="hidden md:flex items-center gap-1">
                  <GraduationCap size={12} />{student.course}{student.year ? `, ${student.year}` : ""}
                </span>
              )}
              {ghUser?.location && <span className="flex items-center gap-1"><MapPin size={12} />{ghUser.location}</span>}
              {ghUser?.company && <span className="flex items-center gap-1"><Building2 size={12} />{ghUser.company}</span>}
              {ghSince && (
                <span className="flex items-center gap-1"><Calendar size={12} />On GitHub since {ghSince}</span>
              )}
              {ghUser?.blog && (
                <a href={ghUser.blog} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-primary transition-colors">
                  <Globe size={12} />{ghUser.blog.replace(/^https?:\/\//, "")}
                </a>
              )}
            </motion.div>

            {/* Social badges */}
            <motion.div variants={fadeUp} className="flex flex-wrap gap-2 pt-1">
              <a href={`https://github.com/${student.githubUsername}`} target="_blank" rel="noopener noreferrer">
                <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 text-xs font-light hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer">
                  <Github size={12} /> GitHub
                </Badge>
              </a>
              {student.linkedinUrl && (
                <a href={student.linkedinUrl} target="_blank" rel="noopener noreferrer">
                  <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 text-xs font-light hover:bg-[#0077b5] hover:text-white transition-all cursor-pointer">
                    <Linkedin size={12} /> LinkedIn
                  </Badge>
                </a>
              )}
              {student.portfolioUrl && (
                <a href={student.portfolioUrl} target="_blank" rel="noopener noreferrer">
                  <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 text-xs font-light hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer">
                    <Globe size={12} /> Portfolio
                  </Badge>
                </a>
              )}
            </motion.div>
          </div>

          {/* Actions */}
          <motion.div variants={fadeUp} className="grid grid-cols-2 sm:grid-cols-3 md:flex md:flex-col gap-2 w-full md:w-auto flex-shrink-0 min-w-[170px] pt-1 md:pt-0">
            {isOwn && (
              <>
                <Button size="sm" variant="outline" className="rounded-full gap-2 justify-center md:justify-start text-xs font-light"
                  onClick={() => navigate(`/members/${username}/edit`)}>
                  <Edit3 size={13} /> Edit Profile
                </Button>
                <Button size="sm" className="rounded-full gap-2 justify-center md:justify-start text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                  onClick={() => navigate("/student")}>
                  <Code2 size={13} /> Coding Hub
                </Button>
                <Button size="sm" variant="outline" className="rounded-full gap-2 justify-center md:justify-start text-xs font-light"
                  onClick={() => setResumeBuilderOpen(true)}>
                  <FileText size={13} /> Resume
                </Button>
                <Button size="sm" variant="outline" className="rounded-full gap-2 justify-center md:justify-start text-xs font-light"
                  onClick={() => openResumePrintWindow(student, ghUser, repos, langMap)}>
                  <Printer size={13} /> Print PDF
                </Button>
                <Button size="sm" variant="outline" className="rounded-full gap-2 justify-center md:justify-start text-xs font-light"
                  title="Re-sync skills, bio and experience from your latest GitHub data"
                  onClick={async () => {
                    if (!username || !student || !ghUser) return;
                    clearGHCache(username);
                    toast({ title: "Refreshing from GitHub…", description: "Fetching latest data." });
                    try {
                      const [freshUser, freshRepos] = await Promise.all([
                        fetchGHUser(username),
                        fetchGHRepos(username),
                      ]);
                      setGhUser(freshUser);
                      setRepos(freshRepos);
                      const freshMap = await aggregateLanguages(username, freshRepos);
                      setLangMap(freshMap);
                      // Force-run auto-fill (ignore the "needs fill" guard)
                      const { updates, summary } = buildAutoProfile(student, freshUser, freshRepos, freshMap);
                      if (Object.keys(updates).length > 0) {
                        const saved = updateStudent(student.id, updates);
                        if (saved) {
                          setStudent(saved);
                          toast({ title: "Profile updated ✓", description: summary.join(" · ") });
                        }
                      } else {
                        toast({ title: "Already up to date", description: "No new data found on GitHub." });
                      }
                    } catch {
                      toast({ title: "Refresh failed", description: "GitHub may be rate-limited.", variant: "destructive" });
                    }
                  }}>
                  <RefreshCw size={13} /> Sync GitHub
                </Button>
                <Button size="sm" className="rounded-full gap-2 justify-center md:justify-start text-xs font-medium bg-red-600 hover:bg-red-700 text-white shadow-sm border-0 transition-all duration-200"
                  onClick={() => setApplyModalOpen(true)}>
                  <Briefcase size={13} className="text-white" /> Apply for Role
                </Button>
              </>
            )}
          </motion.div>
        </motion.div>

        {/* ── STATS ROW ────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="grid grid-cols-2 sm:grid-cols-3 md:flex md:flex-wrap gap-2.5 sm:gap-3 mb-8 sm:mb-10">
          <StatPill label="Repos" value={originalRepos} />
          <StatPill label="Stars" value={totalStars} />
          <StatPill label="Followers" value={ghUser?.followers ?? 0} />
          <StatPill label="Following" value={ghUser?.following ?? 0} />
          {langs[0] && <StatPill label="Top Lang" value={langs[0].lang} />}
        </motion.div>

        {/* ── ADMIN ACCESS CLEARANCE KEY (Promoted Tier 1 & Functional Heads) ── */}
        {isOwn && promotedInfo && promotedInfo.tier <= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className="mb-8 p-5 sm:p-6 rounded-3xl glass border border-primary/30 bg-primary/[0.03] shadow-lg relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5 max-w-lg">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground text-[10px] font-semibold px-2 py-0.5">
                    {promotedInfo.roleTitle}
                  </Badge>
                  <span className="text-xs font-medium text-emerald-500 flex items-center gap-1">
                    <Check size={12} /> Official Leadership Clearance (Tier {promotedInfo.tier})
                  </span>
                </div>
                <h3 className="text-base font-heading font-medium text-foreground tracking-wide">
                  Administrative Access Clearance
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  As an appointed {promotedInfo.roleTitle}, you possess administrative clearance.
                  Use your registered name (<strong className="text-foreground">{promotedInfo.name}</strong>) and your secret access key to log into the Admin Panel at <code className="text-primary font-mono text-[11px]">/admin</code>.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                {!adminKeyValue ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      try {
                        const key = generateUniqueAdminKey(promotedInfo.studentId || promotedInfo.githubUsername);
                        toast({
                          title: "Admin Access Key Generated! 🔑",
                          description: "Keep your key secure. You will use your Name and this Key to access the Admin Panel.",
                        });
                        setAdminKeyValue(key);
                      } catch (e: any) {
                        toast({ title: "Key Generation Error", description: e.message, variant: "destructive" });
                      }
                    }}
                    className="rounded-2xl text-xs h-9 px-5 bg-primary text-primary-foreground font-medium gap-2 shadow-sm shadow-primary/20 hover:bg-primary/90"
                  >
                    <Key size={14} /> Generate Access Key
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 p-2 rounded-2xl bg-card border border-border/80 shadow-inner">
                    <div className="font-mono text-xs px-3 py-1 rounded-xl bg-background text-primary font-medium tracking-wider select-all">
                      {showAdminKey ? adminKeyValue : "••••-••••-••••-••••"}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAdminKey(!showAdminKey)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title={showAdminKey ? "Hide key" : "View key"}
                    >
                      {showAdminKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (adminKeyValue) {
                          navigator.clipboard.writeText(adminKeyValue);
                          setCopiedKey(true);
                          toast({ title: "Copied to Clipboard ✓", description: "Admin access key copied." });
                          setTimeout(() => setCopiedKey(false), 2000);
                        }
                      }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="Copy Key"
                    >
                      {copiedKey ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── COMPLETENESS BANNER (own profile only) ───────────────────── */}
        {isOwn && completenessScore < 100 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="mb-10 glass rounded-2xl p-5 flex items-center gap-5 flex-wrap">
            {/* Ring */}
            <div className="relative flex-shrink-0">
              <svg width="56" height="56" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="22" fill="none" stroke="currentColor"
                  strokeWidth="4" className="text-foreground/10" />
                <circle cx="28" cy="28" r="22" fill="none" stroke="currentColor"
                  strokeWidth="4" strokeLinecap="round" className="text-primary"
                  strokeDasharray={`${2 * Math.PI * 22}`}
                  strokeDashoffset={`${2 * Math.PI * 22 * (1 - completenessScore / 100)}`}
                  transform="rotate(-90 28 28)" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-heading font-light text-foreground">
                {completenessScore}%
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-heading font-light tracking-wide text-foreground mb-1">
                Profile {completenessScore}% complete
              </p>
              <p className="text-xs text-foreground/50 font-light">
                Missing: {missingFields.join(", ")}
              </p>
            </div>
            <Link to={`/members/${username}/edit`}>
              <Button size="sm" className="rounded-full gap-2 flex-shrink-0">
                <Edit3 size={13} /> Complete Profile
              </Button>
            </Link>
          </motion.div>
        )}
        {/* ── CONTRIBUTION HEATMAP ─────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="mb-10">
          <Card className="glass border-0 rounded-3xl overflow-hidden">
            <CardHeader className="pb-2 pt-6 px-6">
              <SectionTitle icon={Github} title="Contribution Activity" />
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <ContributionGraph username={student.githubUsername} />
            </CardContent>
          </Card>
        </motion.div>

        {/* ── MAIN GRID ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* LEFT COLUMN */}
          <div className="space-y-8">

            {/* Language donut */}
            {langs.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="glass border-0 rounded-3xl">
                  <CardHeader className="pb-0">
                    <SectionTitle icon={Code2} title="Language Breakdown" />
                  </CardHeader>
                  <CardContent>
                    <LangDonut langs={langs} />
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Skills */}
            {student.skills.length > 0 ? (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <Card className="glass border-0 rounded-3xl">
                  <CardHeader className="pb-0">
                    <SectionTitle icon={Award} title="Skills" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {student.skills.map((s) => (
                        <Badge key={s} variant="secondary" className="font-light text-xs">{s}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : isOwn ? (
              <EmptyCTA icon={Award} label="Skills" editUrl={`/members/${username}/edit`} hint="Add your tech stack" />
            ) : null}

            {/* Interests */}
            {student.interests.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <Card className="glass border-0 rounded-3xl">
                  <CardHeader className="pb-0">
                    <SectionTitle icon={BookOpen} title="Interests" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {student.interests.map((i) => (
                        <Badge key={i} className="font-light text-[10px] bg-primary/10 text-primary border-0">{i}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Certifications */}
            {student.certifications.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
                <Card className="glass border-0 rounded-3xl">
                  <CardHeader className="pb-0">
                    <SectionTitle icon={Award} title="Certifications" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {student.certifications.map((c: CertificationEntry) => (
                      <div key={c.id} className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-light text-foreground">{c.name}</p>
                          <p className="text-xs text-foreground/50">{c.issuer}{c.date ? ` · ${c.date}` : ""}</p>
                        </div>
                        {c.url && (
                          <a href={c.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink size={13} className="text-foreground/30 hover:text-primary mt-1 transition-colors" />
                          </a>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Members directory link */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <Link to="/members">
                <div className="flex items-center gap-3 px-5 py-4 glass rounded-2xl hover:bg-primary/5 transition-all group cursor-pointer">
                  <Users size={16} className="text-primary/60 group-hover:text-primary transition-colors" />
                  <span className="text-xs font-light tracking-widest uppercase text-foreground/50 group-hover:text-foreground transition-colors">
                    Browse Members
                  </span>
                  <ChevronRight size={13} className="ml-auto text-foreground/30 group-hover:text-primary transition-colors" />
                </div>
              </Link>
            </motion.div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="lg:col-span-2 space-y-8">

            {/* Education */}
            {student.education.length > 0 ? (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="glass border-0 rounded-3xl">
                  <CardHeader className="pb-0">
                    <SectionTitle icon={GraduationCap} title="Education" />
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {student.education.map((e: EducationEntry) => (
                      <div key={e.id} className="flex items-start gap-4">
                        <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <p className="font-heading font-light tracking-wide text-foreground">{e.institution}</p>
                            <span className="text-xs text-foreground/40 flex-shrink-0">{e.startYear}–{e.endYear ?? "Present"}</span>
                          </div>
                          <p className="text-sm text-foreground/60 font-light mt-0.5">
                            {e.degree}{e.field ? `, ${e.field}` : ""}{e.grade ? ` · ${e.grade}` : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            ) : isOwn ? (
              <EmptyCTA icon={GraduationCap} label="Education" editUrl={`/members/${username}/edit`} hint="Add your university or college" />
            ) : null}

            {/* Experience */}
            {student.experience.length > 0 ? (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <Card className="glass border-0 rounded-3xl">
                  <CardHeader className="pb-0">
                    <SectionTitle icon={Briefcase} title="Experience" />
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {student.experience.map((x: ExperienceEntry) => (
                      <div key={x.id} className="flex items-start gap-4">
                        <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <p className="font-heading font-light tracking-wide text-foreground">{x.role}</p>
                            <span className="text-xs text-foreground/40 flex-shrink-0">{x.startDate}–{x.endDate ?? "Present"}</span>
                          </div>
                          <p className="text-sm text-foreground/60 font-light">{x.company}</p>
                          {x.description && <p className="text-xs text-foreground/50 mt-1 font-light">{x.description}</p>}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            ) : isOwn ? (
              <EmptyCTA icon={Briefcase} label="Experience" editUrl={`/members/${username}/edit`} hint="Add internships, jobs, or open source work" />
            ) : null}

            {/* Repos */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <Card className="glass border-0 rounded-3xl">
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <SectionTitle icon={Github} title="GitHub Repositories" />
                    <div className="flex gap-2 mb-4">
                      {(["top", "all", "starred"] as const).map((f) => (
                        <button key={f} onClick={() => setRepoFilter(f)}
                          className={`px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-light transition-all duration-300 ${repoFilter === f ? "bg-primary text-primary-foreground" : "glass text-foreground/50 hover:text-foreground"}`}>
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {displayRepos.length === 0
                    ? <p className="text-foreground/40 font-light text-sm text-center py-6">No repositories to display.</p>
                    : (
                      <motion.div variants={stagger} initial="hidden" animate="show"
                        className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {displayRepos.map((repo) => <RepoCard key={repo.id} repo={repo} />)}
                      </motion.div>
                    )
                  }
                  {repos.length > 18 && (
                    <div className="mt-4 text-center">
                      <a href={`https://github.com/${student.githubUsername}?tab=repositories`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-xs text-foreground/50 hover:text-primary font-light inline-flex items-center gap-1 transition-colors">
                        View all on GitHub <ChevronRight size={12} />
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

          </div>
        </div>
      </div>

      {student && (
        <>
          <ResumeBuilderModal
            open={resumeBuilderOpen}
            onOpenChange={setResumeBuilderOpen}
            student={student}
            ghUser={ghUser}
            repos={repos}
            langMap={langMap}
            onSaveToProfile={(updates) => {
              const updated = updateStudent(student.id, updates);
              if (updated) setStudent(updated);
            }}
          />
          <RoleApplicationModal
            open={applyModalOpen}
            onClose={() => setApplyModalOpen(false)}
            student={student}
          />
        </>
      )}

      <Footer />
    </div>
  );
};

export default MemberProfile;
