/**
 * Coding & Learning Data Store for TechShastra Student Hub.
 *
 * Fully integrated with Supabase and ProblemService.
 * Zero hardcoded demo questions or fake peer students.
 * Admin and SuperAdmin manage published problems and assignments dynamically.
 */

import { type SupportedLanguage, type TestCase } from "./services/codeExecutionService";
import {
  getStoredProblems,
  saveStoredProblems,
  type CodingProblem,
  type ProblemDifficulty,
} from "./services/problemService";

export type { CodingProblem, ProblemDifficulty };

export interface ProblemSubmission {
  id: string;
  problemId: string;
  problemTitle: string;
  studentId: string;
  studentName: string;
  language: SupportedLanguage;
  code: string;
  status: "Accepted" | "Wrong Answer" | "Compilation Error" | "Runtime Error" | "Time Limit Exceeded";
  passedTestCases: number;
  totalTestCases: number;
  runtimeMs: number;
  submittedAt: string;
  scoreAwarded: number;
}

export interface TypingScoreRecord {
  id: string;
  studentId: string;
  studentName: string;
  wpm: number;
  rawWpm?: number;
  accuracy: number;
  errors: number;
  durationSeconds: number;
  mode: "prose" | "code";
  createdAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  name: string;
  studentName?: string;
  githubUsername: string;
  college: string;
  avatarUrl?: string;
  problemsSolved: number;
  accuracyRate: number;
  codingPoints: number;
  typingBestWpm: number;
  typingWpm?: number;
  totalScore: number;
  badge?: "gold" | "silver" | "bronze" | "elite";
}

// ── PROBLEM ADAPTER & ENRICHMENT ───────────────────────────────────────────

export type Problem = CodingProblem & {
  author: string;
  testCases: TestCase[];
  examples: { input: string; output: string; explanation?: string }[];
};

export function enrichProblem(p: CodingProblem): Problem {
  const sample = p.sampleTestCases || [];
  const hidden = p.hiddenTestCases || [];
  const testCases = p.testCases && p.testCases.length > 0
    ? p.testCases
    : [
        ...sample.map((tc) => ({ ...tc, isHidden: false })),
        ...hidden.map((tc) => ({ ...tc, isHidden: true })),
      ];

  const examples =
    p.examples && p.examples.length > 0
      ? p.examples
      : sample.map((tc) => ({
          input: tc.input,
          output: tc.expectedOutput,
          explanation: tc.explanation,
        }));

  const chosenYear = p.targetYear || p.targetSemester || "All";

  return {
    ...p,
    targetYear: chosenYear as any,
    targetSemester: chosenYear as any,
    author: p.publishedBy || "Faculty Admin",
    testCases,
    examples,
  };
}

export const getProblemsCatalog = (): Problem[] => {
  const problems = getStoredProblems();
  return problems.filter((p) => p.isPublished).map(enrichProblem);
};

export const getProblemById = (id: string): Problem | undefined => {
  const problems = getStoredProblems();
  const p = problems.find((prob) => prob.id === id);
  return p ? enrichProblem(p) : undefined;
};

// ── SUBMISSION PERSISTENCE ───────────────────────────────────────────────────

const SUBMISSIONS_STORAGE_KEY = "ts_student_submissions";
const TYPING_STORAGE_KEY = "ts_student_typing_records";

export function getStoredSubmissions(studentId?: string): ProblemSubmission[] {
  try {
    const raw = localStorage.getItem(SUBMISSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: ProblemSubmission[] = JSON.parse(raw);
    if (studentId) {
      const target = studentId.toLowerCase().trim();
      return parsed.filter(
        (s) =>
          (s.studentId && s.studentId.toLowerCase().trim() === target) ||
          ((s as any).githubUsername && (s as any).githubUsername.toLowerCase().trim() === target)
      );
    }
    return parsed;
  } catch {
    return [];
  }
}

export function saveSubmission(submission: any): ProblemSubmission {
  try {
    const existing = getStoredSubmissions();
    const id = submission.id || `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const submittedAt = submission.submittedAt || new Date().toISOString();
    const sub: ProblemSubmission = {
      id,
      problemId: submission.problemId,
      problemTitle: submission.problemTitle || "Problem",
      studentId: submission.studentId || "guest",
      studentName: submission.studentName || "Student",
      language: submission.language || "python",
      code: submission.code,
      status: submission.status || "Accepted",
      passedTestCases: submission.passedTestCases || 0,
      totalTestCases: submission.totalTestCases || 0,
      runtimeMs: submission.runtimeMs || 0,
      submittedAt,
      scoreAwarded: submission.scoreAwarded || 0,
    };
    (sub as any).githubUsername = submission.githubUsername || "";
    const updated = [sub, ...existing.filter((s) => s.id !== sub.id)];
    localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(updated));

    // Asynchronously push to Supabase Cloud
    import("./services/leaderboardService").then(({ syncSubmissionToRemote }) => {
      syncSubmissionToRemote({ ...sub, college: submission.college });
    }).catch(() => {});

    return sub;
  } catch (err) {
    console.error("Failed to save submission locally:", err);
    return submission;
  }
}

export function getProblemStatusForStudent(
  problemId: string,
  studentId: string
): "Solved" | "Attempted" | "Todo" {
  const submissions = getStoredSubmissions(studentId).filter((s) => s.problemId === problemId);
  if (submissions.some((s) => s.status === "Accepted")) return "Solved";
  if (submissions.length > 0) return "Attempted";
  return "Todo";
}

// ── TYPING TEST PERSISTENCE & 7-DAY AUTO-PRUNING ────────────────────────────

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function pruneOldTypingRecords(records: TypingScoreRecord[]): {
  pruned: TypingScoreRecord[];
  hasChanged: boolean;
} {
  if (!records || records.length === 0) return { pruned: [], hasChanged: false };
  const now = Date.now();

  // Group records by student canonical key
  const groups = new Map<string, TypingScoreRecord[]>();
  for (const r of records) {
    const key = (
      (r as any).githubUsername ||
      r.studentId ||
      r.studentName ||
      "guest"
    )
      .toLowerCase()
      .trim();
    const list = groups.get(key) || [];
    list.push(r);
    groups.set(key, list);
  }

  const result: TypingScoreRecord[] = [];
  let changed = false;

  groups.forEach((group) => {
    // Identify the student's all-time best record (highest WPM, then accuracy)
    let best = group[0];
    for (const item of group) {
      if (
        item.wpm > best.wpm ||
        (item.wpm === best.wpm && item.accuracy > best.accuracy)
      ) {
        best = item;
      }
    }

    for (const item of group) {
      const isBest = item.id === best.id;
      const age = now - new Date(item.createdAt).getTime();
      const isWithin7Days = !isNaN(age) && age <= SEVEN_DAYS_MS;

      // Keep if it is within 7 days OR if it is their all-time personal best record
      if (isBest || isWithin7Days) {
        result.push({
          ...item,
          isPersonalBest: isBest,
        } as any);
      } else {
        changed = true; // Cleared an older non-best record (> 7 days)
      }
    }
  });

  return { pruned: result, hasChanged: changed };
}

export function getStoredTypingRecords(studentId?: string): TypingScoreRecord[] {
  try {
    const raw = localStorage.getItem(TYPING_STORAGE_KEY);
    if (!raw) return [];
    let parsed: TypingScoreRecord[] = JSON.parse(raw);

    // Auto-prune records older than 7 days while preserving personal bests permanently
    const { pruned, hasChanged } = pruneOldTypingRecords(parsed);
    if (hasChanged) {
      localStorage.setItem(TYPING_STORAGE_KEY, JSON.stringify(pruned));
    }
    parsed = pruned;

    if (studentId) {
      const target = studentId.toLowerCase().trim();
      return parsed.filter(
        (r) =>
          (r.studentId && r.studentId.toLowerCase().trim() === target) ||
          ((r as any).githubUsername && (r as any).githubUsername.toLowerCase().trim() === target)
      );
    }
    return parsed;
  } catch {
    return [];
  }
}

export function saveTypingRecord(record: any): TypingScoreRecord {
  try {
    const existing = getStoredTypingRecords();
    const id = record.id || `type-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const createdAt = record.createdAt || new Date().toISOString();
    const rec: TypingScoreRecord = {
      id,
      studentId: record.studentId || "guest",
      studentName: record.studentName || "Student",
      wpm: record.wpm,
      rawWpm: record.rawWpm ?? record.wpm,
      accuracy: record.accuracy,
      errors: record.errors || 0,
      durationSeconds: record.durationSeconds || 30,
      mode: record.mode || "code",
      createdAt,
    };
    (rec as any).githubUsername = record.githubUsername || "";
    (rec as any).totalTypos = record.totalTypos || record.errors || 0;
    (rec as any).unfixedErrors = record.unfixedErrors || 0;
    (rec as any).rawWpm = record.rawWpm ?? record.wpm;

    const combined = [rec, ...existing.filter((e) => e.id !== rec.id)];
    const { pruned } = pruneOldTypingRecords(combined);
    localStorage.setItem(TYPING_STORAGE_KEY, JSON.stringify(pruned));

    // Asynchronously push to Supabase Cloud
    import("./services/leaderboardService").then(({ syncTypingRecordToRemote }) => {
      syncTypingRecordToRemote({ ...rec, college: record.college });
    }).catch(() => {});

    return rec;
  } catch (err) {
    console.error("Failed to save typing record:", err);
    return record;
  }
}

// ── REAL STUDENT LEADERBOARD (Zero Hardcoded Demo Peers) ─────────────────────

export const PARTICIPATING_COLLEGES = [
  "UTU Sudhowala (Main Campus)",
  "B.T.K.I.T. Dwarahat",
  "Institute of Technology Gopeshwar",
  "THDC-IHET Tehri & GWIT",
  "Dr. APJ Abdul Kalam Institute Tanakpur",
  "NPSEI Pithoragarh",
  "Women Institute of Technology (WIT) Dehradun",
];

export function getFullLeaderboard(
  currentStudentSession?: {
    studentId: string;
    name: string;
    githubUsername: string;
    college?: string;
  },
  customSubmissions?: ProblemSubmission[],
  customTypingRecords?: TypingScoreRecord[]
): LeaderboardEntry[] {
  const submissions = customSubmissions || getStoredSubmissions();
  let typingRecords = customTypingRecords || getStoredTypingRecords();
  const catalog = getProblemsCatalog();

  // Deduplicate and heal legacy typing records that had name === currentStudentSession.name
  // but missing/wrong githubUsername so the user's past tests correctly associate with them
  if (currentStudentSession && typeof window !== "undefined") {
    try {
      let changed = false;
      typingRecords = typingRecords.map((t) => {
        const matchesCurrent =
          (currentStudentSession.studentId && t.studentId === currentStudentSession.studentId) ||
          (currentStudentSession.name && t.studentName?.trim().toLowerCase() === currentStudentSession.name.trim().toLowerCase()) ||
          (currentStudentSession.githubUsername && (t as any).githubUsername?.toLowerCase() === currentStudentSession.githubUsername.toLowerCase());

        if (matchesCurrent && (!(t as any).githubUsername || t.studentId !== currentStudentSession.studentId)) {
          changed = true;
          return {
            ...t,
            studentId: currentStudentSession.studentId,
            studentName: currentStudentSession.name,
            githubUsername: currentStudentSession.githubUsername,
          } as any;
        }
        return t;
      });
      if (changed) {
        localStorage.setItem(TYPING_STORAGE_KEY, JSON.stringify(typingRecords));
      }
    } catch (_e) {}
  }

  // Helper to determine the canonical identity key for a record
  const resolveStudentKey = (
    recStudentId?: string,
    recGhUsername?: string,
    recName?: string
  ): { key: string; name: string; gh: string } => {
    // If it matches the current logged-in user in any way, unify under their GitHub username!
    if (currentStudentSession) {
      const matchId =
        Boolean(recStudentId &&
        currentStudentSession.studentId &&
        recStudentId.toLowerCase() === currentStudentSession.studentId.toLowerCase());
      const matchGh =
        Boolean(recGhUsername &&
        currentStudentSession.githubUsername &&
        recGhUsername.toLowerCase() === currentStudentSession.githubUsername.toLowerCase());
      const matchName =
        Boolean(recName &&
        currentStudentSession.name &&
        recName.trim().toLowerCase() === currentStudentSession.name.trim().toLowerCase());

      if (matchId || matchGh || matchName) {
        return {
          key: `canonical:${currentStudentSession.githubUsername.toLowerCase()}`,
          name: currentStudentSession.name,
          gh: currentStudentSession.githubUsername,
        };
      }
    }

    if (recGhUsername && recGhUsername.trim() && recGhUsername.toLowerCase() !== "student" && recGhUsername.toLowerCase() !== "guest") {
      return {
        key: `gh:${recGhUsername.trim().toLowerCase()}`,
        name: recName || "Student",
        gh: recGhUsername.trim(),
      };
    }

    if (recStudentId && recStudentId.trim() && recStudentId !== "guest" && recStudentId !== "student") {
      return {
        key: `id:${recStudentId.trim().toLowerCase()}`,
        name: recName || "Student",
        gh: recGhUsername || recName?.toLowerCase().replace(/\s+/g, "") || "student",
      };
    }

    if (recName && recName.trim()) {
      return {
        key: `name:${recName.trim().toLowerCase()}`,
        name: recName.trim(),
        gh: recGhUsername || recName.toLowerCase().replace(/\s+/g, ""),
      };
    }

    return {
      key: `guest`,
      name: "Guest Student",
      gh: "guest",
    };
  };

  const studentMap = new Map<string, {
    studentId: string;
    name: string;
    githubUsername: string;
    college: string;
    solvedProblemIds: Set<string>;
    totalAttempts: number;
    acceptedAttempts: number;
    codingPoints: number;
    typingBestWpm: number;
  }>();

  // Always seed the current logged-in student first so they are guaranteed present
  if (currentStudentSession && currentStudentSession.githubUsername) {
    const canonicalKey = `canonical:${currentStudentSession.githubUsername.toLowerCase()}`;
    studentMap.set(canonicalKey, {
      studentId: currentStudentSession.studentId,
      name: currentStudentSession.name || "Student",
      githubUsername: currentStudentSession.githubUsername,
      college: currentStudentSession.college || "UTU Sudhowala (Main Campus)",
      solvedProblemIds: new Set(),
      totalAttempts: 0,
      acceptedAttempts: 0,
      codingPoints: 0,
      typingBestWpm: 0,
    });
  }

  // 1. Process real submissions
  for (const sub of submissions) {
    const { key, name, gh } = resolveStudentKey(sub.studentId, (sub as any).githubUsername, sub.studentName);
    let entry = studentMap.get(key);
    if (!entry) {
      entry = {
        studentId: sub.studentId || "student",
        name: name || sub.studentName || "Student",
        githubUsername: gh,
        college: "UTU Sudhowala (Main Campus)",
        solvedProblemIds: new Set(),
        totalAttempts: 0,
        acceptedAttempts: 0,
        codingPoints: 0,
        typingBestWpm: 0,
      };
      studentMap.set(key, entry);
    }

    entry.totalAttempts += 1;
    if (sub.status === "Accepted") {
      entry.acceptedAttempts += 1;
      if (!entry.solvedProblemIds.has(sub.problemId)) {
        entry.solvedProblemIds.add(sub.problemId);
        const prob = catalog.find((p) => p.id === sub.problemId);
        entry.codingPoints += prob ? prob.points : 50;
      }
    }
  }

  // 2. Process real typing records
  for (const typ of typingRecords) {
    const { key, name, gh } = resolveStudentKey(typ.studentId, (typ as any).githubUsername, typ.studentName);
    let entry = studentMap.get(key);
    if (!entry) {
      entry = {
        studentId: typ.studentId || "student",
        name: name || typ.studentName || "Student",
        githubUsername: gh,
        college: "UTU Sudhowala (Main Campus)",
        solvedProblemIds: new Set(),
        totalAttempts: 0,
        acceptedAttempts: 0,
        codingPoints: 0,
        typingBestWpm: 0,
      };
      studentMap.set(key, entry);
    }

    if (typ.wpm > entry.typingBestWpm) {
      entry.typingBestWpm = typ.wpm;
    }
  }

  const entries: Omit<LeaderboardEntry, "rank">[] = Array.from(studentMap.values()).map((s) => {
    const accuracyRate =
      s.totalAttempts > 0
        ? Math.round((s.acceptedAttempts / s.totalAttempts) * 100)
        : 100;
    const totalScore = s.codingPoints + s.typingBestWpm;

    return {
      studentId: s.studentId,
      name: s.name,
      studentName: s.name,
      githubUsername: s.githubUsername,
      college: s.college,
      problemsSolved: s.solvedProblemIds.size,
      accuracyRate,
      codingPoints: s.codingPoints,
      typingBestWpm: s.typingBestWpm,
      typingWpm: s.typingBestWpm,
      totalScore,
    };
  });

  // Sort descending by totalScore, then problemsSolved, then accuracyRate
  entries.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.problemsSolved !== a.problemsSolved) return b.problemsSolved - a.problemsSolved;
    return b.accuracyRate - a.accuracyRate;
  });

  return entries.map((entry, index) => {
    const rank = index + 1;
    let badge: LeaderboardEntry["badge"] = undefined;
    if (rank === 1) badge = "gold";
    else if (rank === 2) badge = "silver";
    else if (rank === 3) badge = "bronze";
    else if (rank <= 5) badge = "elite";

    return {
      ...entry,
      rank,
      badge,
    };
  });
}

export type Submission = ProblemSubmission;
export type TypingRecord = TypingScoreRecord & { takenAt: string; isPersonalBest?: boolean };

export interface TypingLeaderboardItem {
  rank: number;
  studentId: string;
  name: string;
  studentName: string;
  githubUsername: string;
  college: string;
  typingBestWpm: number;
  accuracyRate: number;
  testCount: number;
  lastTestedAt: string;
  badge?: "gold" | "silver" | "bronze" | "elite";
}

export interface ProblemLeaderboardItem {
  rank: number;
  studentId: string;
  name: string;
  studentName: string;
  githubUsername: string;
  college: string;
  problemsSolved: number;
  codingPoints: number;
  accuracyRate: number;
  totalAttempts: number;
  badge?: "gold" | "silver" | "bronze" | "elite";
}

export function getTypingLeaderboard(
  currentStudentSession?: {
    studentId: string;
    name: string;
    githubUsername: string;
    college?: string;
  },
  duration?: number,
  allRecordsOverride?: TypingScoreRecord[]
): TypingLeaderboardItem[] {
  let allRecords = allRecordsOverride || getStoredTypingRecords();
  
  // Filter out invalid/spam runs (minimum 50% accuracy and positive WPM required for leaderboard)
  allRecords = allRecords.filter((r) => (Number(r.wpm) || 0) > 0 && (Number(r.accuracy) || 0) >= 50);

  if (duration) {
    allRecords = allRecords.filter((r) => (r.durationSeconds || 30) === duration);
  }

  const studentMap = new Map<string, {
    studentId: string;
    name: string;
    githubUsername: string;
    college: string;
    bestWpm: number;
    bestAccuracy: number;
    testCount: number;
    lastTestedAt: string;
  }>();

  for (const typ of allRecords) {
    const gh = ((typ as any).githubUsername || typ.studentId || "student").trim();
    const name = typ.studentName || "Student";
    const key = gh.toLowerCase();
    const recCollege = (typ as any).college || (currentStudentSession?.githubUsername?.toLowerCase() === key ? currentStudentSession.college : undefined) || "UTU Sudhowala (Main Campus)";

    let entry = studentMap.get(key);
    if (!entry) {
      entry = {
        studentId: typ.studentId || "student",
        name,
        githubUsername: gh,
        college: recCollege,
        bestWpm: typ.wpm,
        bestAccuracy: typ.accuracy,
        testCount: 1,
        lastTestedAt: typ.createdAt,
      };
      studentMap.set(key, entry);
    } else {
      entry.testCount += 1;
      if (typ.wpm > entry.bestWpm || (typ.wpm === entry.bestWpm && typ.accuracy > entry.bestAccuracy)) {
        entry.bestWpm = typ.wpm;
        entry.bestAccuracy = typ.accuracy;
      }
      if (new Date(typ.createdAt).getTime() > new Date(entry.lastTestedAt).getTime()) {
        entry.lastTestedAt = typ.createdAt;
      }
    }
  }

  const list = Array.from(studentMap.values()).map((s) => ({
    studentId: s.studentId,
    name: s.name,
    studentName: s.name,
    githubUsername: s.githubUsername,
    college: s.college,
    typingBestWpm: s.bestWpm,
    accuracyRate: s.bestAccuracy,
    testCount: s.testCount,
    lastTestedAt: s.lastTestedAt,
  }));

  list.sort((a, b) => {
    if (b.typingBestWpm !== a.typingBestWpm) return b.typingBestWpm - a.typingBestWpm;
    return b.accuracyRate - a.accuracyRate;
  });

  return list.map((entry, index) => {
    const rank = index + 1;
    let badge: TypingLeaderboardItem["badge"] = undefined;
    if (rank === 1) badge = "gold";
    else if (rank === 2) badge = "silver";
    else if (rank === 3) badge = "bronze";
    else if (rank <= 5) badge = "elite";
    return { ...entry, rank, badge };
  });
}

export function getProblemLeaderboard(
  currentStudentSession?: {
    studentId: string;
    name: string;
    githubUsername: string;
    college?: string;
  },
  customSubmissions?: ProblemSubmission[]
): ProblemLeaderboardItem[] {
  const full = getFullLeaderboard(currentStudentSession, customSubmissions);
  const list = full
    .filter((e) => e.problemsSolved > 0 || e.codingPoints > 0)
    .map((e) => ({
      studentId: e.studentId,
      name: e.studentName || e.name,
      studentName: e.studentName || e.name,
      githubUsername: e.githubUsername,
      college: e.college,
      problemsSolved: e.problemsSolved,
      codingPoints: e.codingPoints,
      accuracyRate: e.accuracyRate,
      totalAttempts: e.problemsSolved,
    }));

  list.sort((a, b) => {
    if (b.codingPoints !== a.codingPoints) return b.codingPoints - a.codingPoints;
    if (b.problemsSolved !== a.problemsSolved) return b.problemsSolved - a.problemsSolved;
    return b.accuracyRate - a.accuracyRate;
  });

  return list.map((entry, index) => {
    const rank = index + 1;
    let badge: ProblemLeaderboardItem["badge"] = undefined;
    if (rank === 1) badge = "gold";
    else if (rank === 2) badge = "silver";
    else if (rank === 3) badge = "bronze";
    else if (rank <= 5) badge = "elite";
    return { ...entry, rank, badge };
  });
}

export const getUserSubmissions = (studentId?: string): ProblemSubmission[] =>
  getStoredSubmissions(studentId);

export const getLeaderboard = (session?: any): LeaderboardEntry[] =>
  getFullLeaderboard(session);

export const getTypingRecords = (studentId?: string): TypingRecord[] =>
  getStoredTypingRecords(studentId).map((r) => ({
    ...r,
    takenAt: r.createdAt,
    isPersonalBest: (r as any).isPersonalBest,
  }));
