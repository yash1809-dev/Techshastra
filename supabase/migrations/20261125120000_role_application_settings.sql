-- ====================================================================
-- Role Application Settings: Deadline Clock & Status Control
-- Allows SuperAdmin to set application closure deadlines with live countdown
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.role_application_settings (
  id TEXT PRIMARY KEY DEFAULT 'current',
  deadline_at TIMESTAMPTZ,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed current default record if not present
INSERT INTO public.role_application_settings (id, deadline_at, is_enabled)
VALUES ('current', NULL, true)
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE public.role_application_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view role_application_settings" ON public.role_application_settings;
CREATE POLICY "Public can view role_application_settings"
  ON public.role_application_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can update role_application_settings" ON public.role_application_settings;
CREATE POLICY "Anyone can update role_application_settings"
  ON public.role_application_settings FOR ALL
  USING (true)
  WITH CHECK (true);
