-- ====================================================================
-- Migration: Promoted Members Cross-Device Sync & Real-Time RLS
-- Created: 2026-11-21
--
-- Enables cross-device synchronization for promoted club leaders,
-- ensuring that promotions and leadership designations (President,
-- Functional Heads, Co-Heads) made on laptop appear instantly on
-- mobile and all other devices.
-- ====================================================================

-- 1. Ensure columns exist on public.promoted_members
ALTER TABLE public.promoted_members ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE public.promoted_members ADD COLUMN IF NOT EXISTS admin_key TEXT;

-- 2. Open SELECT so that any visitor or student on mobile/laptop can see promoted leaders
ALTER TABLE public.promoted_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin_read_promoted" ON public.promoted_members;
DROP POLICY IF EXISTS "anyone_read_promoted" ON public.promoted_members;
CREATE POLICY "anyone_read_promoted"
  ON public.promoted_members FOR SELECT
  USING (true);

-- 3. Allow inserting / updating promoted members from app promotion workflows
DROP POLICY IF EXISTS "superadmin_manage_promoted" ON public.promoted_members;
DROP POLICY IF EXISTS "anyone_manage_promoted" ON public.promoted_members;
CREATE POLICY "anyone_manage_promoted"
  ON public.promoted_members FOR ALL
  USING (true)
  WITH CHECK (true);
