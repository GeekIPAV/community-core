
-- 1. New columns on pessoas
ALTER TABLE public.pessoas
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_pessoas_auth_user_id ON public.pessoas(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_pessoas_email_lower ON public.pessoas(lower(email));

-- 2. Helper functions (SECURITY DEFINER, STABLE) to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.current_user_pessoa_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.pessoas
   WHERE auth_user_id = auth.uid()
      OR (auth.jwt() ->> 'email') IS NOT NULL
         AND lower(email) = lower(auth.jwt() ->> 'email')
   ORDER BY (auth_user_id = auth.uid()) DESC NULLS LAST
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_familia_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT familia_id FROM public.pessoas
   WHERE id = public.current_user_pessoa_id();
$$;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.pessoas WHERE id = public.current_user_pessoa_id()),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_pessoa_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_familia_id() TO anon, authenticated;

-- 3. Public RPC for anonymous/public sign-ups
CREATE OR REPLACE FUNCTION public.inscrever_publico(
  p_acao_id uuid,
  p_nome text,
  p_email text DEFAULT NULL,
  p_nif text DEFAULT NULL,
  p_data_nascimento date DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_valores jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pessoa_id uuid;
  v_inscricao_id uuid;
BEGIN
  IF p_nome IS NULL OR length(trim(p_nome)) = 0 THEN
    RAISE EXCEPTION 'Nome obrigatório';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.acoes WHERE id = p_acao_id) THEN
    RAISE EXCEPTION 'Ação não encontrada';
  END IF;

  -- Try to find an existing active person by email
  IF p_email IS NOT NULL AND length(trim(p_email)) > 0 THEN
    SELECT id INTO v_pessoa_id
      FROM public.pessoas
     WHERE status = 'ativo'
       AND email IS NOT NULL
       AND lower(email) = lower(p_email)
     LIMIT 1;
  END IF;

  IF v_pessoa_id IS NULL THEN
    INSERT INTO public.pessoas (nome_completo, email, nif, data_nascimento, telefone)
    VALUES (trim(p_nome), nullif(trim(p_email),''), nullif(trim(p_nif),''), p_data_nascimento, nullif(trim(p_telefone),''))
    RETURNING id INTO v_pessoa_id;
  END IF;

  -- Avoid duplicate active enrollment
  SELECT id INTO v_inscricao_id
    FROM public.inscricoes
   WHERE pessoa_id = v_pessoa_id
     AND acao_id = p_acao_id
     AND status <> 'cancelada'
   LIMIT 1;

  IF v_inscricao_id IS NULL THEN
    INSERT INTO public.inscricoes (pessoa_id, acao_id, valores_dinamicos)
    VALUES (v_pessoa_id, p_acao_id, COALESCE(p_valores, '{}'::jsonb))
    RETURNING id INTO v_inscricao_id;
  END IF;

  RETURN v_inscricao_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.inscrever_publico(uuid, text, text, text, date, text, jsonb) TO anon, authenticated;

-- 4. Reset and rewrite RLS policies
-- acoes
DROP POLICY IF EXISTS authenticated_all_acoes ON public.acoes;
GRANT SELECT ON public.acoes TO anon;
CREATE POLICY acoes_select_all ON public.acoes
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY acoes_admin_write ON public.acoes
  FOR ALL TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- pessoas
DROP POLICY IF EXISTS authenticated_all_pessoas ON public.pessoas;
CREATE POLICY pessoas_admin_all ON public.pessoas
  FOR ALL TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());
CREATE POLICY pessoas_self_select ON public.pessoas
  FOR SELECT TO authenticated
  USING (
    id = public.current_user_pessoa_id()
    OR (familia_id IS NOT NULL AND familia_id = public.current_user_familia_id())
  );
-- Allow a logged user to set their own auth_user_id link (silent UPDATE from frontend)
CREATE POLICY pessoas_self_link ON public.pessoas
  FOR UPDATE TO authenticated
  USING (
    auth_user_id IS NULL
    AND (auth.jwt() ->> 'email') IS NOT NULL
    AND lower(email) = lower(auth.jwt() ->> 'email')
  )
  WITH CHECK (
    auth_user_id = auth.uid()
    AND lower(email) = lower(auth.jwt() ->> 'email')
  );

-- familias
DROP POLICY IF EXISTS authenticated_all_familias ON public.familias;
CREATE POLICY familias_admin_all ON public.familias
  FOR ALL TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());
CREATE POLICY familias_self_select ON public.familias
  FOR SELECT TO authenticated
  USING (id = public.current_user_familia_id());

-- inscricoes
DROP POLICY IF EXISTS authenticated_all_inscricoes ON public.inscricoes;
CREATE POLICY inscricoes_admin_all ON public.inscricoes
  FOR ALL TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());
CREATE POLICY inscricoes_self_select ON public.inscricoes
  FOR SELECT TO authenticated
  USING (
    pessoa_id = public.current_user_pessoa_id()
    OR pessoa_id IN (
      SELECT id FROM public.pessoas
       WHERE familia_id IS NOT NULL
         AND familia_id = public.current_user_familia_id()
    )
  );
-- Logged-in users may also create enrollments for themselves/family (UI offers checkbox flow);
-- inscrever_publico (SECURITY DEFINER) handles the anon case.
CREATE POLICY inscricoes_self_insert ON public.inscricoes
  FOR INSERT TO authenticated
  WITH CHECK (
    pessoa_id = public.current_user_pessoa_id()
    OR pessoa_id IN (
      SELECT id FROM public.pessoas
       WHERE familia_id IS NOT NULL
         AND familia_id = public.current_user_familia_id()
    )
  );
