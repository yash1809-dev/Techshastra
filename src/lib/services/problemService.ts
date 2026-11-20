/**
 * Problem Service for TechShastra
 *
 * Provides CRUD operations for coding problems and assignments.
 * Persists to Supabase `coding_problems` table when configured,
 * and maintains continuous synchronization with localStorage (`ts_coding_problems`)
 * for instant sub-millisecond client renders and offline resilience.
 */

import { supabase, isSupabaseConfigured } from "../supabase/client";
import type { SupportedLanguage, TestCase } from "./codeExecutionService";

export type ProblemDifficulty = "Easy" | "Medium" | "Hard";

export type TargetYear = "All" | "1st Year" | "2nd Year" | "3rd Year" | "4th Year";
export const YEAR_PRESETS: TargetYear[] = ["All", "1st Year", "2nd Year", "3rd Year", "4th Year"];

// Backward compatible alias
export type TargetSemester = TargetYear;
export const SEMESTER_PRESETS = YEAR_PRESETS;

export interface CodingProblem {
  id: string;
  slug: string;
  title: string;
  difficulty: ProblemDifficulty;
  category: string;
  points: number;
  publishedBy: string;
  publishedAt: string;
  isPublished: boolean;
  description: string;
  constraints: string[];
  tags: string[];
  starterCode: Record<SupportedLanguage, string>;
  sampleTestCases: TestCase[];
  hiddenTestCases: TestCase[];
  testCases?: TestCase[];
  examples?: { input: string; output: string; explanation?: string }[];
  /** Which academic year of students can see this problem. "All" = visible to all students. */
  targetYear?: TargetYear;
  /** Backward compatible alias */
  targetSemester?: TargetYear;
}

export const PROBLEMS_STORAGE_KEY = "ts_coding_problems";

// Default starter templates generator
export function getDefaultStarterCode(): Record<SupportedLanguage, string> {
  return {
    python: `# Python 3
import sys

def solve():
    lines = sys.stdin.read().split()
    if not lines:
        return
    # Read input and implement solution
    print("Output")

if __name__ == "__main__":
    solve()
`,
    javascript: `// JavaScript (Node.js)
const fs = require('fs');

function solve() {
    const input = fs.readFileSync(0, 'utf-8').trim();
    if (!input) return;
    // Read input and implement solution
    console.log("Output");
}

solve();
`,
    typescript: `// TypeScript
import * as fs from 'fs';

function solve(): void {
    const input = fs.readFileSync(0, 'utf-8').trim();
    if (!input) return;
    // Read input and implement solution
    console.log("Output");
}

solve();
`,
    cpp: `// C++ 17
#include <iostream>
#include <vector>
#include <string>

using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    
    // Read input and implement solution
    return 0;
}
`,
    java: `// Java 17
import java.util.*;
import java.io.*;

public class Solution {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        // Read input and implement solution
    }
}
`,
  };
}

// ── LOCAL STORAGE HELPERS ───────────────────────────────────────────────────

export function getStoredProblems(): CodingProblem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PROBLEMS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to read problems from localStorage:", err);
    return [];
  }
}

export function saveStoredProblems(problems: CodingProblem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PROBLEMS_STORAGE_KEY, JSON.stringify(problems));
    window.dispatchEvent(new Event("ts_coding_problems_updated"));
  } catch (err) {
    console.error("Failed to save problems to localStorage:", err);
  }
}

// ── SUPABASE MAPPER ─────────────────────────────────────────────────────────

function mapRowToProblem(row: any): CodingProblem {
  const rawTags = Array.isArray(row.tags) ? row.tags : [];
  // Extract target year if embedded in tags (e.g. "year:2nd Year" or "2nd Year")
  const yearTag = rawTags.find((t: string) => typeof t === "string" && t.startsWith("year:"))?.replace("year:", "") ||
    rawTags.find((t: string) => ["1st Year", "2nd Year", "3rd Year", "4th Year"].includes(t));
  const chosenYear = (row.target_year || row.target_semester || yearTag || "All") as TargetYear;
  // Filter out internal "year:*" tags from display tags
  const cleanTags = rawTags.filter((t: string) => typeof t === "string" && !t.startsWith("year:"));

  return {
    id: row.id,
    slug: row.slug || row.id,
    title: row.title,
    difficulty: row.difficulty as ProblemDifficulty,
    category: row.category || "Algorithms",
    points: Number(row.points) || 50,
    publishedBy: row.published_by || "Faculty",
    publishedAt: row.published_at || new Date().toISOString(),
    isPublished: row.is_published ?? true,
    description: row.description || "",
    constraints: Array.isArray(row.constraints) ? row.constraints : [],
    tags: cleanTags,
    starterCode: row.starter_code && Object.keys(row.starter_code).length > 0
      ? row.starter_code
      : getDefaultStarterCode(),
    sampleTestCases: Array.isArray(row.sample_test_cases) ? row.sample_test_cases : [],
    hiddenTestCases: Array.isArray(row.hidden_test_cases) ? row.hidden_test_cases : [],
    targetYear: chosenYear,
    targetSemester: chosenYear,
  };
}

function mapProblemToRow(p: CodingProblem): Record<string, any> {
  const chosenYear = p.targetYear || p.targetSemester || "All";
  // Embed year in tags so it persists reliably in Supabase without requiring optional schema columns
  const baseTags = (p.tags || []).filter((t) => typeof t === "string" && !t.startsWith("year:"));
  if (chosenYear && chosenYear !== "All") {
    baseTags.push(`year:${chosenYear}`);
  }

  return {
    id: p.id,
    slug: p.slug || p.id,
    title: p.title,
    difficulty: p.difficulty,
    category: p.category,
    points: p.points,
    published_by: p.publishedBy,
    published_at: p.publishedAt,
    is_published: p.isPublished,
    description: p.description,
    constraints: p.constraints,
    tags: baseTags,
    starter_code: p.starterCode,
    sample_test_cases: p.sampleTestCases,
    hidden_test_cases: p.hiddenTestCases,
    updated_at: new Date().toISOString(),
  };
}

// ── SERVICE METHODS ─────────────────────────────────────────────────────────

/**
 * Public problem columns that omit hidden test cases to protect evaluation integrity.
 */
const PUBLIC_PROBLEM_COLUMNS =
  "id, slug, title, difficulty, category, points, published_by, published_at, is_published, description, constraints, tags, starter_code, sample_test_cases, created_at, updated_at";

/**
 * Get all published problems for students (omitting secret evaluation cases).
 */
export async function getPublishedProblems(): Promise<CodingProblem[]> {
  if (!isSupabaseConfigured()) {
    return getStoredProblems().filter((p) => p.isPublished).map((p) => ({ ...p, hiddenTestCases: [] }));
  }

  try {
    const { data, error } = await supabase
      .from("coding_problems")
      .select(PUBLIC_PROBLEM_COLUMNS)
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Supabase fetch failed, falling back to local problems:", error);
      return getStoredProblems().filter((p) => p.isPublished).map((p) => ({ ...p, hiddenTestCases: [] }));
    }

    if (data && data.length > 0) {
      // Map rows ensuring hidden test cases are never saved to student local storage
      const mapped = data.map((row: any) => mapRowToProblem({ ...row, hidden_test_cases: [] }));
      // Cache locally
      saveStoredProblems(mapped);
      return mapped;
    }

    // If Supabase returned empty table, check local store
    return getStoredProblems().filter((p) => p.isPublished).map((p) => ({ ...p, hiddenTestCases: [] }));
  } catch (err) {
    console.error("Error fetching published problems:", err);
    return getStoredProblems().filter((p) => p.isPublished).map((p) => ({ ...p, hiddenTestCases: [] }));
  }
}

/**
 * Retrieve evaluation test cases strictly in-memory during submission.
 * Never persisted to localStorage or public state.
 */
export async function getProblemEvaluationCases(problemId: string): Promise<TestCase[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from("coding_problems")
        .select("sample_test_cases, hidden_test_cases")
        .eq("id", problemId)
        .maybeSingle();

      if (!error && data) {
        const samples = Array.isArray(data.sample_test_cases) ? data.sample_test_cases : [];
        const hiddens = Array.isArray(data.hidden_test_cases) ? data.hidden_test_cases : [];
        return [
          ...samples.map((tc: any) => ({ ...tc, isHidden: false })),
          ...hiddens.map((tc: any) => ({ ...tc, isHidden: true })),
        ];
      }
    } catch (_e) {}
  }

  // Fallback to local store if offline
  const localList = getStoredProblems();
  const problem = localList.find((p) => p.id === problemId);
  if (problem) {
    const samples = problem.sampleTestCases || [];
    const hiddens = problem.hiddenTestCases || [];
    return [
      ...samples.map((tc) => ({ ...tc, isHidden: false })),
      ...hiddens.map((tc) => ({ ...tc, isHidden: true })),
    ];
  }
  return [];
}

/**
 * Get all problems (published and drafts) for admin and superadmin management.
 */
export async function getAllProblemsAdmin(): Promise<CodingProblem[]> {
  if (!isSupabaseConfigured()) {
    return getStoredProblems();
  }

  try {
    const { data, error } = await supabase
      .from("coding_problems")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Supabase admin fetch failed, falling back to local:", error);
      return getStoredProblems();
    }

    if (data) {
      const mapped = data.map(mapRowToProblem);
      saveStoredProblems(mapped);
      return mapped;
    }

    return getStoredProblems();
  } catch (err) {
    console.error("Error fetching admin problems:", err);
    return getStoredProblems();
  }
}

/**
 * Get problem by ID.
 */
export async function getProblemById(id: string): Promise<CodingProblem | null> {
  const localList = getStoredProblems();
  const cached = localList.find((p) => p.id === id);

  if (!isSupabaseConfigured()) {
    return cached || null;
  }

  try {
    const { data, error } = await supabase
      .from("coding_problems")
      .select(PUBLIC_PROBLEM_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      return cached || null;
    }

    const problem = mapRowToProblem({ ...data, hidden_test_cases: [] });
    return problem;
  } catch {
    return cached || null;
  }
}

/**
 * Create or update a problem.
 */
export async function saveProblem(
  problem: Omit<CodingProblem, "id"> & { id?: string }
): Promise<CodingProblem> {
  const isNew = !problem.id;
  const id = problem.id || `prob-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`;
  const slug =
    problem.slug ||
    problem.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const fullProblem: CodingProblem = {
    ...problem,
    id,
    slug,
    isPublished: problem.isPublished ?? true,
    publishedAt: problem.publishedAt || new Date().toISOString(),
    publishedBy: problem.publishedBy || "Faculty Admin",
    starterCode: problem.starterCode || getDefaultStarterCode(),
    constraints: problem.constraints || [],
    tags: problem.tags || [],
    sampleTestCases: problem.sampleTestCases || [],
    hiddenTestCases: problem.hiddenTestCases || [],
  };

  // Update local storage immediately
  const existing = getStoredProblems();
  const index = existing.findIndex((p) => p.id === id);
  if (index >= 0) {
    existing[index] = fullProblem;
  } else {
    existing.unshift(fullProblem);
  }
  saveStoredProblems(existing);

  // Sync to Supabase
  if (isSupabaseConfigured()) {
    try {
      const row = mapProblemToRow(fullProblem);
      if (isNew) {
        await supabase.from("coding_problems").insert(row);
      } else {
        await supabase.from("coding_problems").update(row).eq("id", id);
      }
    } catch (err) {
      console.warn("Failed to sync problem to Supabase:", err);
    }
  }

  return fullProblem;
}

/**
 * Delete a problem.
 */
export async function deleteProblem(id: string): Promise<boolean> {
  // Update local storage
  const existing = getStoredProblems();
  const filtered = existing.filter((p) => p.id !== id);
  saveStoredProblems(filtered);

  // Sync with Supabase
  if (isSupabaseConfigured()) {
    try {
      await supabase.from("coding_problems").delete().eq("id", id);
    } catch (err) {
      console.warn("Failed to delete problem from Supabase:", err);
    }
  }

  return true;
}

/**
 * Toggle problem publish status.
 */
export async function toggleProblemPublish(id: string, isPublished: boolean): Promise<boolean> {
  const existing = getStoredProblems();
  const prob = existing.find((p) => p.id === id);
  if (prob) {
    prob.isPublished = isPublished;
    saveStoredProblems(existing);
  }

  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from("coding_problems")
        .update({ is_published: isPublished, updated_at: new Date().toISOString() })
        .eq("id", id);
    } catch (err) {
      console.warn("Failed to toggle publish on Supabase:", err);
    }
  }

  return true;
}
