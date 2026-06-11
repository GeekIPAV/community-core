
CREATE TABLE public.etiquetas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  cor text not null default 'gray',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.etiquetas TO authenticated;
GRANT ALL ON public.etiquetas TO service_role;
ALTER TABLE public.etiquetas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "etiquetas_select_auth" ON public.etiquetas FOR SELECT TO authenticated USING (true);
CREATE POLICY "etiquetas_admin_write" ON public.etiquetas FOR ALL TO authenticated
  USING (public.is_current_user_staff()) WITH CHECK (public.is_current_user_staff());
CREATE TRIGGER trg_etiquetas_updated_at BEFORE UPDATE ON public.etiquetas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.pessoa_etiquetas (
  pessoa_id uuid not null references public.pessoas(id) on delete cascade,
  etiqueta_id uuid not null references public.etiquetas(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (pessoa_id, etiqueta_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pessoa_etiquetas TO authenticated;
GRANT ALL ON public.pessoa_etiquetas TO service_role;
ALTER TABLE public.pessoa_etiquetas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pessoa_etiquetas_select_auth" ON public.pessoa_etiquetas FOR SELECT TO authenticated USING (true);
CREATE POLICY "pessoa_etiquetas_admin_write" ON public.pessoa_etiquetas FOR ALL TO authenticated
  USING (public.is_current_user_staff()) WITH CHECK (public.is_current_user_staff());
CREATE INDEX idx_pessoa_etiquetas_pessoa ON public.pessoa_etiquetas(pessoa_id);
CREATE INDEX idx_pessoa_etiquetas_etiqueta ON public.pessoa_etiquetas(etiqueta_id);
