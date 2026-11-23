-- Dignitaries table: Esteemed Leadership (Governor, CM, VC) + Directors section
CREATE TABLE IF NOT EXISTS public.dignitaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section TEXT NOT NULL CHECK (section IN ('leadership', 'directors')),
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  institute TEXT,
  message TEXT,
  photo_url TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_dignitaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dignitaries_updated_at ON public.dignitaries;
CREATE TRIGGER dignitaries_updated_at
  BEFORE UPDATE ON public.dignitaries
  FOR EACH ROW EXECUTE FUNCTION update_dignitaries_updated_at();

ALTER TABLE public.dignitaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active dignitaries" ON public.dignitaries;
CREATE POLICY "Public can read active dignitaries"
  ON public.dignitaries FOR SELECT
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "Anyone can manage dignitaries" ON public.dignitaries;
CREATE POLICY "Anyone can manage dignitaries"
  ON public.dignitaries FOR ALL
  USING (true) WITH CHECK (true);
