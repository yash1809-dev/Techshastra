import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import {
  getTypingLeaderboard,
  getProblemLeaderboard,
  getStoredTypingRecords,
  getStoredSubmissions,
  type TypingLeaderboardItem,
  type ProblemLeaderboardItem,
  type TypingScoreRecord,
  type ProblemSubmission,
} from "@/lib/codingStore";
import {
  syncLeaderboardData,
  subscribeToLeaderboardUpdates,
} from "@/lib/services/leaderboardService";
import { getStudentByGithub } from "@/lib/studentStore";
import {
  Trophy,
  Medal,
  Award,
  Search,
  Building2,
  Code2,
  Keyboard,
  Sparkles,
  Zap,
  Target,
  Clock,
  RefreshCw,
  Radio,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export type LeaderboardTab = "typing" | "problems";
export type TypingDuration = 15 | 30 | 60;

const getEntryAvatar = (githubUsername?: string, size = 96) => {
  if (!githubUsername) return "";
  const local = getStudentByGithub(githubUsername);
  return local?.avatar || `https://github.com/${githubUsername}.png?size=${size}`;
};

export const LeaderboardPage: React.FC = () => {
  const { session } = useStudentAuth();
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("typing");
  const [typingDuration, setTypingDuration] = useState<TypingDuration>(30);

  // Cloud & local records state
  const [allTypingRecords, setAllTypingRecords] = useState<TypingScoreRecord[]>(() =>
    getStoredTypingRecords()
  );
  const [allSubmissions, setAllSubmissions] = useState<ProblemSubmission[]>(() =>
    getStoredSubmissions()
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("All");

  const sess = useMemo(
    () =>
      session
        ? {
            studentId: session.studentId || session.githubUsername || "student",
            name: session.name,
            githubUsername: session.githubUsername,
            college: (session as any).college,
          }
        : undefined,
    [session]
  );

  // Sync with Supabase Cloud
  const performSync = useCallback(async (showToast = false) => {
    setIsSyncing(true);
    try {
      const localTyping = getStoredTypingRecords();
      const localSubs = getStoredSubmissions();
      const synced = await syncLeaderboardData(localTyping, localSubs);

      setAllTypingRecords(synced.typingRecords);
      setAllSubmissions(synced.submissions);
      setLastSyncedAt(new Date());

      if (showToast) {
        toast.success("Leaderboard synced with live campus records!");
      }
    } catch (err) {
      console.warn("Leaderboard sync error:", err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Initial cloud sync & Realtime listener
  useEffect(() => {
    performSync();

    // Subscribe to realtime changes so other students' scores appear live
    const unsubscribe = subscribeToLeaderboardUpdates(() => {
      performSync();
    });

    return () => {
      unsubscribe();
    };
  }, [performSync]);

  // Compute active typing leaderboard based on selected duration subcategory
  const typingList = useMemo(() => {
    return getTypingLeaderboard(sess, typingDuration, allTypingRecords);
  }, [sess, typingDuration, allTypingRecords]);

  // Compute counts for all typing subcategories
  const count15s = useMemo(() => {
    return getTypingLeaderboard(sess, 15, allTypingRecords).length;
  }, [sess, allTypingRecords]);

  const count30s = useMemo(() => {
    return getTypingLeaderboard(sess, 30, allTypingRecords).length;
  }, [sess, allTypingRecords]);

  const count60s = useMemo(() => {
    return getTypingLeaderboard(sess, 60, allTypingRecords).length;
  }, [sess, allTypingRecords]);

  // Compute problems leaderboard
  const problemList = useMemo(() => {
    return getProblemLeaderboard(sess, allSubmissions);
  }, [sess, allSubmissions]);

  // Collect unique colleges across records
  const colleges = useMemo(() => {
    const set = new Set<string>();
    typingList.forEach((e) => set.add(e.college));
    problemList.forEach((e) => set.add(e.college));
    return ["All", ...Array.from(set)];
  }, [typingList, problemList]);

  // Filtered lists for active search & college filter
  const filteredTyping = useMemo(() => {
    return typingList.filter((entry) => {
      const matchesSearch =
        entry.studentName.toLowerCase().includes(search.toLowerCase()) ||
        entry.githubUsername.toLowerCase().includes(search.toLowerCase());
      const matchesCollege =
        collegeFilter === "All" || entry.college === collegeFilter;
      return matchesSearch && matchesCollege;
    });
  }, [typingList, search, collegeFilter]);

  const filteredProblems = useMemo(() => {
    return problemList.filter((entry) => {
      const matchesSearch =
        entry.studentName.toLowerCase().includes(search.toLowerCase()) ||
        entry.githubUsername.toLowerCase().includes(search.toLowerCase());
      const matchesCollege =
        collegeFilter === "All" || entry.college === collegeFilter;
      return matchesSearch && matchesCollege;
    });
  }, [problemList, search, collegeFilter]);

  const currentUserGithub = session?.githubUsername?.toLowerCase();

  // Top 3 for active view
  const topThreeTyping = filteredTyping.slice(0, 3);
  const topThreeProblems = filteredProblems.slice(0, 3);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-7">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Trophy className="text-amber-500" size={26} />
            Student Leaderboard Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Official inter-college rankings for typing speed and algorithmic problem solving across UTU colleges.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-xs px-3 py-1 text-emerald-500 border-emerald-500/30 flex items-center gap-1.5 w-fit"
          >
            <Radio size={12} className="animate-pulse text-emerald-500" />
            <span>Live Cloud Sync</span>
          </Badge>

          <Button
            variant="outline"
            size="sm"
            onClick={() => performSync(true)}
            disabled={isSyncing}
            className="h-8 text-xs gap-1.5 rounded-xl glass"
            title="Refresh leaderboard from cloud"
          >
            <RefreshCw size={13} className={isSyncing ? "animate-spin text-primary" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Main Section Switcher (Typing vs Problems) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="overflow-x-auto scrollbar-none -mx-1 px-1">
          <div className="flex items-center gap-2 p-1.5 glass rounded-2xl w-fit">
            <button
              onClick={() => setActiveTab("typing")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs transition-all shrink-0 ${
                activeTab === "typing"
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              <Keyboard
                size={14}
                className={activeTab === "typing" ? "text-primary-foreground" : "text-amber-500"}
              />
              <span>Typing Speed Hub</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeTab === "typing"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-foreground/10 text-foreground/60"
                }`}
              >
                {typingList.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("problems")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs transition-all shrink-0 ${
                activeTab === "problems"
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              <Code2
                size={14}
                className={activeTab === "problems" ? "text-primary-foreground" : "text-primary"}
              />
              <span>Problems &amp; Algorithms</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeTab === "problems"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-foreground/10 text-foreground/60"
                }`}
              >
                {problemList.length}
              </span>
            </button>
          </div>
        </div>

        {/* Typing Duration Subcategories: 15s | 30s | 60s */}
        {activeTab === "typing" && (
          <div className="flex items-center gap-1.5 glass p-1 rounded-xl w-fit bg-muted/40 border border-border/50">
            <span className="text-[11px] font-medium text-muted-foreground px-2 flex items-center gap-1">
              <Clock size={12} className="text-primary" />
              Duration:
            </span>
            {([15, 30, 60] as TypingDuration[]).map((dur) => {
              const count = dur === 15 ? count15s : dur === 30 ? count30s : count60s;
              const isSelected = typingDuration === dur;
              return (
                <button
                  key={dur}
                  onClick={() => setTypingDuration(dur)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-1 ${
                    isSelected
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "text-foreground/70 hover:text-foreground hover:bg-foreground/10"
                  }`}
                >
                  <span>{dur}s</span>
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded-full ${
                      isSelected
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-foreground/10 text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* TOP 3 PODIUM */}
      {collegeFilter === "All" && (
        <>
          {/* Typing Speed Podium for selected duration */}
          {activeTab === "typing" && topThreeTyping.length >= 3 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {/* 2nd Place */}
              <Card className="order-2 md:order-1 border-slate-400/30 bg-gradient-to-b from-slate-400/10 to-card/60 backdrop-blur-sm text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-slate-400" />
                <CardContent className="p-6 flex flex-col items-center">
                  <div className="relative mb-3">
                    <img
                      src={getEntryAvatar(topThreeTyping[1].githubUsername, 96)}
                      alt={topThreeTyping[1].studentName}
                      className="w-16 h-16 rounded-full ring-2 ring-slate-400/60 object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-400 text-slate-900 font-bold text-xs flex items-center justify-center">
                      2
                    </span>
                  </div>
                  <h3 className="font-heading font-bold text-base text-foreground truncate max-w-full">
                    {topThreeTyping[1].studentName}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate max-w-full">
                    {topThreeTyping[1].college}
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-1.5">
                    <span className="text-2xl font-mono font-bold text-slate-300">
                      {topThreeTyping[1].typingBestWpm}
                    </span>
                    <span className="text-xs text-muted-foreground">WPM</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {topThreeTyping[1].accuracyRate}% acc · {topThreeTyping[1].testCount} runs ({typingDuration}s)
                  </p>
                </CardContent>
              </Card>

              {/* 1st Place (Champion) */}
              <Card className="order-1 md:order-2 border-amber-500/40 bg-gradient-to-b from-amber-500/15 to-card/60 backdrop-blur-sm text-center relative overflow-hidden shadow-lg shadow-amber-500/10 md:-translate-y-2">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-500" />
                <CardContent className="p-6 flex flex-col items-center">
                  <div className="relative mb-3">
                    <img
                      src={getEntryAvatar(topThreeTyping[0].githubUsername, 96)}
                      alt={topThreeTyping[0].studentName}
                      className="w-20 h-20 rounded-full ring-4 ring-amber-500/80 object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-bold text-sm flex items-center justify-center shadow">
                      👑
                    </span>
                  </div>
                  <Badge className="bg-amber-500/20 text-amber-500 dark:text-amber-300 border-amber-500/40 text-[10px] mb-1">
                    ⚡ {typingDuration}s SPEED CHAMPION
                  </Badge>
                  <h3 className="font-heading font-bold text-lg text-foreground truncate max-w-full">
                    {topThreeTyping[0].studentName}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate max-w-full">
                    {topThreeTyping[0].college}
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-1.5">
                    <span className="text-3xl font-mono font-bold text-amber-500 dark:text-amber-300">
                      {topThreeTyping[0].typingBestWpm}
                    </span>
                    <span className="text-xs text-muted-foreground">WPM</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {topThreeTyping[0].accuracyRate}% accuracy · {topThreeTyping[0].testCount} tests completed
                  </p>
                </CardContent>
              </Card>

              {/* 3rd Place */}
              <Card className="order-3 border-amber-700/30 bg-gradient-to-b from-amber-700/10 to-card/60 backdrop-blur-sm text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-amber-700" />
                <CardContent className="p-6 flex flex-col items-center">
                  <div className="relative mb-3">
                    <img
                      src={getEntryAvatar(topThreeTyping[2].githubUsername, 96)}
                      alt={topThreeTyping[2].studentName}
                      className="w-16 h-16 rounded-full ring-2 ring-amber-700/60 object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-700 text-white font-bold text-xs flex items-center justify-center">
                      3
                    </span>
                  </div>
                  <h3 className="font-heading font-bold text-base text-foreground truncate max-w-full">
                    {topThreeTyping[2].studentName}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate max-w-full">
                    {topThreeTyping[2].college}
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-1.5">
                    <span className="text-2xl font-mono font-bold text-amber-600">
                      {topThreeTyping[2].typingBestWpm}
                    </span>
                    <span className="text-xs text-muted-foreground">WPM</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {topThreeTyping[2].accuracyRate}% acc · {topThreeTyping[2].testCount} runs ({typingDuration}s)
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Problem Solving Podium */}
          {activeTab === "problems" && topThreeProblems.length >= 3 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <Card className="order-2 md:order-1 border-slate-400/30 bg-gradient-to-b from-slate-400/10 to-card/60 backdrop-blur-sm text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-slate-400" />
                <CardContent className="p-6 flex flex-col items-center">
                  <div className="relative mb-3">
                    <img
                      src={getEntryAvatar(topThreeProblems[1].githubUsername, 96)}
                      alt={topThreeProblems[1].studentName}
                      className="w-16 h-16 rounded-full ring-2 ring-slate-400/60 object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-400 text-slate-900 font-bold text-xs flex items-center justify-center">
                      2
                    </span>
                  </div>
                  <h3 className="font-heading font-bold text-base text-foreground truncate max-w-full">
                    {topThreeProblems[1].studentName}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate max-w-full">
                    {topThreeProblems[1].college}
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-1.5">
                    <span className="text-2xl font-mono font-bold text-slate-300">
                      {topThreeProblems[1].codingPoints}
                    </span>
                    <span className="text-xs text-muted-foreground">pts</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {topThreeProblems[1].problemsSolved} solved · {topThreeProblems[1].accuracyRate}% pass
                  </p>
                </CardContent>
              </Card>

              <Card className="order-1 md:order-2 border-amber-500/40 bg-gradient-to-b from-amber-500/15 to-card/60 backdrop-blur-sm text-center relative overflow-hidden shadow-lg shadow-amber-500/10 md:-translate-y-2">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-500" />
                <CardContent className="p-6 flex flex-col items-center">
                  <div className="relative mb-3">
                    <img
                      src={getEntryAvatar(topThreeProblems[0].githubUsername, 96)}
                      alt={topThreeProblems[0].studentName}
                      className="w-20 h-20 rounded-full ring-4 ring-amber-500/80 object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-bold text-sm flex items-center justify-center shadow">
                      👑
                    </span>
                  </div>
                  <Badge className="bg-amber-500/20 text-amber-500 dark:text-amber-300 border-amber-500/40 text-[10px] mb-1">
                    💻 ALGO CHAMPION
                  </Badge>
                  <h3 className="font-heading font-bold text-lg text-foreground truncate max-w-full">
                    {topThreeProblems[0].studentName}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate max-w-full">
                    {topThreeProblems[0].college}
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-1.5">
                    <span className="text-3xl font-mono font-bold text-amber-500 dark:text-amber-300">
                      {topThreeProblems[0].codingPoints}
                    </span>
                    <span className="text-xs text-muted-foreground">pts</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {topThreeProblems[0].problemsSolved} problems solved · {topThreeProblems[0].accuracyRate}% pass rate
                  </p>
                </CardContent>
              </Card>

              <Card className="order-3 border-amber-700/30 bg-gradient-to-b from-amber-700/10 to-card/60 backdrop-blur-sm text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-amber-700" />
                <CardContent className="p-6 flex flex-col items-center">
                  <div className="relative mb-3">
                    <img
                      src={getEntryAvatar(topThreeProblems[2].githubUsername, 96)}
                      alt={topThreeProblems[2].studentName}
                      className="w-16 h-16 rounded-full ring-2 ring-amber-700/60 object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-700 text-white font-bold text-xs flex items-center justify-center">
                      3
                    </span>
                  </div>
                  <h3 className="font-heading font-bold text-base text-foreground truncate max-w-full">
                    {topThreeProblems[2].studentName}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate max-w-full">
                    {topThreeProblems[2].college}
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-1.5">
                    <span className="text-2xl font-mono font-bold text-amber-600">
                      {topThreeProblems[2].codingPoints}
                    </span>
                    <span className="text-xs text-muted-foreground">pts</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {topThreeProblems[2].problemsSolved} solved · {topThreeProblems[2].accuracyRate}% pass
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between glass p-3.5 rounded-2xl">
        <div className="relative flex-1 max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student or GitHub handle..."
            className="pl-9 h-9 rounded-xl text-xs bg-background/60"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Institution:
          </span>
          <Select value={collegeFilter} onValueChange={setCollegeFilter}>
            <SelectTrigger className="h-9 text-xs rounded-xl w-52 bg-background/80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {colleges.map((c) => (
                <SelectItem key={c} value={c} className="text-xs">
                  {c === "All" ? "All UTU Colleges" : c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* DEDICATED TABLES FOR EACH LEADERBOARD SECTION */}

      {/* 1. TYPING SPEED LEADERBOARD TABLE */}
      {activeTab === "typing" && (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead
                className="bg-foreground/5 text-foreground/50 uppercase tracking-wider text-[10px]"
                style={{ borderBottom: "1px solid hsl(var(--glass-border))" }}
              >
                <tr>
                  <th className="py-3 px-4 w-14 text-center">Rank</th>
                  <th className="py-3 px-4">Student &amp; GitHub</th>
                  <th className="py-3 px-4">College / Campus</th>
                  <th className="py-3 px-4 text-center">Best Speed ({typingDuration}s)</th>
                  <th className="py-3 px-4 text-center">Accuracy</th>
                  <th className="py-3 px-4 text-center">Tests Taken ({typingDuration}s)</th>
                  <th className="py-3 px-4 text-right">Speed Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredTyping.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-12 text-center text-muted-foreground text-xs"
                    >
                      No {typingDuration}s typing test records found yet. Take a {typingDuration}s test in the Developer Typing Arena to claim your rank!
                    </td>
                  </tr>
                ) : (
                  filteredTyping.map((entry) => {
                    const isCurrent =
                      currentUserGithub &&
                      entry.githubUsername.toLowerCase() === currentUserGithub;
                    const tier =
                      entry.typingBestWpm >= 100
                        ? {
                            label: "⚡ Godspeed",
                            color: "text-amber-500 border-amber-500/30 bg-amber-500/10",
                          }
                        : entry.typingBestWpm >= 80
                        ? {
                            label: "🚀 Pro Typist",
                            color: "text-primary border-primary/30 bg-primary/10",
                          }
                        : entry.typingBestWpm >= 60
                        ? {
                            label: "🎯 Fast",
                            color: "text-emerald-500 border-emerald-500/30 bg-emerald-500/10",
                          }
                        : {
                            label: "🏃 Practicing",
                            color: "text-muted-foreground border-border bg-foreground/5",
                          };

                    return (
                      <tr
                        key={entry.studentId}
                        className={`transition-colors ${
                          isCurrent
                            ? "bg-primary/10 hover:bg-primary/15 font-medium"
                            : "hover:bg-muted/30"
                        }`}
                      >
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs ${
                              entry.rank === 1
                                ? "bg-amber-500/20 text-amber-500"
                                : entry.rank === 2
                                ? "bg-slate-400/20 text-slate-300"
                                : entry.rank === 3
                                ? "bg-amber-700/20 text-amber-600"
                                : "text-muted-foreground"
                            }`}
                          >
                            {entry.rank}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={getEntryAvatar(entry.githubUsername, 48)}
                              alt={entry.studentName}
                              className="w-7 h-7 rounded-full ring-1 ring-border object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                            <div className="min-w-0">
                              <Link
                                to={`/members/${entry.githubUsername}`}
                                className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1"
                              >
                                <span>{entry.studentName}</span>
                                {isCurrent && (
                                  <Badge className="text-[9px] py-0 px-1 bg-primary text-primary-foreground">
                                    You
                                  </Badge>
                                )}
                              </Link>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                @{entry.githubUsername}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Building2 size={13} className="text-muted-foreground/60" />
                            <span>{entry.college}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-mono font-bold text-sm text-amber-600 dark:text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30">
                            {entry.typingBestWpm} WPM
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono">
                          <span
                            className={
                              entry.accuracyRate >= 95
                                ? "text-emerald-500"
                                : entry.accuracyRate >= 85
                                ? "text-amber-500"
                                : "text-rose-500"
                            }
                          >
                            {entry.accuracyRate}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono text-muted-foreground">
                          {entry.testCount}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-normal ${tier.color}`}
                          >
                            {tier.label}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. PROBLEMS & ALGORITHMS LEADERBOARD TABLE */}
      {activeTab === "problems" && (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead
                className="bg-foreground/5 text-foreground/50 uppercase tracking-wider text-[10px]"
                style={{ borderBottom: "1px solid hsl(var(--glass-border))" }}
              >
                <tr>
                  <th className="py-3 px-4 w-14 text-center">Rank</th>
                  <th className="py-3 px-4">Student &amp; GitHub</th>
                  <th className="py-3 px-4">College / Campus</th>
                  <th className="py-3 px-4 text-center">Problems Solved</th>
                  <th className="py-3 px-4 text-center">Accuracy</th>
                  <th className="py-3 px-4 text-right">Algo Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredProblems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-12 text-center text-muted-foreground text-xs"
                    >
                      No problem submissions recorded yet. Head over to Coding Hub and solve your first problem!
                    </td>
                  </tr>
                ) : (
                  filteredProblems.map((entry) => {
                    const isCurrent =
                      currentUserGithub &&
                      entry.githubUsername.toLowerCase() === currentUserGithub;

                    return (
                      <tr
                        key={entry.studentId}
                        className={`transition-colors ${
                          isCurrent
                            ? "bg-primary/10 hover:bg-primary/15 font-medium"
                            : "hover:bg-muted/30"
                        }`}
                      >
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs ${
                              entry.rank === 1
                                ? "bg-amber-500/20 text-amber-500"
                                : entry.rank === 2
                                ? "bg-slate-400/20 text-slate-300"
                                : entry.rank === 3
                                ? "bg-amber-700/20 text-amber-600"
                                : "text-muted-foreground"
                            }`}
                          >
                            {entry.rank}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={getEntryAvatar(entry.githubUsername, 48)}
                              alt={entry.studentName}
                              className="w-7 h-7 rounded-full ring-1 ring-border object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                            <div className="min-w-0">
                              <Link
                                to={`/members/${entry.githubUsername}`}
                                className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1"
                              >
                                <span>{entry.studentName}</span>
                                {isCurrent && (
                                  <Badge className="text-[9px] py-0 px-1 bg-primary text-primary-foreground">
                                    You
                                  </Badge>
                                )}
                              </Link>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                @{entry.githubUsername}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Building2 size={13} className="text-muted-foreground/60" />
                            <span>{entry.college}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono">
                          <span className="px-2.5 py-1 rounded-md bg-muted text-foreground font-semibold">
                            {entry.problemsSolved}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono text-emerald-500 font-medium">
                          {entry.accuracyRate}%
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="font-heading font-bold text-sm text-primary">
                            {entry.codingPoints} pts
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaderboardPage;
