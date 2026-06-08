
-- Fix 1: Restrict INSERT on atividades_catalogo to staff/admin
DROP POLICY IF EXISTS atividades_catalogo_auth_insert ON public.atividades_catalogo;

-- Fix 2: Restrict dashboard_config SELECT to authenticated users only
DROP POLICY IF EXISTS dashboard_config_select_all ON public.dashboard_config;
CREATE POLICY dashboard_config_select_auth ON public.dashboard_config
  FOR SELECT TO authenticated USING (true);

-- Fix 3: Stop public listing of storage.objects for acoes-imagens bucket.
-- Public file URLs continue to work via the public CDN without this policy.
DROP POLICY IF EXISTS acoes_imagens_public_read ON storage.objects;
CREATE POLICY acoes_imagens_auth_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'acoes-imagens' AND is_current_user_staff());
