-- ====================================================================
-- Migration: TechShastra Hierarchy & Role Applications
-- Created: 2026-11-20
--
-- Creates optional Supabase backup tables for:
--   1. role_applications — student role applications (backed up from localStorage)
--   2. promoted_members  — promoted member records (audit log)
--
-- NOTE: The primary data store for hierarchy is localStorage (ts_promoted_members,
-- ts_role_applications, ts_akv). These tables are BACKUP/AUDIT only.
-- Admin keys are NEVER stored in Supabase — they live in the obfuscated vault
-- (ts_akv) on the client side only.
-- ====================================================================

-- ─── 1. ROLE APPLICATIONS TABLE ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.role_applications (
  id                TEXT PRIMARY KEY,
  student_id        TEXT NOT NULL,
  student_name      TEXT NOT NULL,
  student_email     TEXT,
  github_username   TEXT NOT NULL,
  academic_year     TEXT NOT NULL,
  course            TEXT,
  applied_role      TEXT NOT NULL,
  applied_wing      TEXT,
  statement         TEXT,
  skills            TEXT,            -- comma-separated
  portfolio_url     TEXT,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'declined')),
  reviewed_by       TEXT,
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_role_applications_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_role_applications_updated_at ON public.role_applications;
CREATE TRIGGER trg_role_applications_updated_at
  BEFORE UPDATE ON public.role_applications
  FOR EACH ROW EXECUTE FUNCTION update_role_applications_updated_at();

-- ─── 2. PROMOTED MEMBERS TABLE (audit log) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.promoted_members (
  id                TEXT PRIMARY KEY,
  student_id        TEXT NOT NULL,
  name              TEXT NOT NULL,
  email             TEXT,
  github_username   TEXT NOT NULL,
  academic_year     TEXT NOT NULL,
  course            TEXT,
  role              TEXT NOT NULL,
  role_title        TEXT NOT NULL,
  tier              INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 3),
  wing              TEXT,
  has_admin_key     BOOLEAN NOT NULL DEFAULT FALSE,  -- boolean only, NEVER store key value
  promoted_by       TEXT NOT NULL,
  promoted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  demoted_at        TIMESTAMPTZ,                      -- set when demoted
  is_active         BOOLEAN NOT NULL DEFAULT TRUE
);

-- ─── 3. ROW LEVEL SECURITY ──────────────────────────────────────────────────

ALTER TABLE public.role_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promoted_members  ENABLE ROW LEVEL SECURITY;

-- Students can INSERT their own applications (anon allowed for student portal)
CREATE POLICY "students_insert_own_application"
  ON public.role_applications FOR INSERT
  WITH CHECK (true);  -- Auth is handled by student session at app level

-- Only admins can read applications (guards sensitive data in Supabase dashboard)
CREATE POLICY "admins_read_applications"
  ON public.role_applications FOR SELECT
  USING (is_admin_session());

-- Only admins can update (approve/decline) applications
CREATE POLICY "admins_update_applications"
  ON public.role_applications FOR UPDATE
  USING (is_admin_session())
  WITH CHECK (is_admin_session());

-- Only super admins can read promoted members audit log
CREATE POLICY "superadmin_read_promoted"
  ON public.promoted_members FOR SELECT
  USING (is_super_admin_session());

-- Only super admins can insert/update promoted members
CREATE POLICY "superadmin_manage_promoted"
  ON public.promoted_members FOR ALL
  USING (is_super_admin_session())
  WITH CHECK (is_super_admin_session());

-- ─── 4. INDEXES ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_role_apps_student_id  ON public.role_applications(student_id);
CREATE INDEX IF NOT EXISTS idx_role_apps_status       ON public.role_applications(status);
CREATE INDEX IF NOT EXISTS idx_promoted_student_id    ON public.promoted_members(student_id);
CREATE INDEX IF NOT EXISTS idx_promoted_active        ON public.promoted_members(is_active);
