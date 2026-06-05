
-- Helper: staff = admin OU perfil "Equipa"
CREATE OR REPLACE FUNCTION public.is_current_user_staff()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT p.is_admin
          OR EXISTS (
            SELECT 1 FROM public.tipos_user tu
             WHERE tu.id = p.tipo_user_id
               AND lower(tu.nome) = 'equipa'
          )
        FROM public.pessoas p
       WHERE p.id = public.current_user_pessoa_id()
    ),
    false
  );
$$;

-- PESSOAS: staff vê e gere tudo
DROP POLICY IF EXISTS pessoas_staff_all ON public.pessoas;
CREATE POLICY pessoas_staff_all ON public.pessoas
  FOR ALL TO authenticated
  USING (public.is_current_user_staff())
  WITH CHECK (public.is_current_user_staff());

-- FAMILIAS
DROP POLICY IF EXISTS familias_staff_all ON public.familias;
CREATE POLICY familias_staff_all ON public.familias
  FOR ALL TO authenticated
  USING (public.is_current_user_staff())
  WITH CHECK (public.is_current_user_staff());

-- INSCRICOES
DROP POLICY IF EXISTS inscricoes_staff_all ON public.inscricoes;
CREATE POLICY inscricoes_staff_all ON public.inscricoes
  FOR ALL TO authenticated
  USING (public.is_current_user_staff())
  WITH CHECK (public.is_current_user_staff());

-- FAMILIA_ATIVIDADES
DROP POLICY IF EXISTS familia_atividades_staff_all ON public.familia_atividades;
CREATE POLICY familia_atividades_staff_all ON public.familia_atividades
  FOR ALL TO authenticated
  USING (public.is_current_user_staff())
  WITH CHECK (public.is_current_user_staff());

-- ACOES (já é select público; permite escrita a staff)
DROP POLICY IF EXISTS acoes_staff_write ON public.acoes;
CREATE POLICY acoes_staff_write ON public.acoes
  FOR ALL TO authenticated
  USING (public.is_current_user_staff())
  WITH CHECK (public.is_current_user_staff());

-- PROJETOS
DROP POLICY IF EXISTS projetos_staff_write ON public.projetos;
CREATE POLICY projetos_staff_write ON public.projetos
  FOR ALL TO authenticated
  USING (public.is_current_user_staff())
  WITH CHECK (public.is_current_user_staff());

-- ATIVIDADES_CATALOGO
DROP POLICY IF EXISTS atividades_catalogo_staff_write ON public.atividades_catalogo;
CREATE POLICY atividades_catalogo_staff_write ON public.atividades_catalogo
  FOR ALL TO authenticated
  USING (public.is_current_user_staff())
  WITH CHECK (public.is_current_user_staff());

-- BOLSAS_CIDADES
DROP POLICY IF EXISTS bolsas_cidades_staff_write ON public.bolsas_cidades;
CREATE POLICY bolsas_cidades_staff_write ON public.bolsas_cidades
  FOR ALL TO authenticated
  USING (public.is_current_user_staff())
  WITH CHECK (public.is_current_user_staff());
