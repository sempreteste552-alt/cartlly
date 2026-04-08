-- Allow anyone to upload review media to the reviews/ folder
CREATE POLICY "Anyone can upload review media"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = 'reviews'
);
