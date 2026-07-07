
CREATE TABLE public.bolsas_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inscricao_id uuid NOT NULL UNIQUE REFERENCES public.inscricoes(id) ON DELETE CASCADE,
  pessoa_id uuid NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
  acao_id uuid NOT NULL REFERENCES public.acoes(id) ON DELETE CASCADE,
  valor numeric(8,2) NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'por_pagar' CHECK (estado IN ('por_pagar','pago','cancelado')),
  metodo_pagamento text,
  notas text,
  data_pagamento date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bolsas_pagamentos TO authenticated;
GRANT ALL ON public.bolsas_pagamentos TO service_role;

ALTER TABLE public.bolsas_pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bolsas_pagamentos_select_all" ON public.bolsas_pagamentos FOR SELECT USING (true);
CREATE POLICY "bolsas_pagamentos_staff_write" ON public.bolsas_pagamentos FOR ALL USING (public.is_current_user_staff()) WITH CHECK (public.is_current_user_staff());
CREATE POLICY "bolsas_pagamentos_admin_write" ON public.bolsas_pagamentos FOR ALL USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

CREATE INDEX idx_bolsas_pagamentos_acao ON public.bolsas_pagamentos(acao_id);
CREATE INDEX idx_bolsas_pagamentos_pessoa ON public.bolsas_pagamentos(pessoa_id);
CREATE INDEX idx_bolsas_pagamentos_estado ON public.bolsas_pagamentos(estado);

CREATE TRIGGER bolsas_pagamentos_touch_updated_at
BEFORE UPDATE ON public.bolsas_pagamentos
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
