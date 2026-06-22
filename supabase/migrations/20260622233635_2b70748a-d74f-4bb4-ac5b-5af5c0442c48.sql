
-- 1) convites: allow invited user to read their own invite by email match
DROP POLICY IF EXISTS convites_self_select ON public.convites;
CREATE POLICY convites_self_select ON public.convites
  FOR SELECT
  TO authenticated
  USING (
    email IS NOT NULL
    AND lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );

-- 2) inscricoes: require acao to be public and open for self-insert (staff bypass via inscricoes_staff_all/admin_all)
DROP POLICY IF EXISTS inscricoes_self_insert ON public.inscricoes;
CREATE POLICY inscricoes_self_insert ON public.inscricoes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      pessoa_id = public.current_user_pessoa_id()
      OR pessoa_id IN (
        SELECT p.id FROM public.pessoas p
        WHERE p.familia_id IS NOT NULL
          AND p.familia_id = public.current_user_familia_id()
      )
    )
    AND EXISTS (
      SELECT 1 FROM public.acoes a
      WHERE a.id = inscricoes.acao_id
        AND a.publico = true
        AND a.inscricoes_abertas = true
    )
  );

-- 3) pessoa_etiquetas: restrict SELECT to staff only
DROP POLICY IF EXISTS pessoa_etiquetas_select_auth ON public.pessoa_etiquetas;
CREATE POLICY pessoa_etiquetas_staff_select ON public.pessoa_etiquetas
  FOR SELECT
  TO authenticated
  USING (public.is_current_user_staff());

-- 4) registos_servico: add explicit WITH CHECK on self-update
DROP POLICY IF EXISTS registos_servico_self_update ON public.registos_servico;
CREATE POLICY registos_servico_self_update ON public.registos_servico
  FOR UPDATE
  TO authenticated
  USING (
    estado = 'pendente'
    AND pagamento_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.colaboradores c
      WHERE c.id = registos_servico.colaborador_id
        AND (
          c.auth_user_id = auth.uid()
          OR (c.email IS NOT NULL AND lower(c.email) = lower(COALESCE(auth.jwt() ->> 'email', '')))
          OR (c.pessoa_id IS NOT NULL AND c.pessoa_id = public.current_user_pessoa_id())
        )
    )
  )
  WITH CHECK (
    estado = 'pendente'
    AND pagamento_id IS NULL
    AND submetido_pelo_colaborador = true
    AND EXISTS (
      SELECT 1 FROM public.colaboradores c
      WHERE c.id = registos_servico.colaborador_id
        AND (
          c.auth_user_id = auth.uid()
          OR (c.email IS NOT NULL AND lower(c.email) = lower(COALESCE(auth.jwt() ->> 'email', '')))
          OR (c.pessoa_id IS NOT NULL AND c.pessoa_id = public.current_user_pessoa_id())
        )
    )
  );
