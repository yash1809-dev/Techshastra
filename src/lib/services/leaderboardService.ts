/**
 * Leaderboard & Cloud Sync Service for TechShastra
 *
 * Persists and fetches student typing records and problem submissions from
 * Supabase Cloud (`student_typing_records` and `student_problem_submissions`).
 * Synchronizes with localStorage for instant sub-millisecond client renders
 * and offline resilience.
 */

import { supabase, isSupabaseConfigured } from "../supabase/client";
import type { TypingScoreRecord } from "../codingStore";
import type { ProblemSubmission } from "../codingStore";

export interface RemoteTypingRecord {
  id: string;
  studentId: string;
  studentName: string;
  githubUsername: string;
  college: string;
  wpm: number;
  accuracy: number;
  errors: number;
  durationSeconds: number;
  mode: string;
  createdAt: string;
}

export interface RemoteProblemSubmission {
  id: string;
  problemId: string;
  problemTitle: string;
  studentId: string;
  studentName: string;
  githubUsername: string;
  college: string;
  language: string;
  code?: string;
  status: string;
  passedTestCases: number;
  totalTestCases: number;
  runtimeMs: number;
  scoreAwarded: number;
  submittedAt: string;
}

/**
 * Fetch all typing records from Supabase Cloud
 */
export async function fetchRemoteTypingRecords(): Promise<TypingScoreRecord[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from("student_typing_records")
      .select("*")
      .order("wpm", { ascending: false });

    if (error) {
      console.warn("[leaderboardService] fetchRemoteTypingRecords error:", error.message);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      studentId: row.student_id,
      studentName: row.student_name,
      githubUsername: row.github_username,
      college: row.college || "UTU Sudhowala (Main Campus)",
      wpm: Number(row.wpm) || 0,
      accuracy: Number(row.accuracy) || 0,
      errors: Number(row.errors) || 0,
      durationSeconds: Number(row.duration_seconds) || 30,
      mode: row.mode || "code",
      createdAt: row.created_at,
    }));
  } catch (err) {
    console.warn("[leaderboardService] fetchRemoteTypingRecords exception:", err);
    return [];
  }
}

/**
 * Persist a typing record to Supabase Cloud
 */
export async function syncTypingRecordToRemote(
  record: TypingScoreRecord & { college?: string }
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    const payload = {
      id: record.id,
      student_id: record.studentId || "guest",
      student_name: record.studentName || "Student",
      github_username: (record as any).githubUsername || "",
      college: (record as any).college || "UTU Sudhowala (Main Campus)",
      wpm: record.wpm,
      accuracy: record.accuracy,
      errors: record.errors || 0,
      duration_seconds: record.durationSeconds || 30,
      mode: record.mode || "code",
      created_at: record.createdAt || new Date().toISOString(),
    };

    const { error } = await supabase
      .from("student_typing_records")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      console.warn("[leaderboardService] syncTypingRecordToRemote error:", error.message);
    }
  } catch (err) {
    console.warn("[leaderboardService] syncTypingRecordToRemote exception:", err);
  }
}

/**
 * Fetch all problem submissions from Supabase Cloud
 */
export async function fetchRemoteProblemSubmissions(): Promise<ProblemSubmission[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from("student_problem_submissions")
      .select("*")
      .order("submitted_at", { ascending: false });

    if (error) {
      console.warn("[leaderboardService] fetchRemoteProblemSubmissions error:", error.message);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      problemId: row.problem_id,
      problemTitle: row.problem_title || "Problem",
      studentId: row.student_id,
      studentName: row.student_name,
      githubUsername: row.github_username,
      college: row.college || "UTU Sudhowala (Main Campus)",
      language: row.language || "python",
      code: row.code || "",
      status: row.status || "Accepted",
      passedTestCases: Number(row.passed_test_cases) || 0,
      totalTestCases: Number(row.total_test_cases) || 0,
      runtimeMs: Number(row.runtime_ms) || 0,
      scoreAwarded: Number(row.score_awarded) || 0,
      submittedAt: row.submitted_at,
    }));
  } catch (err) {
    console.warn("[leaderboardService] fetchRemoteProblemSubmissions exception:", err);
    return [];
  }
}

/**
 * Persist a problem submission to Supabase Cloud
 */
export async function syncSubmissionToRemote(
  sub: ProblemSubmission & { college?: string }
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    const payload = {
      id: sub.id,
      problem_id: sub.problemId,
      problem_title: sub.problemTitle || "Problem",
      student_id: sub.studentId || "guest",
      student_name: sub.studentName || "Student",
      github_username: (sub as any).githubUsername || "",
      college: (sub as any).college || "UTU Sudhowala (Main Campus)",
      language: sub.language || "python",
      code: sub.code || "",
      status: sub.status || "Accepted",
      passed_test_cases: sub.passedTestCases || 0,
      total_test_cases: sub.totalTestCases || 0,
      runtime_ms: sub.runtimeMs || 0,
      score_awarded: sub.scoreAwarded || 0,
      submitted_at: sub.submittedAt || new Date().toISOString(),
    };

    const { error } = await supabase
      .from("student_problem_submissions")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      console.warn("[leaderboardService] syncSubmissionToRemote error:", error.message);
    }
  } catch (err) {
    console.warn("[leaderboardService] syncSubmissionToRemote exception:", err);
  }
}

/**
 * Sync local storage records to Supabase Cloud and merge remote records.
 * Pushes any local records that aren't on Supabase so past runs are never lost.
 */
export async function syncLeaderboardData(
  localTypingRecords: TypingScoreRecord[],
  localSubmissions: ProblemSubmission[]
): Promise<{
  typingRecords: TypingScoreRecord[];
  submissions: ProblemSubmission[];
}> {
  if (!isSupabaseConfigured()) {
    return { typingRecords: localTypingRecords, submissions: localSubmissions };
  }

  try {
    const [remoteTyping, remoteSubs] = await Promise.all([
      fetchRemoteTypingRecords(),
      fetchRemoteProblemSubmissions(),
    ]);

    // Push local typing records to remote if they don't exist remotely
    const remoteTypingIds = new Set(remoteTyping.map((r) => r.id));
    const missingTyping = localTypingRecords.filter((r) => !remoteTypingIds.has(r.id));
    for (const rec of missingTyping) {
      await syncTypingRecordToRemote(rec);
    }

    // Merge typing records: remote + any local
    const mergedTypingMap = new Map<string, TypingScoreRecord>();
    remoteTyping.forEach((r) => mergedTypingMap.set(r.id, r));
    localTypingRecords.forEach((r) => {
      if (!mergedTypingMap.has(r.id)) {
        mergedTypingMap.set(r.id, r);
      }
    });
    const finalTyping = Array.from(mergedTypingMap.values());

    // Push local submissions to remote if they don't exist remotely
    const remoteSubIds = new Set(remoteSubs.map((s) => s.id));
    const missingSubs = localSubmissions.filter((s) => !remoteSubIds.has(s.id));
    for (const sub of missingSubs) {
      await syncSubmissionToRemote(sub);
    }

    // Merge submissions
    const mergedSubsMap = new Map<string, ProblemSubmission>();
    remoteSubs.forEach((s) => mergedSubsMap.set(s.id, s));
    localSubmissions.forEach((s) => {
      if (!mergedSubsMap.has(s.id)) {
        mergedSubsMap.set(s.id, s);
      }
    });
    const finalSubs = Array.from(mergedSubsMap.values());

    return {
      typingRecords: finalTyping,
      submissions: finalSubs,
    };
  } catch (err) {
    console.warn("[leaderboardService] syncLeaderboardData exception:", err);
    return { typingRecords: localTypingRecords, submissions: localSubmissions };
  }
}

/**
 * Subscribe to realtime leaderboard updates from other students
 */
export function subscribeToLeaderboardUpdates(onUpdate: () => void): () => void {
  if (!isSupabaseConfigured()) return () => {};

  try {
    const channel = supabase
      .channel("public:leaderboard-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "student_typing_records" },
        () => onUpdate()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "student_problem_submissions" },
        () => onUpdate()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    console.warn("[leaderboardService] Realtime subscription error:", err);
    return () => {};
  }
}
