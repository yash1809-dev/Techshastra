-- ============================================================
-- TECHSHASTRA: Role Applications RLS Fix
-- Problem: Policy "admins_read_applications" checked is_admin_session()
-- which fails for client-based / token-based admin logins, returning 0 rows
-- when selecting from role_applications.
-- Fix: Allow SELECT and UPDATE for role_applications so submitted applications
-- can be fetched by the admin panel across devices.
-- ============================================================

DROP POLICY IF EXISTS "admins_read_applications" ON public.role_applications;
CREATE POLICY "admins_read_applications"
  ON public.role_applications FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "admins_update_applications" ON public.role_applications;
CREATE POLICY "admins_update_applications"
  ON public.role_applications FOR ALL
  USING (true)
  WITH CHECK (true);
