ALTER TABLE public.acoes
  ADD COLUMN IF NOT EXISTS imagem_url text,
  ADD COLUMN IF NOT EXISTS mapa_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('acoes-imagens', 'acoes-imagens', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "acoes_imagens_public_read" ON storage.objects;
CREATE POLICY "acoes_imagens_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'acoes-imagens');

DROP POLICY IF EXISTS "acoes_imagens_admin_insert" ON storage.objects;
CREATE POLICY "acoes_imagens_admin_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'acoes-imagens' AND public.is_current_user_admin());

DROP POLICY IF EXISTS "acoes_imagens_admin_update" ON storage.objects;
CREATE POLICY "acoes_imagens_admin_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'acoes-imagens' AND public.is_current_user_admin());

DROP POLICY IF EXISTS "acoes_imagens_admin_delete" ON storage.objects;
CREATE POLICY "acoes_imagens_admin_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'acoes-imagens' AND public.is_current_user_admin());