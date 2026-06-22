
-- =========================================================
-- COLABORADORES
-- =========================================================
CREATE TABLE public.colaboradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_completo text NOT NULL,
  email text UNIQUE,
  telefone text,
  iban text,
  notas text,
  ativo boolean NOT NULL DEFAULT true,
  auth_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.colaboradores TO authenticated;
GRANT ALL ON public.colaboradores TO service_role;

ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "colab_staff_all" ON public.colaboradores
  FOR ALL TO authenticated
  USING (public.is_current_user_staff())
  WITH CHECK (public.is_current_user_staff());

-- Colaborador autenticado vê o próprio registo (match por email ou auth_user_id)
CREATE POLICY "colab_self_select" ON public.colaboradores
  FOR SELECT TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR (email IS NOT NULL AND lower(email) = lower(COALESCE((auth.jwt() ->> 'email')::text, '')))
  );

CREATE TRIGGER trg_colaboradores_updated_at
  BEFORE UPDATE ON public.colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_colaboradores_email_lower ON public.colaboradores (lower(email));
CREATE INDEX idx_colaboradores_auth_user_id ON public.colaboradores (auth_user_id);

-- =========================================================
-- TIPOS DE SERVIÇO
-- =========================================================
CREATE TABLE public.tipos_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  unidade text NOT NULL DEFAULT 'hora',
  preco_unitario numeric(12,2) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tipos_servico TO authenticated;
GRANT ALL ON public.tipos_servico TO service_role;

ALTER TABLE public.tipos_servico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tipos_servico_staff_all" ON public.tipos_servico
  FOR ALL TO authenticated
  USING (public.is_current_user_staff())
  WITH CHECK (public.is_current_user_staff());

CREATE POLICY "tipos_servico_auth_select_ativos" ON public.tipos_servico
  FOR SELECT TO authenticated
  USING (ativo = true);

CREATE TRIGGER trg_tipos_servico_updated_at
  BEFORE UPDATE ON public.tipos_servico
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- PAGAMENTOS
-- =========================================================
CREATE TABLE public.pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE RESTRICT,
  data_pagamento date NOT NULL DEFAULT CURRENT_DATE,
  total numeric(12,2) NOT NULL DEFAULT 0,
  referencia text,
  metodo text,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagamentos TO authenticated;
GRANT ALL ON public.pagamentos TO service_role;

ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pagamentos_staff_all" ON public.pagamentos
  FOR ALL TO authenticated
  USING (public.is_current_user_staff())
  WITH CHECK (public.is_current_user_staff());

-- Colaborador vê os seus próprios pagamentos
CREATE POLICY "pagamentos_self_select" ON public.pagamentos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.colaboradores c
      WHERE c.id = pagamentos.colaborador_id
        AND (
          c.auth_user_id = auth.uid()
          OR (c.email IS NOT NULL AND lower(c.email) = lower(COALESCE((auth.jwt() ->> 'email')::text, '')))
        )
    )
  );

CREATE TRIGGER trg_pagamentos_updated_at
  BEFORE UPDATE ON public.pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_pagamentos_colaborador ON public.pagamentos (colaborador_id);
CREATE INDEX idx_pagamentos_data ON public.pagamentos (data_pagamento DESC);

-- =========================================================
-- REGISTOS DE SERVIÇO
-- =========================================================
CREATE TABLE public.registos_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE RESTRICT,
  tipo_servico_id uuid NOT NULL REFERENCES public.tipos_servico(id) ON DELETE RESTRICT,
  data_inicio date NOT NULL,
  data_fim date,
  descricao text,
  quantidade numeric(12,2) NOT NULL DEFAULT 1,
  preco_unitario_override numeric(12,2),
  outros_custos numeric(12,2) NOT NULL DEFAULT 0,
  outros_custos_descricao text,
  km numeric(10,2),
  estado text NOT NULL DEFAULT 'pendente' CHECK (estado IN ('pendente','aprovado','pago')),
  submetido_pelo_colaborador boolean NOT NULL DEFAULT false,
  pagamento_id uuid REFERENCES public.pagamentos(id) ON DELETE SET NULL,
  notas_admin text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.registos_servico TO authenticated;
GRANT ALL ON public.registos_servico TO service_role;

ALTER TABLE public.registos_servico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "registos_servico_staff_all" ON public.registos_servico
  FOR ALL TO authenticated
  USING (public.is_current_user_staff())
  WITH CHECK (public.is_current_user_staff());

-- Colaborador vê os seus próprios registos
CREATE POLICY "registos_servico_self_select" ON public.registos_servico
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.colaboradores c
      WHERE c.id = registos_servico.colaborador_id
        AND (
          c.auth_user_id = auth.uid()
          OR (c.email IS NOT NULL AND lower(c.email) = lower(COALESCE((auth.jwt() ->> 'email')::text, '')))
        )
    )
  );

-- Colaborador insere registos próprios marcados como self-submitted e em estado pendente
CREATE POLICY "registos_servico_self_insert" ON public.registos_servico
  FOR INSERT TO authenticated
  WITH CHECK (
    submetido_pelo_colaborador = true
    AND estado = 'pendente'
    AND pagamento_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.colaboradores c
      WHERE c.id = registos_servico.colaborador_id
        AND (
          c.auth_user_id = auth.uid()
          OR (c.email IS NOT NULL AND lower(c.email) = lower(COALESCE((auth.jwt() ->> 'email')::text, '')))
        )
    )
  );

-- Colaborador edita os seus registos enquanto ainda estão pendentes e sem pagamento
CREATE POLICY "registos_servico_self_update" ON public.registos_servico
  FOR UPDATE TO authenticated
  USING (
    estado = 'pendente'
    AND pagamento_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.colaboradores c
      WHERE c.id = registos_servico.colaborador_id
        AND (
          c.auth_user_id = auth.uid()
          OR (c.email IS NOT NULL AND lower(c.email) = lower(COALESCE((auth.jwt() ->> 'email')::text, '')))
        )
    )
  )
  WITH CHECK (
    estado = 'pendente'
    AND pagamento_id IS NULL
  );

CREATE TRIGGER trg_registos_servico_updated_at
  BEFORE UPDATE ON public.registos_servico
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_registos_servico_colaborador ON public.registos_servico (colaborador_id);
CREATE INDEX idx_registos_servico_tipo ON public.registos_servico (tipo_servico_id);
CREATE INDEX idx_registos_servico_pagamento ON public.registos_servico (pagamento_id);
CREATE INDEX idx_registos_servico_estado ON public.registos_servico (estado);
CREATE INDEX idx_registos_servico_data ON public.registos_servico (data_inicio DESC);
