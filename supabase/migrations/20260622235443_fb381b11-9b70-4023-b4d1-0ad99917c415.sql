
-- Financiamentos table
CREATE TABLE public.financiamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  financiador text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('Grant','Prémio','Contrato','Donativo')),
  valor_total numeric,
  data_inicio date,
  data_fim date,
  estado text NOT NULL DEFAULT 'Candidatura submetida' CHECK (estado IN ('Candidatura submetida','Aprovado','Em execução','Encerrado','Rejeitado')),
  referencia text,
  responsavel text,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financiamentos TO authenticated;
GRANT ALL ON public.financiamentos TO service_role;

ALTER TABLE public.financiamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view financiamentos"
ON public.financiamentos FOR SELECT TO authenticated
USING (public.is_current_user_staff());

CREATE POLICY "Admins can manage financiamentos"
ON public.financiamentos FOR ALL TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

CREATE TRIGGER trg_financiamentos_updated
BEFORE UPDATE ON public.financiamentos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Join table
CREATE TABLE public.financiamento_indicadores (
  financiamento_id uuid NOT NULL REFERENCES public.financiamentos(id) ON DELETE CASCADE,
  indicador_id uuid NOT NULL REFERENCES public.projeto_kpis(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (financiamento_id, indicador_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financiamento_indicadores TO authenticated;
GRANT ALL ON public.financiamento_indicadores TO service_role;

ALTER TABLE public.financiamento_indicadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view financiamento_indicadores"
ON public.financiamento_indicadores FOR SELECT TO authenticated
USING (public.is_current_user_staff());

CREATE POLICY "Admins can manage financiamento_indicadores"
ON public.financiamento_indicadores FOR ALL TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

CREATE INDEX idx_fin_ind_indicador ON public.financiamento_indicadores(indicador_id);
