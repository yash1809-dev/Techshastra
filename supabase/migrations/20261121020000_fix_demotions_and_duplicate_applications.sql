-- ====================================================================
-- Migration: Live Demotions & Duplicate Applications Prevention
-- Created: 2026-11-21
--
-- 1. Promoted Members Table:
--    Ensures avatar, admin_key, is_active, demoted_at columns exist.
--    Allows cross-platform SELECT, INSERT, UPDATE, DELETE for live demotions.
--
-- 2. Role Applications Table:
--    Allows cross-platform SELECT, INSERT, UPDATE so applications can be
--    tracked, declined, and verified in real-time across laptop and mobile.
-- ====================================================================

-- 1. Promoted Members columns
ALTER TABLE public.promoted_members ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE public.promoted_members ADD COLUMN IF NOT EXISTS admin_key TEXT;
ALTER TABLE public.promoted_members ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.promoted_members ADD COLUMN IF NOT EXISTS demoted_at TIMESTAMPTZ;

-- 2. Enable Row Level Security
ALTER TABLE public.promoted_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_applications ENABLE ROW LEVEL SECURITY;

-- 3. Promoted Members Policies (safe drop before creation)
DROP POLICY IF EXISTS "superadmin_read_promoted" ON public.promoted_members;
DROP POLICY IF EXISTS "anyone_read_promoted" ON public.promoted_members;
CREATE POLICY "anyone_read_promoted"
  ON public.promoted_members FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "superadmin_manage_promoted" ON public.promoted_members;
DROP POLICY IF EXISTS "anyone_manage_promoted" ON public.promoted_members;
CREATE POLICY "anyone_manage_promoted"
  ON public.promoted_members FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. Role Applications Policies (safe drop before creation)
DROP POLICY IF EXISTS "students_insert_own_application" ON public.role_applications;
DROP POLICY IF EXISTS "admins_read_applications" ON public.role_applications;
DROP POLICY IF EXISTS "admins_update_applications" ON public.role_applications;
DROP POLICY IF EXISTS "anyone_read_applications" ON public.role_applications;
DROP POLICY IF EXISTS "anyone_manage_applications" ON public.role_applications;

CREATE POLICY "anyone_read_applications"
  ON public.role_applications FOR SELECT
  USING (true);

CREATE POLICY "anyone_manage_applications"
  ON public.role_applications FOR ALL
  USING (true)
  WITH CHECK (true);
