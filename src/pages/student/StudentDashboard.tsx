import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import {
  getProblemsCatalog,
  getUserSubmissions,
  getLeaderboard,
  getTypingRecords,
  enrichProblem,
  type Problem,
  type Submission,
  type LeaderboardEntry,
} from "@/lib/codingStore";
import { getPublishedProblems } from "@/lib/services/problemService";
import {
  Code2,
  Terminal,
  Trophy,
  Keyboard,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ArrowRight,
  Flame,
  Zap,
  Target,
  Medal,
  Cpu,
  ChevronRight,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const StudentDashboard: React.FC = () => {
  const { session } = useStudentAuth();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [typingBest, setTypingBest] = useState<number>(0);

  useEffect(() => {
    const pList = getProblemsCatalog();
    setProblems(pList);
    getPublishedProblems().then((fresh) => {
      if (fresh && fresh.length > 0) {
        setProblems(fresh.map(enrichProblem));
      }
    });

    const currentStudentId = session?.studentId || session?.githubUsername;
    const sList = getUserSubmissions(currentStudentId);
    setSubmissions(sList);

    const lb = getLeaderboard(
      session
        ? {
            studentId: currentStudentId || "student",
            name: session.name,
            githubUsername: session.githubUsername,
            college: (session as any).college,
          }
        : undefined
    );
    setLeaderboard(lb);

    const typ = getTypingRecords(currentStudentId);
    if (typ.length > 0) {
      setTypingBest(Math.max(...typ.map((t) => t.wpm)));
    } else {
      setTypingBest(0);
    }
  }, [session]);

  const studentName = session?.name || "Student";
  const studentUsername = session?.githubUsername || "student";

  // Calculations
  const solvedProblemIds = new Set(
    submissions.filter((s) => s.status === "Accepted").map((s) => s.problemId)
  );
  const solvedCount = solvedProblemIds.size;
  const totalCount = problems.length;
  const solvePercent = totalCount > 0 ? Math.round((solvedCount / totalCount) * 100) : 0;

  // Find user's leaderboard rank
  const userRankEntry = leaderboard.find(
    (e) =>
      e.githubUsername.toLowerCase() === studentUsername.toLowerCase() ||
      e.studentName.toLowerCase() === studentName.toLowerCase()
  );
  const userRank = userRankEntry ? userRankEntry.rank : "-";
  const userPoints = userRankEntry ? userRankEntry.totalScore : solvedCount * 100;

  // Featured problem: first unsolved, or first problem
  const featuredProblem =
    problems.find((p) => !solvedProblemIds.has(p.id)) || problems[0];

  const getDifficultyColor = (diff: Problem["difficulty"]) => {
    switch (diff) {
      case "Easy":
        return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
      case "Medium":
        return "text-amber-500 bg-amber-500/10 border-amber-500/20";
      case "Hard":
        return "text-rose-500 bg-rose-500/10 border-rose-500/20";
    }
  };

  const getStatusBadge = (status: Submission["status"]) => {
    switch (status) {
      case "Accepted":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
            <CheckCircle2 size={12} /> Accepted
          </span>
        );
      case "Wrong Answer":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full">
            <XCircle size={12} /> Wrong Answer
          </span>
        );
      case "Time Limit Exceeded":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
            <Clock size={12} /> TLE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full">
            <XCircle size={12} /> {status}
          </span>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden glass rounded-2xl bg-gradient-to-r from-primary/10 via-transparent to-primary/5 p-6 sm:p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/25 text-primary text-xs font-medium">
              <Sparkles size={13} />
              <span>Student Coding & Academic Workspace</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-foreground tracking-tight">
              Welcome, {studentName}
            </h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              Solve algorithmic problems published by faculty, execute code in a
              sandboxed compiler, test typing speeds, and climb the inter-college leaderboard.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {featuredProblem && (
              <Link to={`/student/problems/${featuredProblem.id}`}>
                <Button className="rounded-xl gap-2 shadow-lg shadow-primary/20">
                  <Zap size={16} />
                  <span>Solve Daily Challenge</span>
                </Button>
              </Link>
            )}
            <Link to="/student/compiler">
              <Button variant="outline" className="rounded-xl gap-2">
                <Terminal size={16} />
                <span>Open Playground</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="glass border-0">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Solved
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-heading font-bold text-foreground">
                {solvedCount}
              </span>
              <span className="text-xs text-muted-foreground ml-1.5">
                / {totalCount}
              </span>
            </div>
            <Progress value={solvePercent} className="h-1.5 mt-2.5 bg-muted" />
          </CardContent>
        </Card>

        <Card className="glass border-0">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Score
              </span>
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Medal size={16} />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-heading font-bold text-foreground">
                {userPoints}
              </span>
              <span className="text-xs text-muted-foreground ml-1.5">pts</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Based on verified submissions
            </p>
          </CardContent>
        </Card>

        <Card className="glass border-0">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Campus Rank
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Trophy size={16} />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-heading font-bold text-foreground">
                #{userRank}
              </span>
              <span className="text-xs text-muted-foreground ml-1.5">
                / {leaderboard.length || 1}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Across UTU-affiliated colleges
            </p>
          </CardContent>
        </Card>

        <Card className="glass border-0">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Typing Speed
              </span>
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
                <Keyboard size={16} />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-heading font-bold text-foreground">
                {typingBest > 0 ? typingBest : "--"}
              </span>
              <span className="text-xs text-muted-foreground ml-1.5">WPM</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Personal best score
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Featured Challenge + Quick Nav + Recent Submissions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Featured Challenge & Quick Actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Featured Problem Card */}
          {featuredProblem && (
            <Card className="glass border-0">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Recommended Practice
                  </span>
                  <CardTitle className="text-lg font-heading font-semibold mt-1">
                    {featuredProblem.title}
                  </CardTitle>
                </div>
                <Badge
                  variant="outline"
                  className={getDifficultyColor(featuredProblem.difficulty)}
                >
                  {featuredProblem.difficulty}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                  {featuredProblem.description}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  {featuredProblem.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground"
                    >
                      #{tag}
                    </span>
                  ))}
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    Faculty: {featuredProblem.author}
                  </span>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">
                    Award: +{featuredProblem.points} pts
                  </span>
                  <Link to={`/student/problems/${featuredProblem.id}`}>
                    <Button size="sm" className="rounded-xl gap-1.5">
                      <span>Solve Problem</span>
                      <ArrowRight size={14} />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Hub Navigation Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              to="/student/problems"
              className="p-4 rounded-xl glass hover:bg-primary/5 transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Code2 size={16} />
              </div>
              <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                Problems Directory
                <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1">
                Browse all faculty coding assignments & test cases.
              </p>
            </Link>

            <Link
              to="/student/compiler"
              className="p-4 rounded-xl glass hover:bg-primary/5 transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Terminal size={16} />
              </div>
              <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                Code Sandbox
                <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1">
                Scratchpad with Python, Node.js, C++, and Java execution.
              </p>
            </Link>

            <Link
              to="/student/typing"
              className="p-4 rounded-xl glass hover:bg-primary/5 transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Keyboard size={16} />
              </div>
              <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                Typing Practice
                <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1">
                Test WPM and typing accuracy with tech quotes.
              </p>
            </Link>
          </div>
        </div>

        {/* Right Col: Top Leaderboard Preview & Recent Submissions */}
        <div className="space-y-6">
          {/* Top 3 Leaderboard Preview */}
          <Card className="glass border-0">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-heading font-semibold flex items-center gap-2">
                <Trophy size={16} className="text-amber-500" />
                <span>Campus Leaderboard</span>
              </CardTitle>
              <Link
                to="/student/leaderboard"
                className="text-[11px] text-primary hover:underline"
              >
                View All
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {leaderboard.slice(0, 4).map((entry) => (
                <div
                  key={entry.studentId}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/40 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        entry.rank === 1
                          ? "bg-amber-500/20 text-amber-500"
                          : entry.rank === 2
                          ? "bg-slate-400/20 text-slate-300"
                          : entry.rank === 3
                          ? "bg-amber-700/20 text-amber-600"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {entry.rank}
                    </span>
                    <div className="truncate">
                      <p className="font-medium text-foreground truncate">
                        {entry.studentName}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {entry.college}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono font-semibold text-primary">
                    {entry.totalScore} pts
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent Submissions */}
          <Card className="glass border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-heading font-semibold flex items-center gap-2">
                <Clock size={15} className="text-muted-foreground" />
                <span>Recent Submissions</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {submissions.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No submissions yet. Pick a problem to get started!
                </p>
              ) : (
                <div className="space-y-2.5">
                  {submissions.slice(0, 4).map((sub) => (
                    <div
                      key={sub.id}
                      className="p-2 rounded-lg bg-muted/30 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0">
                        <Link
                          to={`/student/problems/${sub.problemId}`}
                          className="font-medium text-foreground hover:text-primary truncate block"
                        >
                          {sub.problemTitle}
                        </Link>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {sub.language} • {sub.runtimeMs}ms
                        </span>
                      </div>
                      <div>{getStatusBadge(sub.status)}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
