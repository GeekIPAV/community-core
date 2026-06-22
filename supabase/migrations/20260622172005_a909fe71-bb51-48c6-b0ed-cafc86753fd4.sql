
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS pessoa_id uuid REFERENCES public.pessoas(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS colaboradores_pessoa_id_unique ON public.colaboradores(pessoa_id) WHERE pessoa_id IS NOT NULL;

DROP POLICY IF EXISTS colab_self_select ON public.colaboradores;
CREATE POLICY colab_self_select ON public.colaboradores
FOR SELECT
USING (
  auth_user_id = auth.uid()
  OR (email IS NOT NULL AND lower(email) = lower(COALESCE(auth.jwt()->>'email','')))
  OR (pessoa_id IS NOT NULL AND pessoa_id = public.current_user_pessoa_id())
);

DROP POLICY IF EXISTS pagamentos_self_select ON public.pagamentos;
CREATE POLICY pagamentos_self_select ON public.pagamentos
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.colaboradores c
  WHERE c.id = pagamentos.colaborador_id
    AND (
      c.auth_user_id = auth.uid()
      OR (c.email IS NOT NULL AND lower(c.email) = lower(COALESCE(auth.jwt()->>'email','')))
      OR (c.pessoa_id IS NOT NULL AND c.pessoa_id = public.current_user_pessoa_id())
    )
));

DROP POLICY IF EXISTS registos_servico_self_select ON public.registos_servico;
CREATE POLICY registos_servico_self_select ON public.registos_servico
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.colaboradores c
  WHERE c.id = registos_servico.colaborador_id
    AND (
      c.auth_user_id = auth.uid()
      OR (c.email IS NOT NULL AND lower(c.email) = lower(COALESCE(auth.jwt()->>'email','')))
      OR (c.pessoa_id IS NOT NULL AND c.pessoa_id = public.current_user_pessoa_id())
    )
));

DROP POLICY IF EXISTS registos_servico_self_update ON public.registos_servico;
CREATE POLICY registos_servico_self_update ON public.registos_servico
FOR UPDATE
USING (
  estado = 'pendente' AND pagamento_id IS NULL AND EXISTS (
    SELECT 1 FROM public.colaboradores c
    WHERE c.id = registos_servico.colaborador_id
      AND (
        c.auth_user_id = auth.uid()
        OR (c.email IS NOT NULL AND lower(c.email) = lower(COALESCE(auth.jwt()->>'email','')))
        OR (c.pessoa_id IS NOT NULL AND c.pessoa_id = public.current_user_pessoa_id())
      )
  )
);
