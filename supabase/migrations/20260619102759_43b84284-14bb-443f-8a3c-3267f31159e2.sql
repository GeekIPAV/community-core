
-- 1) Tighten acoes SELECT policy for authenticated users
DROP POLICY IF EXISTS acoes_select_authenticated ON public.acoes;
CREATE POLICY acoes_select_authenticated ON public.acoes
  FOR SELECT TO authenticated
  USING (
    publico = true
    OR public.is_current_user_staff()
  );

-- 2) Harden inscrever_publico (both overloads) with event access guards
CREATE OR REPLACE FUNCTION public.inscrever_publico(
  p_acao_id uuid,
  p_nome text,
  p_email text DEFAULT NULL::text,
  p_nif text DEFAULT NULL::text,
  p_data_nascimento date DEFAULT NULL::date,
  p_telefone text DEFAULT NULL::text,
  p_valores jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_acao public.acoes;
  v_pessoa_id uuid;
  v_inscricao_id uuid;
BEGIN
  IF p_nome IS NULL OR length(trim(p_nome)) = 0 THEN
    RAISE EXCEPTION 'Nome obrigatório';
  END IF;

  SELECT * INTO v_acao FROM public.acoes WHERE id = p_acao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ação não encontrada';
  END IF;
  IF NOT COALESCE(v_acao.publico, false) THEN
    RAISE EXCEPTION 'Ação não disponível para inscrição pública';
  END IF;
  IF NOT COALESCE(v_acao.inscricoes_abertas, false) THEN
    RAISE EXCEPTION 'Inscrições encerradas';
  END IF;
  IF COALESCE(v_acao.restrito_a_projetos, false) AND auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Ação restrita — autenticação obrigatória';
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.inscrever_publico(
  p_acao_id uuid,
  p_nome text,
  p_email text DEFAULT NULL::text,
  p_nif text DEFAULT NULL::text,
  p_data_nascimento date DEFAULT NULL::date,
  p_telefone text DEFAULT NULL::text,
  p_valores jsonb DEFAULT '{}'::jsonb,
  p_atualizar boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_acao public.acoes;
  v_pessoa_id uuid;
  v_inscricao_id uuid;
  v_ja_inscrito boolean := false;
BEGIN
  IF p_nome IS NULL OR length(trim(p_nome)) = 0 THEN
    RAISE EXCEPTION 'Nome obrigatório';
  END IF;

  SELECT * INTO v_acao FROM public.acoes WHERE id = p_acao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ação não encontrada';
  END IF;
  IF NOT COALESCE(v_acao.publico, false) THEN
    RAISE EXCEPTION 'Ação não disponível para inscrição pública';
  END IF;
  IF NOT COALESCE(v_acao.inscricoes_abertas, false) THEN
    RAISE EXCEPTION 'Inscrições encerradas';
  END IF;
  IF COALESCE(v_acao.restrito_a_projetos, false) AND auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Ação restrita — autenticação obrigatória';
  END IF;

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

  SELECT id INTO v_inscricao_id
    FROM public.inscricoes
   WHERE pessoa_id = v_pessoa_id
     AND acao_id = p_acao_id
     AND status <> 'cancelada'
   LIMIT 1;

  IF v_inscricao_id IS NOT NULL THEN
    v_ja_inscrito := true;
    IF p_atualizar THEN
      UPDATE public.inscricoes
         SET valores_dinamicos = COALESCE(p_valores, '{}'::jsonb)
       WHERE id = v_inscricao_id;
    END IF;
  ELSE
    INSERT INTO public.inscricoes (pessoa_id, acao_id, valores_dinamicos)
    VALUES (v_pessoa_id, p_acao_id, COALESCE(p_valores, '{}'::jsonb))
    RETURNING id INTO v_inscricao_id;
  END IF;

  RETURN jsonb_build_object(
    'inscricao_id', v_inscricao_id,
    'ja_inscrito', v_ja_inscrito,
    'atualizado', v_ja_inscrito AND p_atualizar
  );
END;
$function$;
