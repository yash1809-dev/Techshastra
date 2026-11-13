/**
 * /members — Directory of all registered TechShastra students.
 * Visible to logged-in students + admins.
 */

import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Github, Linkedin, Search, Users, GraduationCap, Globe } from "lucide-react";
import { getAllStudents as getLocalStudents, type StudentProfile } from "@/lib/studentStore";
import { getAllStudents as getRemoteStudents } from "@/lib/services/studentService";
import { useStudentAuth } from "@/hooks/useStudentAuth";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

const MemberCard = ({ student }: { student: any }) => {
  const ghUser = student.githubUsername || student.github_username || student.username;
  const displayName = student.name || student.username || "Member";
  const avatarSrc = student.avatar || student.avatar_url || student.profiles?.avatar_url || (ghUser ? `https://avatars.githubusercontent.com/${ghUser}?s=80` : "");
  const interestsList = student.interests || [];
  return (
    <motion.div variants={fadeUp}>
      <Link to={`/members/${ghUser}`}>
        <div className="glass rounded-3xl p-6 hover:bg-primary/5 transition-all duration-300 group cursor-pointer h-full flex flex-col gap-4">

          {/* Avatar + name */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl overflow-hidden ring-2 ring-primary/20 flex-shrink-0 bg-primary/10 flex items-center justify-center">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : null}
              <span className="text-xl font-heading text-primary">
                {displayName[0]?.toUpperCase() || "M"}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-heading font-light tracking-wide text-foreground group-hover:text-primary transition-colors truncate">
                {displayName}
              </p>
              <p className="text-xs text-foreground/40 font-light">@{ghUser}</p>
            </div>
          </div>

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
          <div className="flex items-center gap-3 text-foreground/30">
            <Github size={14} />
            {(student.linkedinUrl || student.linkedin_url) && <Linkedin size={14} />}
            {(student.portfolioUrl || student.portfolio_url) && <Globe size={14} />}
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

const Members = () => {
  const navigate = useNavigate();
  const { session } = useStudentAuth();
  const [query, setQuery] = useState("");
  const [filterInterest, setFilterInterest] = useState<string | null>(null);
  const [allStudents, setAllStudents] = useState<any[]>([]);

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
        setAllStudents(Array.from(map.values()));
      } catch (_e) {
        const local = getLocalStudents().filter((s) => s.is_active);
        setAllStudents(local);
      }
    };
    loadStudents();

    const handler = (e: Event) => {
      const { avatarUrl, studentId } = (e as CustomEvent<{ avatarUrl: string; studentId: string }>).detail || {};
      if (avatarUrl) {
        setAllStudents((prev) =>
          prev.map((s) => (s.id === studentId || s.studentId === studentId ? { ...s, avatar: avatarUrl } : s))
        );
      }
    };
    window.addEventListener("ts_avatar_updated", handler);
    return () => window.removeEventListener("ts_avatar_updated", handler);
  }, []);

  // Collect all unique interests for filter chips
  const allInterests = useMemo(() => {
    const set = new Set<string>();
    allStudents.forEach((s) => (s.interests || []).forEach((i: string) => set.add(i)));
    return Array.from(set).sort();
  }, [allStudents]);

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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-24 max-w-6xl">

        {/* Header */}
        <div className="text-center mb-16 space-y-6">
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full glass text-[10px] tracking-[0.2em] uppercase text-primary font-medium">
            <Users size={12} /> {allStudents.length} Members
          </div>
          <h1 className="text-4xl md:text-7xl font-heading font-light tracking-tight">
            <span className="text-foreground">Member </span>
            <span className="text-primary italic">Directory</span>
          </h1>
          <p className="text-lg text-foreground/50 max-w-xl mx-auto font-light italic">
            Explore the builders, hackers, and innovators of TechShastra.
          </p>
        </div>

        {/* Your profile shortcut */}
        {session && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-5 glass rounded-2xl flex items-center justify-between flex-wrap gap-3">
            <span className="text-sm text-foreground/60 font-light">
              Signed in as <strong className="text-foreground">{session.name}</strong>
            </span>
            <Button size="sm" variant="outline" className="rounded-full"
              onClick={() => navigate(`/members/${session.githubUsername}`)}>
              My Profile →
            </Button>
          </motion.div>
        )}

        {/* Search */}
        <div className="relative mb-6">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/30" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, username, course, skill, interest…"
            className="pl-10 glass h-14 rounded-2xl border-0 focus-visible:ring-1 focus-visible:ring-primary/30 text-sm font-light"
          />
        </div>

        {/* Interest filters */}
        {allInterests.length > 0 && (
          <div className="flex overflow-x-auto no-scrollbar scroll-smooth sm:flex-wrap gap-2 mb-8 sm:mb-10 py-1">
            <button
              onClick={() => setFilterInterest(null)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-light transition-all duration-300 ${!filterInterest ? "bg-primary text-primary-foreground" : "glass text-foreground/50 hover:text-foreground"}`}>
              All
            </button>
            {allInterests.map((i) => (
              <button key={i} onClick={() => setFilterInterest(filterInterest === i ? null : i)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-light transition-all duration-300 ${filterInterest === i ? "bg-primary text-primary-foreground" : "glass text-foreground/50 hover:text-foreground"}`}>
                {i}
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-24 text-foreground/40 font-light">
            {allStudents.length === 0
              ? "No members yet. Be the first to sign up!"
              : "No members match your search."}
          </div>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((s) => <MemberCard key={s.id} student={s} />)}
          </motion.div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default Members;
