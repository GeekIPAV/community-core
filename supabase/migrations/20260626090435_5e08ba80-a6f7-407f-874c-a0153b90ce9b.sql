
-- ============== TABLES ==============

CREATE TABLE public.casos_apoio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text UNIQUE,
  pessoa_id uuid NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
  familia_id uuid REFERENCES public.familias(id) ON DELETE SET NULL,
  mediadora_id uuid REFERENCES public.pessoas(id) ON DELETE SET NULL,
  area text NOT NULL,
  titulo text NOT NULL,
  descricao text,
  estado text NOT NULL DEFAULT 'Novo',
  prioridade text NOT NULL DEFAULT 'Normal',
  origem text NOT NULL,
  objetivo text,
  resultado_final text,
  data_abertura date NOT NULL DEFAULT CURRENT_DATE,
  data_conclusao date,
  data_prevista_conclusao date,
  created_by_auth_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.casos_apoio TO authenticated;
GRANT ALL ON public.casos_apoio TO service_role;
ALTER TABLE public.casos_apoio ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.caso_registos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id uuid NOT NULL REFERENCES public.casos_apoio(id) ON DELETE CASCADE,
  autor_id uuid REFERENCES public.pessoas(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  titulo text,
  conteudo text NOT NULL,
  visivel_para_pessoa boolean NOT NULL DEFAULT false,
  estado_anterior text,
  estado_novo text,
  data timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.caso_registos TO authenticated;
GRANT ALL ON public.caso_registos TO service_role;
ALTER TABLE public.caso_registos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.caso_objetivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id uuid NOT NULL REFERENCES public.casos_apoio(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  estado text NOT NULL DEFAULT 'Por iniciar',
  prazo date,
  notas text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.caso_objetivos TO authenticated;
GRANT ALL ON public.caso_objetivos TO service_role;
ALTER TABLE public.caso_objetivos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.caso_transferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id uuid NOT NULL REFERENCES public.casos_apoio(id) ON DELETE CASCADE,
  mediadora_saida_id uuid REFERENCES public.pessoas(id) ON DELETE SET NULL,
  mediadora_entrada_id uuid REFERENCES public.pessoas(id) ON DELETE SET NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  motivo text,
  notas_transicao text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.caso_transferencias TO authenticated;
GRANT ALL ON public.caso_transferencias TO service_role;
ALTER TABLE public.caso_transferencias ENABLE ROW LEVEL SECURITY;

-- ============== INDEXES ==============
CREATE INDEX idx_casos_apoio_pessoa ON public.casos_apoio(pessoa_id);
CREATE INDEX idx_casos_apoio_mediadora ON public.casos_apoio(mediadora_id);
CREATE INDEX idx_casos_apoio_estado ON public.casos_apoio(estado);
CREATE INDEX idx_caso_registos_caso ON public.caso_registos(caso_id, data DESC);
CREATE INDEX idx_caso_objetivos_caso ON public.caso_objetivos(caso_id, position);
CREATE INDEX idx_caso_transferencias_caso ON public.caso_transferencias(caso_id, data DESC);

-- ============== TRIGGERS ==============

CREATE TRIGGER trg_casos_apoio_updated_at
  BEFORE UPDATE ON public.casos_apoio
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-fill familia_id and generate numero
CREATE OR REPLACE FUNCTION public.casos_apoio_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int := EXTRACT(YEAR FROM COALESCE(NEW.data_abertura, CURRENT_DATE));
  v_seq int;
BEGIN
  IF NEW.familia_id IS NULL THEN
    SELECT familia_id INTO NEW.familia_id FROM public.pessoas WHERE id = NEW.pessoa_id;
  END IF;
  IF NEW.numero IS NULL THEN
    SELECT COALESCE(MAX(SUBSTRING(numero FROM '\d+$')::int), 0) + 1
      INTO v_seq
      FROM public.casos_apoio
      WHERE numero LIKE 'CASO-' || v_year || '-%';
    NEW.numero := 'CASO-' || v_year || '-' || LPAD(v_seq::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_casos_apoio_before_insert
  BEFORE INSERT ON public.casos_apoio
  FOR EACH ROW EXECUTE FUNCTION public.casos_apoio_before_insert();

-- When estado changes, log a 'Atualização de estado' registo automatically
CREATE OR REPLACE FUNCTION public.casos_apoio_log_estado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_autor uuid;
BEGIN
  IF OLD.estado IS DISTINCT FROM NEW.estado THEN
    SELECT id INTO v_autor FROM public.pessoas WHERE auth_user_id = auth.uid() LIMIT 1;
    INSERT INTO public.caso_registos (caso_id, autor_id, tipo, conteudo, visivel_para_pessoa, estado_anterior, estado_novo)
    VALUES (NEW.id, v_autor, 'Atualização de estado',
            'Estado alterado de "' || OLD.estado || '" para "' || NEW.estado || '"',
            true, OLD.estado, NEW.estado);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_casos_apoio_log_estado
  AFTER UPDATE OF estado ON public.casos_apoio
  FOR EACH ROW EXECUTE FUNCTION public.casos_apoio_log_estado();

-- Touch casos_apoio.updated_at when a registo is added
CREATE OR REPLACE FUNCTION public.caso_registos_touch_caso()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.casos_apoio SET updated_at = now() WHERE id = NEW.caso_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_caso_registos_touch
  AFTER INSERT ON public.caso_registos
  FOR EACH ROW EXECUTE FUNCTION public.caso_registos_touch_caso();

-- ============== RLS POLICIES ==============

-- casos_apoio
CREATE POLICY casos_staff_all ON public.casos_apoio
  FOR ALL TO authenticated
  USING (public.is_current_user_staff())
  WITH CHECK (public.is_current_user_staff());

CREATE POLICY casos_self_select ON public.casos_apoio
  FOR SELECT TO authenticated
  USING (pessoa_id = public.current_user_pessoa_id());

CREATE POLICY casos_self_insert ON public.casos_apoio
  FOR INSERT TO authenticated
  WITH CHECK (
    pessoa_id = public.current_user_pessoa_id()
    AND origem = 'Auto-pedido'
    AND created_by_auth_id = auth.uid()
  );

-- caso_registos
CREATE POLICY registos_staff_all ON public.caso_registos
  FOR ALL TO authenticated
  USING (public.is_current_user_staff())
  WITH CHECK (public.is_current_user_staff());

CREATE POLICY registos_self_select ON public.caso_registos
  FOR SELECT TO authenticated
  USING (
    visivel_para_pessoa = true
    AND EXISTS (
      SELECT 1 FROM public.casos_apoio c
      WHERE c.id = caso_registos.caso_id
        AND c.pessoa_id = public.current_user_pessoa_id()
    )
  );

CREATE POLICY registos_self_insert ON public.caso_registos
  FOR INSERT TO authenticated
  WITH CHECK (
    tipo = 'Resposta da pessoa'
    AND visivel_para_pessoa = true
    AND EXISTS (
      SELECT 1 FROM public.casos_apoio c
      WHERE c.id = caso_registos.caso_id
        AND c.pessoa_id = public.current_user_pessoa_id()
    )
  );

-- caso_objetivos: staff only
CREATE POLICY objetivos_staff_all ON public.caso_objetivos
  FOR ALL TO authenticated
  USING (public.is_current_user_staff())
  WITH CHECK (public.is_current_user_staff());

-- caso_transferencias: staff only
CREATE POLICY transferencias_staff_all ON public.caso_transferencias
  FOR ALL TO authenticated
  USING (public.is_current_user_staff())
  WITH CHECK (public.is_current_user_staff());

-- ============== RPCs ==============

CREATE OR REPLACE FUNCTION public.count_casos_novos()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.casos_apoio WHERE estado = 'Novo';
$$;

-- Notify a specific mediadora about case activity (used when pessoa responds)
CREATE OR REPLACE FUNCTION public.notificar_mediadora(
  p_mediadora_id uuid,
  p_tipo text,
  p_titulo text,
  p_descricao text DEFAULT NULL,
  p_link text DEFAULT NULL,
  p_group_key text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth uuid;
  v_updated int;
BEGIN
  SELECT auth_user_id INTO v_auth FROM public.pessoas WHERE id = p_mediadora_id AND auth_user_id IS NOT NULL;
  IF v_auth IS NULL THEN RETURN; END IF;

  IF p_group_key IS NOT NULL THEN
    UPDATE public.notificacoes
       SET count = count + 1,
           titulo = p_titulo,
           descricao = p_descricao,
           link = COALESCE(p_link, link),
           updated_at = now(),
           created_at = now()
     WHERE recipient_auth_id = v_auth
       AND group_key = p_group_key
       AND lida = false;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
      INSERT INTO public.notificacoes (recipient_auth_id, tipo, titulo, descricao, link, group_key)
      VALUES (v_auth, p_tipo, p_titulo, p_descricao, p_link, p_group_key);
    END IF;
  ELSE
    INSERT INTO public.notificacoes (recipient_auth_id, tipo, titulo, descricao, link)
    VALUES (v_auth, p_tipo, p_titulo, p_descricao, p_link);
  END IF;
END;
$$;

-- ============== SIDEBAR ENTRY ==============
INSERT INTO public.sidebar_items (group_id, key, label, url, icon, position, is_visible, visible_to, badge_query)
VALUES (
  '47014d29-3f5a-4d09-bae0-cea782238121',
  'casos',
  'Acompanhamento',
  '/casos',
  'FolderOpen',
  3,
  true,
  ARRAY['admin','staff'],
  'count_casos_novos'
);
