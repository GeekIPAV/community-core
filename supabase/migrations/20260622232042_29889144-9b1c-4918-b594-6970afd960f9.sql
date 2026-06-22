
-- ============================================================
-- 1. PROJETO KPIs
-- ============================================================
CREATE TABLE public.projeto_kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  meta numeric NOT NULL DEFAULT 0,
  unidade text NOT NULL DEFAULT '',
  fonte text NOT NULL CHECK (fonte IN ('acoes','atividades','participantes','manual')),
  narrativa text,
  valor_manual numeric,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_projeto_kpis_projeto ON public.projeto_kpis(projeto_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_kpis TO authenticated;
GRANT ALL ON public.projeto_kpis TO service_role;

ALTER TABLE public.projeto_kpis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projeto_kpis_select_auth" ON public.projeto_kpis
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "projeto_kpis_staff_write" ON public.projeto_kpis
  FOR ALL TO authenticated
  USING (public.is_current_user_staff())
  WITH CHECK (public.is_current_user_staff());

CREATE TRIGGER projeto_kpis_set_updated_at BEFORE UPDATE ON public.projeto_kpis
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2. PARCEIROS
-- ============================================================
CREATE TABLE public.parceiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text,
  estado text NOT NULL DEFAULT 'Ativa',
  pessoa_contacto text,
  email_contacto text,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parceiros TO authenticated;
GRANT ALL ON public.parceiros TO service_role;
ALTER TABLE public.parceiros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parceiros_select_auth" ON public.parceiros FOR SELECT TO authenticated USING (true);
CREATE POLICY "parceiros_staff_write" ON public.parceiros FOR ALL TO authenticated
  USING (public.is_current_user_staff()) WITH CHECK (public.is_current_user_staff());
CREATE TRIGGER parceiros_set_updated_at BEFORE UPDATE ON public.parceiros
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.parceiro_projetos (
  parceiro_id uuid NOT NULL REFERENCES public.parceiros(id) ON DELETE CASCADE,
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (parceiro_id, projeto_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parceiro_projetos TO authenticated;
GRANT ALL ON public.parceiro_projetos TO service_role;
ALTER TABLE public.parceiro_projetos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parceiro_projetos_select_auth" ON public.parceiro_projetos FOR SELECT TO authenticated USING (true);
CREATE POLICY "parceiro_projetos_staff_write" ON public.parceiro_projetos FOR ALL TO authenticated
  USING (public.is_current_user_staff()) WITH CHECK (public.is_current_user_staff());

CREATE TABLE public.parceiro_interacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parceiro_id uuid NOT NULL REFERENCES public.parceiros(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT CURRENT_DATE,
  tipo text,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_parceiro_interacoes_parceiro ON public.parceiro_interacoes(parceiro_id, data DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parceiro_interacoes TO authenticated;
GRANT ALL ON public.parceiro_interacoes TO service_role;
ALTER TABLE public.parceiro_interacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parceiro_interacoes_select_auth" ON public.parceiro_interacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "parceiro_interacoes_staff_write" ON public.parceiro_interacoes FOR ALL TO authenticated
  USING (public.is_current_user_staff()) WITH CHECK (public.is_current_user_staff());
CREATE TRIGGER parceiro_interacoes_set_updated_at BEFORE UPDATE ON public.parceiro_interacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.acao_parceiros (
  acao_id uuid NOT NULL REFERENCES public.acoes(id) ON DELETE CASCADE,
  parceiro_id uuid NOT NULL REFERENCES public.parceiros(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (acao_id, parceiro_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.acao_parceiros TO authenticated;
GRANT SELECT ON public.acao_parceiros TO anon;
GRANT ALL ON public.acao_parceiros TO service_role;
ALTER TABLE public.acao_parceiros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acao_parceiros_select_all" ON public.acao_parceiros FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "acao_parceiros_staff_write" ON public.acao_parceiros FOR ALL TO authenticated
  USING (public.is_current_user_staff()) WITH CHECK (public.is_current_user_staff());

-- Sidebar item for Parceiros
INSERT INTO public.sidebar_items (group_id, key, label, url, icon, position, is_visible, visible_to, is_system)
SELECT g.id, 'parceiros', 'Parceiros', '/parceiros', 'Handshake', 5, true, ARRAY['admin','staff'], false
  FROM public.sidebar_groups g WHERE g.key = 'participantes'
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 3. FAMILIA CONTEXTO
-- ============================================================
CREATE TABLE public.familia_contexto (
  familia_id uuid PRIMARY KEY REFERENCES public.familias(id) ON DELETE CASCADE,
  territorio text,
  linguas text[] NOT NULL DEFAULT '{}',
  tradicao_cultural text,
  redes_suporte text[] NOT NULL DEFAULT '{}',
  frequencia_participacao text,
  notas_relacionais text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.familia_contexto TO authenticated;
GRANT ALL ON public.familia_contexto TO service_role;
ALTER TABLE public.familia_contexto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "familia_contexto_select_staff_or_own" ON public.familia_contexto
  FOR SELECT TO authenticated
  USING (public.is_current_user_staff() OR familia_id = public.current_user_familia_id());
CREATE POLICY "familia_contexto_staff_write" ON public.familia_contexto
  FOR ALL TO authenticated
  USING (public.is_current_user_staff())
  WITH CHECK (public.is_current_user_staff());
CREATE TRIGGER familia_contexto_set_updated_at BEFORE UPDATE ON public.familia_contexto
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
