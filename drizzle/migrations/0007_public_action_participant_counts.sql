CREATE OR REPLACE FUNCTION public.get_public_action_participant_counts(p_action_ids uuid[])
RETURNS TABLE (acao_id uuid, participantes bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT a.id,
    (SELECT count(*) FROM public.inscricoes i WHERE i.acao_id = a.id AND i.status <> 'cancelada') + a.participantes_extra::bigint
  FROM public.acoes a
  WHERE a.id = ANY(p_action_ids)
    AND a.publico = true
    AND (
      a.restrito_a_projetos = false
      OR (auth.uid() IS NOT NULL AND (
        public.is_current_user_admin()
        OR cardinality(a.projeto_ids) = 0
        OR EXISTS (
          SELECT 1 FROM public.pessoas p
          WHERE p.auth_user_id = auth.uid() AND p.projeto_ids && a.projeto_ids
        )
      ))
    );
$$;
REVOKE ALL ON FUNCTION public.get_public_action_participant_counts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_action_participant_counts(uuid[]) TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.get_public_action_participant_counts(uuid[]) IS 'Only aggregate non-cancelled registrations plus extra participants for visible public actions; never exposes personal data.';