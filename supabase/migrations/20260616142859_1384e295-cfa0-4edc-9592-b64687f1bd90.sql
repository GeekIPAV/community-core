
-- Tabela de currículos (1-1 com pessoas adultas)
CREATE TABLE public.curriculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id uuid NOT NULL UNIQUE REFERENCES public.pessoas(id) ON DELETE CASCADE,
  cv_url text,
  cv_nome_ficheiro text,
  carta_motivacao_texto text,
  carta_motivacao_url text,
  carta_motivacao_nome_ficheiro text,
  areas_interesse text[] NOT NULL DEFAULT '{}',
  competencias text[] NOT NULL DEFAULT '{}',
  disponibilidade text,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX curriculos_pessoa_id_idx ON public.curriculos(pessoa_id);
CREATE INDEX curriculos_areas_interesse_idx ON public.curriculos USING gin(areas_interesse);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculos TO authenticated;
GRANT ALL ON public.curriculos TO service_role;

ALTER TABLE public.curriculos ENABLE ROW LEVEL SECURITY;

-- O próprio (pessoa associada ao auth user) pode ver e gerir o seu currículo
CREATE POLICY "curriculos_self_select" ON public.curriculos
  FOR SELECT TO authenticated
  USING (pessoa_id = public.current_user_pessoa_id());

CREATE POLICY "curriculos_self_insert" ON public.curriculos
  FOR INSERT TO authenticated
  WITH CHECK (pessoa_id = public.current_user_pessoa_id());

CREATE POLICY "curriculos_self_update" ON public.curriculos
  FOR UPDATE TO authenticated
  USING (pessoa_id = public.current_user_pessoa_id())
  WITH CHECK (pessoa_id = public.current_user_pessoa_id());

CREATE POLICY "curriculos_self_delete" ON public.curriculos
  FOR DELETE TO authenticated
  USING (pessoa_id = public.current_user_pessoa_id());

-- Staff/admin podem ver e gerir todos
CREATE POLICY "curriculos_staff_all" ON public.curriculos
  FOR ALL TO authenticated
  USING (public.is_current_user_staff())
  WITH CHECK (public.is_current_user_staff());

CREATE TRIGGER curriculos_set_updated_at
  BEFORE UPDATE ON public.curriculos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Catálogo opcional de áreas de interesse (para sugestões na UI)
CREATE TABLE public.areas_interesse_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  categoria text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.areas_interesse_catalogo TO authenticated;
GRANT ALL ON public.areas_interesse_catalogo TO service_role;

ALTER TABLE public.areas_interesse_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "areas_catalogo_read_authenticated" ON public.areas_interesse_catalogo
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "areas_catalogo_staff_manage" ON public.areas_interesse_catalogo
  FOR ALL TO authenticated
  USING (public.is_current_user_staff())
  WITH CHECK (public.is_current_user_staff());

-- Storage policies para o bucket 'curriculos'
-- Estrutura de paths: <pessoa_id>/<ficheiro>
CREATE POLICY "curriculos_storage_self_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'curriculos'
    AND (storage.foldername(name))[1] = public.current_user_pessoa_id()::text
  );

CREATE POLICY "curriculos_storage_self_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'curriculos'
    AND (storage.foldername(name))[1] = public.current_user_pessoa_id()::text
  );

CREATE POLICY "curriculos_storage_self_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'curriculos'
    AND (storage.foldername(name))[1] = public.current_user_pessoa_id()::text
  );

CREATE POLICY "curriculos_storage_self_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'curriculos'
    AND (storage.foldername(name))[1] = public.current_user_pessoa_id()::text
  );

CREATE POLICY "curriculos_storage_staff_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'curriculos' AND public.is_current_user_staff());

CREATE POLICY "curriculos_storage_staff_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'curriculos' AND public.is_current_user_staff());

CREATE POLICY "curriculos_storage_staff_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'curriculos' AND public.is_current_user_staff());

CREATE POLICY "curriculos_storage_staff_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'curriculos' AND public.is_current_user_staff());

-- Seed inicial de áreas comuns
INSERT INTO public.areas_interesse_catalogo (nome, categoria) VALUES
  ('Educação', 'Social'),
  ('Saúde', 'Social'),
  ('Apoio social', 'Social'),
  ('Ação humanitária', 'Social'),
  ('Voluntariado', 'Social'),
  ('Administração', 'Gestão'),
  ('Contabilidade / Finanças', 'Gestão'),
  ('Recursos humanos', 'Gestão'),
  ('Marketing e Comunicação', 'Comunicação'),
  ('Design', 'Criativo'),
  ('Audiovisual / Fotografia', 'Criativo'),
  ('Tecnologias de Informação', 'Tecnologia'),
  ('Engenharia', 'Tecnologia'),
  ('Construção / Manutenção', 'Operações'),
  ('Logística', 'Operações'),
  ('Restauração', 'Operações'),
  ('Tradução / Línguas', 'Outros'),
  ('Música e Artes', 'Criativo'),
  ('Desporto', 'Outros'),
  ('Investigação', 'Outros')
ON CONFLICT (nome) DO NOTHING;
