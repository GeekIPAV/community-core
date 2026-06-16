
DROP POLICY IF EXISTS "acoes_imagens_staff_insert" ON storage.objects;
CREATE POLICY "acoes_imagens_staff_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'acoes-imagens' AND public.is_current_user_staff());

DROP POLICY IF EXISTS "acoes_imagens_staff_update" ON storage.objects;
CREATE POLICY "acoes_imagens_staff_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'acoes-imagens' AND public.is_current_user_staff());

DROP POLICY IF EXISTS "acoes_imagens_staff_delete" ON storage.objects;
CREATE POLICY "acoes_imagens_staff_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'acoes-imagens' AND public.is_current_user_staff());
