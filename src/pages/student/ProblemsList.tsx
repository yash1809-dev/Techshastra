import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  getProblemsCatalog,
  getUserSubmissions,
  enrichProblem,
  type Problem,
  type Submission,
} from "@/lib/codingStore";
import { getPublishedProblems } from "@/lib/services/problemService";
import { getStudentByGithub, getStudentById } from "@/lib/studentStore";
import { getStudentByUserId, getStudentByUsername } from "@/lib/services/studentService";
import {
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Code2,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Tag,
  BookOpen,
  GraduationCap,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useStudentAuth } from "@/hooks/useStudentAuth";

export const ProblemsList: React.FC = () => {
  const { session } = useStudentAuth();
  const currentStudentId = session?.studentId || session?.githubUsername;

  const [problems, setProblems] = useState<Problem[]>(() => getProblemsCatalog());
  const [submissions, setSubmissions] = useState<Submission[]>(() => getUserSubmissions(currentStudentId));
  const [search, setSearch] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("All");
  const [yearFilter, setYearFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [selectedTag, setSelectedTag] = useState<string>("All");
  const [studentProfile, setStudentProfile] = useState<{ year?: string | null; course?: string | null } | null>(null);

  // Load student profile to get registered academic year & course
  useEffect(() => {
    if (!session) return;
    if (session.githubUsername) {
      const local = getStudentByGithub(session.githubUsername);
      if (local && local.year) {
        setStudentProfile({ year: local.year, course: local.course });
        return;
      }
    }
    if (session.studentId) {
      const local = getStudentById(session.studentId);
      if (local && local.year) {
        setStudentProfile({ year: local.year, course: local.course });
        return;
      }
    }
    // Remote fallback
    if (session.studentId) {
      getStudentByUserId(session.studentId).then((res) => {
        if (res && res.year) {
          setStudentProfile({ year: res.year, course: res.course });
        }
      }).catch(() => {});
    } else if (session.githubUsername) {
      getStudentByUsername(session.githubUsername).then((res) => {
        if (res && res.year) {
          setStudentProfile({ year: res.year, course: res.course });
        }
      }).catch(() => {});
    }
  }, [session]);

  // Standardize student's academic year (e.g., "2nd Year")
  const studentAcademicYear = useMemo(() => {
    if (!studentProfile?.year) return null;
    const raw = studentProfile.year.trim().toLowerCase();
    if (raw.includes("1") || raw.includes("first")) return "1st Year";
    if (raw.includes("2") || raw.includes("second")) return "2nd Year";
    if (raw.includes("3") || raw.includes("third")) return "3rd Year";
    if (raw.includes("4") || raw.includes("fourth") || raw.includes("final")) return "4th Year";
    return null;
  }, [studentProfile]);

  useEffect(() => {
    let active = true;
    getPublishedProblems().then((fresh) => {
      if (active && fresh && fresh.length > 0) {
        setProblems(fresh.map(enrichProblem));
      }
    });

    const onUpdate = () => {
      setProblems(getProblemsCatalog());
      setSubmissions(getUserSubmissions(currentStudentId));
    };
    window.addEventListener("ts_coding_problems_updated", onUpdate);
    return () => {
      active = false;
      window.removeEventListener("ts_coding_problems_updated", onUpdate);
    };
  }, [currentStudentId]);

  useEffect(() => {
    setSubmissions(getUserSubmissions(currentStudentId));
  }, [currentStudentId]);

  // Map solved status
  const solvedProblemIds = useMemo(() => {
    return new Set(
      submissions.filter((s) => s.status === "Accepted").map((s) => s.problemId)
    );
  }, [submissions]);

  const attemptedProblemIds = useMemo(() => {
    return new Set(submissions.map((s) => s.problemId));
  }, [submissions]);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    problems.forEach((p) => p.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [problems]);

  // Year / Cohort matching helper
  const matchesSelectedYear = useMemo(() => {
    return (prob: Problem) => {
      if (yearFilter === "All") return true;

      const probCohort = (prob.targetYear || prob.targetSemester) as string | undefined;
      if (!probCohort || probCohort === "All" || probCohort === "All Years" || probCohort === "All Semesters") {
        return true;
      }

      const cleanProb = probCohort.trim().toLowerCase();
      let probYear: string | null = null;
      if (cleanProb.includes("1") || cleanProb.includes("first") || cleanProb.includes("sem 1") || cleanProb.includes("sem 2")) {
        probYear = "1st Year";
      } else if (cleanProb.includes("2") || cleanProb.includes("second") || cleanProb.includes("sem 3") || cleanProb.includes("sem 4")) {
        probYear = "2nd Year";
      } else if (cleanProb.includes("3") || cleanProb.includes("third") || cleanProb.includes("sem 5") || cleanProb.includes("sem 6")) {
        probYear = "3rd Year";
      } else if (cleanProb.includes("4") || cleanProb.includes("fourth") || cleanProb.includes("final") || cleanProb.includes("sem 7") || cleanProb.includes("sem 8")) {
        probYear = "4th Year";
      }

      return probYear === yearFilter;
    };
  }, [yearFilter]);

  // Filtered problems
  const filteredProblems = useMemo(() => {
    return problems.filter((p) => {
      // Search
      const matchesSearch =
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase()) ||
        p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));

      // Difficulty
      const matchesDifficulty =
        difficultyFilter === "All" || p.difficulty === difficultyFilter;

      // Year / Cohort selection
      const matchesYear = matchesSelectedYear(p);

      // Status
      const isSolved = solvedProblemIds.has(p.id);
      const isAttempted = attemptedProblemIds.has(p.id);
      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Solved" && isSolved) ||
        (statusFilter === "Unsolved" && !isSolved) ||
        (statusFilter === "Attempted" && isAttempted && !isSolved);

      // Tag
      const matchesTag =
        selectedTag === "All" || p.tags.includes(selectedTag);

      return matchesSearch && matchesDifficulty && matchesYear && matchesStatus && matchesTag;
    });
  }, [
    problems,
    search,
    difficultyFilter,
    matchesSelectedYear,
    statusFilter,
    selectedTag,
    solvedProblemIds,
    attemptedProblemIds,
  ]);

  const getDifficultyColor = (diff: Problem["difficulty"]) => {
    switch (diff) {
      case "Easy":
        return "text-emerald-800 dark:text-emerald-300 bg-emerald-500/15 border-emerald-500/40 font-medium";
      case "Medium":
        return "text-amber-800 dark:text-amber-300 bg-amber-500/15 border-amber-500/40 font-medium";
      case "Hard":
        return "text-rose-800 dark:text-rose-300 bg-rose-500/15 border-rose-500/40 font-medium";
    }
  };

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6 pb-28 md:pb-12 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Code2 className="text-primary shrink-0" size={22} />
            Faculty Assignments & Problems
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
            Solve curated algorithmic challenges, verify your test-case outputs,
            and earn points towards your campus standing.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {studentAcademicYear && (
            <button
              type="button"
              onClick={() => setYearFilter(yearFilter === studentAcademicYear ? "All" : studentAcademicYear)}
              className="text-left"
              title="Click to toggle filter for your year"
            >
              <Badge
                variant="outline"
                className={`text-xs px-2.5 py-1 font-medium border-purple-500/40 cursor-pointer transition-all flex items-center gap-1.5 shadow-xs ${
                  yearFilter === studentAcademicYear
                    ? "bg-purple-500/25 text-purple-900 dark:text-purple-200 ring-2 ring-purple-500/40"
                    : "text-purple-800 dark:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20"
                }`}
              >
                <GraduationCap size={13} className="text-purple-600 dark:text-purple-400 shrink-0" />
                <span className="truncate max-w-[200px] xs:max-w-none">
                  Curriculum: <strong>{studentAcademicYear}</strong>
                  {yearFilter === studentAcademicYear ? " (Active)" : ""}
                </span>
              </Badge>
            </button>
          )}
          <Badge variant="outline" className="text-xs px-2.5 py-1 font-normal">
            Problems: <span className="font-semibold ml-1">{filteredProblems.length}</span>
          </Badge>
          <Badge variant="outline" className="text-xs px-2.5 py-1 font-normal text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
            Solved: <span className="font-semibold ml-1">{solvedProblemIds.size}</span>
          </Badge>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="glass p-3 sm:p-4 rounded-2xl space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search problems, keywords, or topics..."
              className="pl-9 h-9 rounded-xl text-xs bg-background/60 w-full"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Difficulty Filter */}
            <div className="flex items-center rounded-xl glass border border-white/30 dark:border-white/10 p-0.5 text-xs">
              {["All", "Easy", "Medium", "Hard"].map((diff) => (
                <button
                  key={diff}
                  onClick={() => setDifficultyFilter(diff)}
                  className={`px-2.5 py-1 rounded-lg transition-all text-[11px] ${
                    difficultyFilter === diff
                      ? "bg-primary text-primary-foreground font-medium shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <div className="flex items-center rounded-xl glass border border-white/30 dark:border-white/10 p-0.5 text-xs">
              {["All", "Solved", "Unsolved"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg transition-all text-[11px] ${
                    statusFilter === st
                      ? "bg-primary text-primary-foreground font-medium shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Year Cohort Filter Row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs scrollbar-none">
          <span className="text-muted-foreground text-xs flex items-center gap-1 mr-1 shrink-0 font-medium">
            <GraduationCap size={13} /> Cohort Year:
          </span>
          {["All", "1st Year", "2nd Year", "3rd Year", "4th Year"].map((yr) => {
            const isStudentYr = studentAcademicYear === yr;
            const isSelected = yearFilter === yr;
            return (
              <button
                key={yr}
                onClick={() => setYearFilter(yr)}
                className={`px-2.5 py-1 rounded-lg shrink-0 transition-all text-[11px] flex items-center gap-1 ${
                  isSelected
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : isStudentYr
                    ? "bg-purple-500/15 text-purple-800 dark:text-purple-300 border border-purple-500/30 hover:bg-purple-500/25"
                    : "bg-muted/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{yr === "All" ? "All Years" : yr}</span>
                {isStudentYr && (yr as string) !== "All" && (
                  <span className="text-[9px] px-1 py-0 rounded bg-purple-500/20 text-purple-900 dark:text-purple-200 uppercase font-bold">You</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Topic Tags Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs scrollbar-none pt-0.5 border-t border-border/30">
          <span className="text-muted-foreground text-xs flex items-center gap-1 mr-1 shrink-0 font-medium">
            <Tag size={12} /> Topics:
          </span>
          <button
            onClick={() => setSelectedTag("All")}
            className={`px-2 py-0.5 rounded-lg shrink-0 transition-colors text-[11px] ${
              selectedTag === "All"
                ? "bg-primary text-primary-foreground font-medium"
                : "bg-muted/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            All Topics
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-2 py-0.5 rounded-lg shrink-0 transition-colors text-[11px] ${
                selectedTag === tag
                  ? "bg-primary text-primary-foreground font-medium"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Active filters notice if questions count is 0 */}
      {filteredProblems.length === 0 && problems.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
          <span>
            No problems match your current filter selection ({yearFilter !== "All" ? `Cohort: ${yearFilter}` : ""}
            {difficultyFilter !== "All" ? ` · Difficulty: ${difficultyFilter}` : ""}
            {search ? ` · Query: "${search}"` : ""}).
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSearch("");
              setDifficultyFilter("All");
              setYearFilter("All");
              setStatusFilter("All");
              setSelectedTag("All");
            }}
            className="text-xs h-7 rounded-lg border-amber-500/40 hover:bg-amber-500/20 w-fit shrink-0"
          >
            Show All ({problems.length}) Problems
          </Button>
        </div>
      )}

      {/* Problems List / Table */}
      <div className="space-y-2.5">
        {filteredProblems.length === 0 ? (
          <div className="p-8 sm:p-12 text-center rounded-2xl glass">
            <Code2 size={32} className="mx-auto text-muted-foreground mb-3" />
            <h3 className="font-heading font-medium text-foreground text-sm sm:text-base">
              {problems.length === 0 ? "No Problems Published Yet" : "No matching problems found"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {problems.length === 0
                ? "Faculty administrators haven't published any coding challenges yet. Check back soon!"
                : "Try adjusting your search query or reset your year and difficulty filters."}
            </p>
            {problems.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setDifficultyFilter("All");
                  setYearFilter("All");
                  setStatusFilter("All");
                  setSelectedTag("All");
                }}
                className="mt-4 text-xs rounded-xl"
              >
                Reset All Filters
              </Button>
            )}
          </div>
        ) : (
          filteredProblems.map((prob) => {
            const isSolved = solvedProblemIds.has(prob.id);
            const isAttempted = attemptedProblemIds.has(prob.id);

            return (
              <div
                key={prob.id}
                className="group p-3.5 sm:p-4 rounded-xl glass hover:bg-primary/5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 overflow-hidden"
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  {/* Status Icon */}
                  <div className="mt-0.5 sm:mt-0 flex-shrink-0">
                    {isSolved ? (
                      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                        <CheckCircle2 size={15} />
                      </div>
                    ) : isAttempted ? (
                      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                        <Clock size={15} />
                      </div>
                    ) : (
                      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-muted text-muted-foreground/50 flex items-center justify-center text-xs font-mono">
                        ○
                      </div>
                    )}
                  </div>

                  {/* Title & metadata */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <Link
                        to={`/student/problems/${prob.id}`}
                        className="font-heading font-semibold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors hover:underline truncate max-w-[240px] xs:max-w-none"
                      >
                        {prob.title}
                      </Link>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-2 py-0.5 ${getDifficultyColor(
                          prob.difficulty
                        )}`}
                      >
                        {prob.difficulty}
                      </Badge>

                      <Badge
                        variant="outline"
                        className="text-[10px] px-2 py-0.5 border-purple-500/30 text-purple-800 dark:text-purple-300 bg-purple-500/10 font-medium flex items-center gap-1"
                      >
                        <GraduationCap size={10} />
                        {prob.targetYear && prob.targetYear !== "All"
                          ? prob.targetYear
                          : prob.targetSemester && prob.targetSemester !== "All"
                          ? prob.targetSemester
                          : "All Years"}
                      </Badge>

                      <span className="text-[10px] text-muted-foreground font-mono">
                        +{prob.points} pts
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 sm:line-clamp-1 mt-1 break-words">
                      {prob.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 mt-2">
                      {prob.tags.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                      <span className="text-[10px] text-muted-foreground/70 ml-1 sm:ml-2">
                        Author: {prob.author}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right CTA */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t border-border/30 sm:border-0 w-full sm:w-auto">
                  <div className="text-right hidden lg:block">
                    <p className="text-[10px] text-muted-foreground">Test cases</p>
                    <p className="text-xs font-mono font-medium text-foreground">
                      {prob.testCases.length} tests ({prob.testCases.filter(tc => !tc.isHidden).length} public)
                    </p>
                  </div>

                  <Link to={`/student/problems/${prob.id}`} className="w-full sm:w-auto">
                    <Button
                      size="sm"
                      variant={isSolved ? "outline" : "default"}
                      className="rounded-xl gap-1 text-xs w-full sm:w-auto h-8"
                    >
                      <span>{isSolved ? "Review Code" : "Solve Challenge"}</span>
                      <ArrowRight size={13} />
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ProblemsList;
