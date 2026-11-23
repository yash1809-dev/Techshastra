-- Leaders & Directors table for the About page section
CREATE TABLE IF NOT EXISTS public.leaders_directors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  photo_url TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_leaders_directors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leaders_directors_updated_at ON public.leaders_directors;
CREATE TRIGGER leaders_directors_updated_at
  BEFORE UPDATE ON public.leaders_directors
  FOR EACH ROW EXECUTE FUNCTION update_leaders_directors_updated_at();

-- RLS
ALTER TABLE public.leaders_directors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active leaders" ON public.leaders_directors;
CREATE POLICY "Public can read active leaders"
  ON public.leaders_directors FOR SELECT
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "Anyone can manage leaders" ON public.leaders_directors;
CREATE POLICY "Anyone can manage leaders"
  ON public.leaders_directors FOR ALL
  USING (true) WITH CHECK (true);
