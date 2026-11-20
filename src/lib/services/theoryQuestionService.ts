/**
 * theoryQuestionService.ts
 *
 * Universal Academic Question Bank Service for Theory & Numerical questions.
 * Supports:
 * - Supabase PostgreSQL table `theory_question_bank` with JSONB sub-parts
 * - Offline-first resilient fallback to localStorage (`ts_theory_questions`)
 * - Batch question upload, diagram attachment, marks sorting & filtering
 * - Random examination paper synthesis
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";

export type QuestionCategory = "theory" | "numerical" | "diagram" | "mcq" | "short" | "long";

export interface QuestionSubPart {
  label: string; // e.g. "(a)", "(b)", "i", "ii"
  text: string;
  marks?: number | null;
}

export interface TheoryQuestion {
  id: string;
  subject: string;
  subjectCode?: string;
  yearCohort?: string;
  questionText: string;
  marks?: number | null; // Nullable: teacher can leave blank for uncategorized/general
  questionType: QuestionCategory;
  topic?: string;
  diagramUrl?: string; // Base64 data URL or Supabase storage link for circuits, graphs, formulas
  subParts?: QuestionSubPart[];
  options?: string[]; // For MCQs
  sourceFileName?: string;
  createdAt: string;
  updatedAt: string;
}

const LOCAL_STORAGE_KEY = "ts_theory_questions_v1";

// ─── LOCAL STORAGE HELPERS ────────────────────────────────────────────────────

export const getLocalTheoryQuestions = (): TheoryQuestion[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as TheoryQuestion[];
    // Strip any old preloaded seed questions on first read
    const cleaned = all.filter((q) => !q.id.startsWith("tq-seed-"));
    if (cleaned.length !== all.length) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (_e) {
    return [];
  }
};

export const setLocalTheoryQuestions = (questions: TheoryQuestion[]): void => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(questions));
  } catch (_e) {}
};

// ─── REPOSITORY OPERATIONS ────────────────────────────────────────────────────

/**
 * Fetch questions by subject or all questions
 */
export const getTheoryQuestions = async (
  subjectFilter?: string,
  marksFilter?: number | null
): Promise<TheoryQuestion[]> => {
  let list = getLocalTheoryQuestions();

  if (isSupabaseConfigured()) {
    try {
      let query = supabase.from("theory_question_bank").select("*");
      if (subjectFilter && subjectFilter !== "All") {
        query = query.ilike("subject", subjectFilter);
      }
      if (marksFilter !== undefined && marksFilter !== null) {
        query = query.eq("marks", marksFilter);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (!error && data && data.length > 0) {
        const mapped: TheoryQuestion[] = data.map((d: any) => ({
          id: d.id,
          subject: d.subject,
          subjectCode: d.subject_code,
          yearCohort: d.year_cohort,
          questionText: d.question_text,
          marks: d.marks,
          questionType: (d.question_type || "theory") as QuestionCategory,
          topic: d.topic,
          diagramUrl: d.diagram_url,
          subParts: d.sub_parts || [],
          options: d.options || [],
          sourceFileName: d.source_file,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }));
        // Merge with local list so user never loses offline creations
        const idMap = new Map<string, TheoryQuestion>();
        list.forEach((q) => idMap.set(q.id, q));
        mapped.forEach((q) => idMap.set(q.id, q));
        list = Array.from(idMap.values());
        setLocalTheoryQuestions(list);
      }
    } catch (_err) {
      // Fallback silently to local store
    }
  }

  // Filter local array
  if (subjectFilter && subjectFilter !== "All") {
    list = list.filter((q) => q.subject.toLowerCase() === subjectFilter.toLowerCase());
  }
  if (marksFilter !== undefined && marksFilter !== null) {
    list = list.filter((q) => Number(q.marks) === Number(marksFilter));
  }

  return list;
};

/**
 * Save a batch of questions (e.g. from PDF extraction or manual entry)
 */
export const saveTheoryQuestionsBatch = async (
  newQuestions: Array<Omit<TheoryQuestion, "id" | "createdAt" | "updatedAt"> & { id?: string }>
): Promise<TheoryQuestion[]> => {
  const current = getLocalTheoryQuestions();
  const created: TheoryQuestion[] = [];

  for (const q of newQuestions) {
    const item: TheoryQuestion = {
      id: q.id || crypto.randomUUID(),
      subject: q.subject.trim() || "General Academic",
      subjectCode: q.subjectCode?.trim() || "",
      yearCohort: q.yearCohort || "All",
      questionText: q.questionText.trim(),
      marks: q.marks !== undefined && q.marks !== null && !isNaN(Number(q.marks)) ? Number(q.marks) : null,
      questionType: q.questionType || "theory",
      topic: q.topic?.trim() || "",
      diagramUrl: q.diagramUrl || "",
      subParts: q.subParts || [],
      options: q.options || [],
      sourceFileName: q.sourceFileName || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    created.push(item);
  }

  // Save to local store
  const merged = [...created, ...current.filter((c) => !created.some((n) => n.id === c.id))];
  setLocalTheoryQuestions(merged);

  // Sync to Supabase if available
  if (isSupabaseConfigured()) {
    try {
      const rows = created.map((item) => ({
        id: item.id,
        subject: item.subject,
        subject_code: item.subjectCode || null,
        year_cohort: item.yearCohort || "All",
        question_text: item.questionText,
        marks: item.marks,
        question_type: item.questionType,
        topic: item.topic || null,
        diagram_url: item.diagramUrl || null,
        sub_parts: item.subParts || [],
        options: item.options || [],
        source_file: item.sourceFileName || null,
      }));
      await supabase.from("theory_question_bank").upsert(rows);
    } catch (_err) {}
  }

  return created;
};

/**
 * Update an existing question
 */
export const updateTheoryQuestion = async (
  id: string,
  patch: Partial<TheoryQuestion>
): Promise<TheoryQuestion | null> => {
  const list = getLocalTheoryQuestions();
  const index = list.findIndex((q) => q.id === id);
  if (index === -1) return null;

  const updated: TheoryQuestion = {
    ...list[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  list[index] = updated;
  setLocalTheoryQuestions(list);

  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from("theory_question_bank")
        .update({
          subject: updated.subject,
          subject_code: updated.subjectCode || null,
          year_cohort: updated.yearCohort,
          question_text: updated.questionText,
          marks: updated.marks,
          question_type: updated.questionType,
          topic: updated.topic || null,
          diagram_url: updated.diagramUrl || null,
          sub_parts: updated.subParts || [],
          options: updated.options || [],
          updated_at: updated.updatedAt,
        })
        .eq("id", id);
    } catch (_e) {}
  }

  return updated;
};

/**
 * Delete a question by ID
 */
export const deleteTheoryQuestion = async (id: string): Promise<boolean> => {
  const list = getLocalTheoryQuestions();
  const filtered = list.filter((q) => q.id !== id);
  setLocalTheoryQuestions(filtered);

  if (isSupabaseConfigured()) {
    try {
      await supabase.from("theory_question_bank").delete().eq("id", id);
    } catch (_e) {}
  }

  return true;
};

/**
 * Get distinct subjects in the question bank
 */
export const getDistinctSubjects = (questions: TheoryQuestion[]): string[] => {
  const subjects = new Set<string>();
  questions.forEach((q) => {
    if (q.subject && q.subject.trim()) {
      subjects.add(q.subject.trim());
    }
  });
  return Array.from(subjects).sort();
};

/**
 * Random Examination Paper Synthesizer
 * Uses Fisher-Yates shuffle to pick N random questions matching criteria
 */
export interface ExamPaperGenerationParams {
  subject: string;
  questionCount: number;
  marksFilter?: number | null; // e.g. only 2-mark questions or null for all
  yearCohort?: string;
  excludeIds?: string[];
}

export const generateRandomExamPaper = (
  allQuestions: TheoryQuestion[],
  params: ExamPaperGenerationParams
): { selected: TheoryQuestion[]; poolRemaining: TheoryQuestion[] } => {
  let pool = allQuestions.filter((q) => {
    if (params.subject && params.subject !== "All" && q.subject.toLowerCase() !== params.subject.toLowerCase()) {
      return false;
    }
    if (params.yearCohort && params.yearCohort !== "All" && q.yearCohort !== "All" && q.yearCohort !== params.yearCohort) {
      return false;
    }
    if (params.marksFilter !== undefined && params.marksFilter !== null) {
      if (Number(q.marks) !== Number(params.marksFilter)) return false;
    }
    if (params.excludeIds && params.excludeIds.includes(q.id)) {
      return false;
    }
    return true;
  });

  // Fisher-Yates shuffle
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const count = Math.min(params.questionCount, shuffled.length);
  const selected = shuffled.slice(0, count);
  const poolRemaining = shuffled.slice(count);

  return { selected, poolRemaining };
};

