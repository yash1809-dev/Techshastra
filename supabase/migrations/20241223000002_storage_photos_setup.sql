-- ====================================================================
-- Storage Buckets & RLS Setup for Dignitaries and Leaders Photos
-- ====================================================================

-- 1. Ensure buckets exist and are public
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('dignitaries-photos', 'dignitaries-photos', true),
  ('leaders-photos', 'leaders-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Public can view dignitaries photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload dignitaries photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update dignitaries photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete dignitaries photos" ON storage.objects;

DROP POLICY IF EXISTS "Public can view leaders photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload leaders photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update leaders photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete leaders photos" ON storage.objects;

-- 3. Dignitaries Storage Policies (storage.objects)
CREATE POLICY "Public can view dignitaries photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'dignitaries-photos');

CREATE POLICY "Anyone can upload dignitaries photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'dignitaries-photos');

CREATE POLICY "Anyone can update dignitaries photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'dignitaries-photos')
  WITH CHECK (bucket_id = 'dignitaries-photos');

CREATE POLICY "Anyone can delete dignitaries photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'dignitaries-photos');

-- 4. Leaders Storage Policies (storage.objects)
CREATE POLICY "Public can view leaders photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'leaders-photos');

CREATE POLICY "Anyone can upload leaders photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'leaders-photos');

CREATE POLICY "Anyone can update leaders photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'leaders-photos')
  WITH CHECK (bucket_id = 'leaders-photos');

CREATE POLICY "Anyone can delete leaders photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'leaders-photos');
