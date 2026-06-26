
-- ============ RELATORIOS ============
CREATE TABLE public.relatorios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  financiador text NOT NULL,
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  tipo text NOT NULL DEFAULT 'Intercalar' CHECK (tipo IN ('Intercalar','Final','Anual','Candidatura','Outro')),
  estado text NOT NULL DEFAULT 'Rascunho' CHECK (estado IN ('Rascunho','Em revisão','Aprovado','Submetido')),
  data_submissao_prevista date,
  data_submissao_real date,
  criado_por_id uuid REFERENCES public.pessoas(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.relatorios TO authenticated;
GRANT ALL ON public.relatorios TO service_role;

ALTER TABLE public.relatorios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "relatorios_staff_all" ON public.relatorios
  FOR ALL TO authenticated
  USING (public.is_current_user_staff())
  WITH CHECK (public.is_current_user_staff());

CREATE TRIGGER relatorios_set_updated_at
  BEFORE UPDATE ON public.relatorios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_relatorios_estado ON public.relatorios(estado);
CREATE INDEX idx_relatorios_projeto ON public.relatorios(projeto_id);
CREATE INDEX idx_relatorios_submissao_prevista ON public.relatorios(data_submissao_prevista);

-- ============ RELATORIO_SECOES ============
CREATE TABLE public.relatorio_secoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relatorio_id uuid NOT NULL REFERENCES public.relatorios(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('texto','indicadores','atividades','participantes','casos','citacao','separador')),
  titulo text,
  conteudo_texto text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.relatorio_secoes TO authenticated;
GRANT ALL ON public.relatorio_secoes TO service_role;

ALTER TABLE public.relatorio_secoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "relatorio_secoes_staff_all" ON public.relatorio_secoes
  FOR ALL TO authenticated
  USING (public.is_current_user_staff())
  WITH CHECK (public.is_current_user_staff());

CREATE INDEX idx_relatorio_secoes_relatorio ON public.relatorio_secoes(relatorio_id, position);

-- ============ RELATORIO_SNAPSHOTS ============
CREATE TABLE public.relatorio_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relatorio_id uuid NOT NULL REFERENCES public.relatorios(id) ON DELETE CASCADE,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  criado_por_id uuid REFERENCES public.pessoas(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.relatorio_snapshots TO authenticated;
GRANT ALL ON public.relatorio_snapshots TO service_role;

ALTER TABLE public.relatorio_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "relatorio_snapshots_staff_all" ON public.relatorio_snapshots
  FOR ALL TO authenticated
  USING (public.is_current_user_staff())
  WITH CHECK (public.is_current_user_staff());

CREATE INDEX idx_relatorio_snapshots_relatorio ON public.relatorio_snapshots(relatorio_id, criado_em DESC);
