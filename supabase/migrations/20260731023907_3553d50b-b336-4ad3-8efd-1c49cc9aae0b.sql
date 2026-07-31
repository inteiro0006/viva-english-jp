-- Avatars: restrict uploads to image extensions inside the owner folder
DROP POLICY IF EXISTS "avatars_owner_write" ON storage.objects;
CREATE POLICY "avatars_owner_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp')
  );

DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp')
  );

-- Support attachments: restrict uploads to safe document/image extensions
DROP POLICY IF EXISTS "support_owner_write" ON storage.objects;
CREATE POLICY "support_owner_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'support-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) IN ('jpg','jpeg','png','pdf')
  );

-- Certificates: read-only for users/admins; no client-side writes at all
DROP POLICY IF EXISTS "certificates_no_client_write" ON storage.objects;
DROP POLICY IF EXISTS "certificates_no_client_update" ON storage.objects;
DROP POLICY IF EXISTS "certificates_no_client_delete" ON storage.objects;
