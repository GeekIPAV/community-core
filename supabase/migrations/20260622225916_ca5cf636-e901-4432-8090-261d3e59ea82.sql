CREATE TABLE public.sessoes_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo_servico_id uuid NOT NULL REFERENCES public.tipos_servico(id) ON DELETE RESTRICT,
  data_inicio date NOT NULL,
  data_fim date,
  descricao text,
  local text,
  quantidade_por_colaborador numeric NOT NULL DEFAULT 1,
  preco_unitario_override numeric,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessoes_servico TO authenticated;
GRANT ALL ON public.sessoes_servico TO service_role;

ALTER TABLE public.registos_servico
  ADD COLUMN sessao_id uuid REFERENCES public.sessoes_servico(id) ON DELETE SET NULL;

CREATE INDEX idx_registos_servico_sessao_id ON public.registos_servico(sessao_id);

ALTER TABLE public.sessoes_servico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff gere sessoes"
  ON public.sessoes_servico
  FOR ALL
  TO authenticated
  USING (public.is_current_user_staff())
  WITH CHECK (public.is_current_user_staff());

CREATE POLICY "Colaboradores veem suas sessoes"
  ON public.sessoes_servico
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.registos_servico rs
      JOIN public.colaboradores c ON c.id = rs.colaborador_id
      WHERE rs.sessao_id = sessoes_servico.id
        AND c.auth_user_id = auth.uid()
    )
  );

CREATE TRIGGER trg_sessoes_servico_updated
  BEFORE UPDATE ON public.sessoes_servico
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();