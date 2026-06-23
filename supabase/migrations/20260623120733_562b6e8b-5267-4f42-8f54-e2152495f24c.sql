
-- 1. Add grouping columns
ALTER TABLE public.notificacoes
  ADD COLUMN IF NOT EXISTS group_key text,
  ADD COLUMN IF NOT EXISTS count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_notificacoes_group
  ON public.notificacoes(recipient_auth_id, group_key, lida);

-- 2. notificar_staff with grouping (upsert-like behavior on unread rows)
CREATE OR REPLACE FUNCTION public.notificar_staff(
  p_tipo text,
  p_titulo text,
  p_descricao text DEFAULT NULL,
  p_link text DEFAULT NULL,
  p_group_key text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_updated int;
BEGIN
  FOR r IN
    SELECT DISTINCT p.auth_user_id
      FROM public.pessoas p
      LEFT JOIN public.tipos_user tu ON tu.id = p.tipo_user_id
     WHERE p.auth_user_id IS NOT NULL
       AND p.status = 'ativo'
       AND (p.is_admin = true OR lower(COALESCE(tu.nome,'')) = 'equipa')
  LOOP
    IF p_group_key IS NOT NULL THEN
      UPDATE public.notificacoes
         SET count = count + 1,
             titulo = p_titulo,
             descricao = p_descricao,
             link = COALESCE(p_link, link),
             updated_at = now(),
             created_at = now()
       WHERE recipient_auth_id = r.auth_user_id
         AND group_key = p_group_key
         AND lida = false;
      GET DIAGNOSTICS v_updated = ROW_COUNT;
      IF v_updated = 0 THEN
        INSERT INTO public.notificacoes (recipient_auth_id, tipo, titulo, descricao, link, group_key)
        VALUES (r.auth_user_id, p_tipo, p_titulo, p_descricao, p_link, p_group_key);
      END IF;
    ELSE
      INSERT INTO public.notificacoes (recipient_auth_id, tipo, titulo, descricao, link)
      VALUES (r.auth_user_id, p_tipo, p_titulo, p_descricao, p_link);
    END IF;
  END LOOP;
END;
$$;

-- 3. nova_inscricao → group by FAMILY
CREATE OR REPLACE FUNCTION public.notif_nova_inscricao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pessoa text;
  v_acao text;
  v_familia_id uuid;
  v_familia text;
  v_group text;
BEGIN
  SELECT nome_completo, familia_id INTO v_pessoa, v_familia_id
    FROM public.pessoas WHERE id = NEW.pessoa_id;
  SELECT nome INTO v_acao FROM public.acoes WHERE id = NEW.acao_id;
  IF v_familia_id IS NOT NULL THEN
    SELECT nome INTO v_familia FROM public.familias WHERE id = v_familia_id;
    v_group := 'inscricao:familia:' || v_familia_id::text;
  ELSE
    v_familia := COALESCE(v_pessoa,'Alguém');
    v_group := 'inscricao:pessoa:' || NEW.pessoa_id::text;
  END IF;
  PERFORM public.notificar_staff(
    'nova_inscricao',
    'Inscrições — ' || COALESCE(v_familia, 'família'),
    COALESCE(v_pessoa,'Alguém') || ' em ' || COALESCE(v_acao,'evento'),
    '/participantes',
    v_group
  );
  RETURN NEW;
END $$;

-- 4. inscricao_status → group by EVENT (ação)
CREATE OR REPLACE FUNCTION public.notif_inscricao_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pessoa text;
  v_acao text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT nome_completo INTO v_pessoa FROM public.pessoas WHERE id = NEW.pessoa_id;
    SELECT nome INTO v_acao FROM public.acoes WHERE id = NEW.acao_id;
    PERFORM public.notificar_staff(
      'inscricao_status',
      'Alterações em ' || COALESCE(v_acao,'evento'),
      COALESCE(v_pessoa,'Alguém') || ': ' || NEW.status::text,
      '/participantes',
      'inscricao_status:acao:' || NEW.acao_id::text
    );
  END IF;
  RETURN NEW;
END $$;

-- 5. Group other notifications by type
CREATE OR REPLACE FUNCTION public.notif_nova_pessoa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'ativo' THEN
    PERFORM public.notificar_staff(
      'nova_pessoa',
      'Novos utilizadores registados',
      COALESCE(NEW.nome_completo, NEW.email, 'Sem nome'),
      '/participantes',
      'nova_pessoa'
    );
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.notif_nova_acao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notificar_staff(
    'nova_acao',
    'Novos ' || COALESCE(NEW.tipo, 'evento') || 's criados',
    NEW.nome,
    '/acoes',
    'nova_acao:' || COALESCE(NEW.tipo, 'evento')
  );
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.notif_novo_curriculo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pessoa text;
BEGIN
  SELECT nome_completo INTO v_pessoa FROM public.pessoas WHERE id = NEW.pessoa_id;
  PERFORM public.notificar_staff(
    'novo_curriculo',
    'Novos currículos submetidos',
    COALESCE(v_pessoa,'Alguém'),
    '/curriculos',
    'novo_curriculo'
  );
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.notif_nova_familia_atividade()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fam text; v_at text;
BEGIN
  SELECT nome INTO v_fam FROM public.familias WHERE id = NEW.familia_id;
  SELECT nome INTO v_at FROM public.atividades_catalogo WHERE id = NEW.atividade_id;
  PERFORM public.notificar_staff(
    'nova_atividade',
    'Atividades — ' || COALESCE(v_fam,'família'),
    COALESCE(v_at,'atividade'),
    '/familias',
    'familia_atividade:' || NEW.familia_id::text
  );
  RETURN NEW;
END $$;
