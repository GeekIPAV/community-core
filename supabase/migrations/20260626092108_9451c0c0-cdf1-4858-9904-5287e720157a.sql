
CREATE OR REPLACE FUNCTION public.count_relatorios_pendentes()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
    FROM public.relatorios
   WHERE estado <> 'Submetido'
     AND (
       estado = 'Em revisão'
       OR (data_submissao_prevista IS NOT NULL
           AND data_submissao_prevista <= (CURRENT_DATE + INTERVAL '14 days'))
     );
$$;
GRANT EXECUTE ON FUNCTION public.count_relatorios_pendentes() TO authenticated;
