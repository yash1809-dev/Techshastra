-- ====================================================================
-- Leaderboard & Cloud Sync Tables: Typing Records & Problem Submissions
-- Allows real-time inter-college leaderboards visible to all students
-- ====================================================================

-- 1. Student Typing Records Table
CREATE TABLE IF NOT EXISTS public.student_typing_records (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL DEFAULT 'Student',
  github_username TEXT NOT NULL DEFAULT '',
  college TEXT NOT NULL DEFAULT 'UTU Sudhowala (Main Campus)',
  wpm INTEGER NOT NULL DEFAULT 0,
  accuracy INTEGER NOT NULL DEFAULT 100,
  errors INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 30,
  mode TEXT NOT NULL DEFAULT 'code',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Student Problem Submissions Table
CREATE TABLE IF NOT EXISTS public.student_problem_submissions (
  id TEXT PRIMARY KEY,
  problem_id TEXT NOT NULL,
  problem_title TEXT NOT NULL DEFAULT 'Problem',
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL DEFAULT 'Student',
  github_username TEXT NOT NULL DEFAULT '',
  college TEXT NOT NULL DEFAULT 'UTU Sudhowala (Main Campus)',
  language TEXT NOT NULL DEFAULT 'python',
  code TEXT,
  status TEXT NOT NULL DEFAULT 'Accepted',
  passed_test_cases INTEGER NOT NULL DEFAULT 0,
  total_test_cases INTEGER NOT NULL DEFAULT 0,
  runtime_ms INTEGER NOT NULL DEFAULT 0,
  score_awarded INTEGER NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Enable Row Level Security
ALTER TABLE public.student_typing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_problem_submissions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for student_typing_records
DROP POLICY IF EXISTS "Public can view student typing records" ON public.student_typing_records;
CREATE POLICY "Public can view student typing records"
  ON public.student_typing_records FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can insert student typing records" ON public.student_typing_records;
CREATE POLICY "Anyone can insert student typing records"
  ON public.student_typing_records FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update student typing records" ON public.student_typing_records;
CREATE POLICY "Anyone can update student typing records"
  ON public.student_typing_records FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 5. RLS Policies for student_problem_submissions
DROP POLICY IF EXISTS "Public can view student problem submissions" ON public.student_problem_submissions;
CREATE POLICY "Public can view student problem submissions"
  ON public.student_problem_submissions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can insert student problem submissions" ON public.student_problem_submissions;
CREATE POLICY "Anyone can insert student problem submissions"
  ON public.student_problem_submissions FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update student problem submissions" ON public.student_problem_submissions;
CREATE POLICY "Anyone can update student problem submissions"
  ON public.student_problem_submissions FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 6. Indexes for fast leaderboard querying and duration filtering
CREATE INDEX IF NOT EXISTS idx_typing_records_duration_wpm ON public.student_typing_records (duration_seconds, wpm DESC);
CREATE INDEX IF NOT EXISTS idx_typing_records_github ON public.student_typing_records (github_username);
CREATE INDEX IF NOT EXISTS idx_problem_subs_github ON public.student_problem_submissions (github_username);
CREATE INDEX IF NOT EXISTS idx_problem_subs_problem_id ON public.student_problem_submissions (problem_id);
