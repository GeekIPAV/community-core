
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.email_pedidos_ajuda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_message_id TEXT NOT NULL UNIQUE,
  gmail_thread_id TEXT,
  from_email TEXT, from_name TEXT, subject TEXT,
  snippet TEXT, body_text TEXT,
  received_at TIMESTAMPTZ,
  score INT NOT NULL DEFAULT 0,
  motivos TEXT, resumo TEXT, idioma TEXT,
  estado TEXT NOT NULL DEFAULT 'novo',
  pessoa_id UUID REFERENCES public.pessoas(id) ON DELETE SET NULL,
  familia_id UUID REFERENCES public.familias(id) ON DELETE SET NULL,
  caso_id UUID REFERENCES public.casos_apoio(id) ON DELETE SET NULL,
  atribuido_a UUID, notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_pedidos_ajuda TO authenticated;
GRANT ALL ON public.email_pedidos_ajuda TO service_role;
ALTER TABLE public.email_pedidos_ajuda ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_email_pedidos" ON public.email_pedidos_ajuda
  FOR ALL TO authenticated
  USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());
CREATE TRIGGER trg_email_pedidos_updated_at BEFORE UPDATE ON public.email_pedidos_ajuda
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_email_pedidos_estado ON public.email_pedidos_ajuda(estado, received_at DESC);
CREATE INDEX idx_email_pedidos_received ON public.email_pedidos_ajuda(received_at DESC);

CREATE TABLE public.email_sync_state (
  id INT PRIMARY KEY DEFAULT 1,
  last_history_id TEXT,
  last_message_internal_date BIGINT,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  CHECK (id = 1)
);
GRANT SELECT, INSERT, UPDATE ON public.email_sync_state TO authenticated;
GRANT ALL ON public.email_sync_state TO service_role;
ALTER TABLE public.email_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_email_sync_state" ON public.email_sync_state
  FOR ALL TO authenticated
  USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());
INSERT INTO public.email_sync_state (id) VALUES (1) ON CONFLICT DO NOTHING;
