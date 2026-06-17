
-- Notifications table (one row per recipient)
CREATE TABLE public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_auth_id uuid NOT NULL,
  tipo text NOT NULL,
  titulo text NOT NULL,
  descricao text,
  link text,
  lida boolean NOT NULL DEFAULT false,
  lida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notificacoes_recipient ON public.notificacoes(recipient_auth_id, lida, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications"
  ON public.notificacoes FOR SELECT
  TO authenticated
  USING (recipient_auth_id = auth.uid());

CREATE POLICY "Users update own notifications"
  ON public.notificacoes FOR UPDATE
  TO authenticated
  USING (recipient_auth_id = auth.uid())
  WITH CHECK (recipient_auth_id = auth.uid());

CREATE POLICY "Users delete own notifications"
  ON public.notificacoes FOR DELETE
  TO authenticated
  USING (recipient_auth_id = auth.uid());

-- Helper: insert notification for all admins + equipa members
CREATE OR REPLACE FUNCTION public.notificar_staff(
  p_tipo text,
  p_titulo text,
  p_descricao text DEFAULT NULL,
  p_link text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notificacoes (recipient_auth_id, tipo, titulo, descricao, link)
  SELECT DISTINCT p.auth_user_id, p_tipo, p_titulo, p_descricao, p_link
    FROM public.pessoas p
    LEFT JOIN public.tipos_user tu ON tu.id = p.tipo_user_id
   WHERE p.auth_user_id IS NOT NULL
     AND p.status = 'ativo'
     AND (p.is_admin = true OR lower(COALESCE(tu.nome,'')) = 'equipa');
END;
$$;

-- Trigger: nova pessoa criada
CREATE OR REPLACE FUNCTION public.notif_nova_pessoa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'ativo' THEN
    PERFORM public.notificar_staff(
      'nova_pessoa',
      'Novo utilizador registado',
      COALESCE(NEW.nome_completo, NEW.email, 'Sem nome'),
      '/participantes'
    );
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notif_nova_pessoa
AFTER INSERT ON public.pessoas
FOR EACH ROW EXECUTE FUNCTION public.notif_nova_pessoa();

-- Trigger: nova ação/evento
CREATE OR REPLACE FUNCTION public.notif_nova_acao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notificar_staff(
    'nova_acao',
    'Novo ' || COALESCE(NEW.tipo, 'evento') || ' criado',
    NEW.nome,
    '/acoes'
  );
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notif_nova_acao
AFTER INSERT ON public.acoes
FOR EACH ROW EXECUTE FUNCTION public.notif_nova_acao();

-- Trigger: nova inscrição (família/pessoa registada num evento)
CREATE OR REPLACE FUNCTION public.notif_nova_inscricao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pessoa text;
  v_acao text;
BEGIN
  SELECT nome_completo INTO v_pessoa FROM public.pessoas WHERE id = NEW.pessoa_id;
  SELECT nome INTO v_acao FROM public.acoes WHERE id = NEW.acao_id;
  PERFORM public.notificar_staff(
    'nova_inscricao',
    'Nova inscrição',
    COALESCE(v_pessoa,'Alguém') || ' inscreveu-se em ' || COALESCE(v_acao,'evento'),
    '/participantes'
  );
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notif_nova_inscricao
AFTER INSERT ON public.inscricoes
FOR EACH ROW EXECUTE FUNCTION public.notif_nova_inscricao();

-- Trigger: novo currículo
CREATE OR REPLACE FUNCTION public.notif_novo_curriculo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pessoa text;
BEGIN
  SELECT nome_completo INTO v_pessoa FROM public.pessoas WHERE id = NEW.pessoa_id;
  PERFORM public.notificar_staff(
    'novo_curriculo',
    'Novo currículo submetido',
    COALESCE(v_pessoa,'Alguém'),
    '/curriculos'
  );
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notif_novo_curriculo
AFTER INSERT ON public.curriculos
FOR EACH ROW EXECUTE FUNCTION public.notif_novo_curriculo();

-- Trigger: nova atividade de família registada
CREATE OR REPLACE FUNCTION public.notif_nova_familia_atividade()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_fam text;
  v_at text;
BEGIN
  SELECT nome INTO v_fam FROM public.familias WHERE id = NEW.familia_id;
  SELECT nome INTO v_at FROM public.atividades_catalogo WHERE id = NEW.atividade_id;
  PERFORM public.notificar_staff(
    'nova_atividade',
    'Nova atividade registada',
    COALESCE(v_fam,'Família') || ' — ' || COALESCE(v_at,'atividade'),
    '/familias'
  );
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notif_nova_familia_atividade
AFTER INSERT ON public.familia_atividades
FOR EACH ROW EXECUTE FUNCTION public.notif_nova_familia_atividade();

-- Trigger: alteração de status de participante (inscrição)
CREATE OR REPLACE FUNCTION public.notif_inscricao_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pessoa text;
  v_acao text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT nome_completo INTO v_pessoa FROM public.pessoas WHERE id = NEW.pessoa_id;
    SELECT nome INTO v_acao FROM public.acoes WHERE id = NEW.acao_id;
    PERFORM public.notificar_staff(
      'inscricao_status',
      'Estado de inscrição alterado',
      COALESCE(v_pessoa,'Alguém') || ' em ' || COALESCE(v_acao,'evento') || ': ' || NEW.status::text,
      '/participantes'
    );
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notif_inscricao_status
AFTER UPDATE ON public.inscricoes
FOR EACH ROW EXECUTE FUNCTION public.notif_inscricao_status();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
