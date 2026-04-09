-- Fix: allow review image uploads (path starts with 'reviews/') for any authenticated user
-- The existing policy only allows paths starting with auth.uid(), which blocks review uploads

-- Drop and recreate INSERT policy for product-images to handle both cases
DROP POLICY IF EXISTS "Users can upload their own product images" ON storage.objects;

CREATE POLICY "Users can upload product images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (storage.foldername(name))[1] = 'reviews'
    )
  );

-- Also fix store-assets: allow logo uploads at root with user id prefix (already correct)
-- But also ensure upsert works by allowing UPDATE
DROP POLICY IF EXISTS "Users can update store assets" ON storage.objects;

CREATE POLICY "Users can update store assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'store-assets' AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Ensure DELETE policy exists for store-assets
DROP POLICY IF EXISTS "Users can delete store assets" ON storage.objects;

CREATE POLICY "Users can delete store assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'store-assets' AND (storage.foldername(name))[1] = auth.uid()::text
  );