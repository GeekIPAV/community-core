CREATE TABLE public.convites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  pessoa_id uuid REFERENCES public.pessoas(id) ON DELETE SET NULL,
  criado_por uuid REFERENCES public.pessoas(id) ON DELETE SET NULL,
  enviado boolean NOT NULL DEFAULT false,
  usado_em timestamptz,
  expira_em timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX convites_email_idx ON public.convites (lower(email));
CREATE INDEX convites_token_idx ON public.convites (token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.convites TO authenticated;
GRANT ALL ON public.convites TO service_role;

ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "convites_staff_all" ON public.convites
  FOR ALL TO authenticated
  USING (public.is_current_user_staff())
  WITH CHECK (public.is_current_user_staff());

CREATE TRIGGER convites_updated_at
  BEFORE UPDATE ON public.convites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.convite_validar(p_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.convites;
BEGIN
  SELECT * INTO v_row FROM public.convites WHERE token = p_token LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('valido', false, 'motivo', 'inexistente'); END IF;
  IF v_row.usado_em IS NOT NULL THEN RETURN jsonb_build_object('valido', false, 'motivo', 'ja_usado'); END IF;
  IF v_row.expira_em < now() THEN RETURN jsonb_build_object('valido', false, 'motivo', 'expirado'); END IF;
  RETURN jsonb_build_object('valido', true, 'email', v_row.email);
END;
$$;
GRANT EXECUTE ON FUNCTION public.convite_validar(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.convite_consumir(
  p_token text, p_nome text, p_telefone text DEFAULT NULL, p_data_nascimento date DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.convites; v_pessoa_id uuid;
BEGIN
  IF p_nome IS NULL OR length(trim(p_nome)) = 0 THEN RAISE EXCEPTION 'Nome obrigatório'; END IF;
  SELECT * INTO v_row FROM public.convites WHERE token = p_token LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Convite inválido'; END IF;
  IF v_row.usado_em IS NOT NULL THEN RAISE EXCEPTION 'Convite já utilizado'; END IF;
  IF v_row.expira_em < now() THEN RAISE EXCEPTION 'Convite expirado'; END IF;

  SELECT id INTO v_pessoa_id FROM public.pessoas
   WHERE status = 'ativo' AND email IS NOT NULL AND lower(email) = lower(v_row.email) LIMIT 1;

  IF v_pessoa_id IS NULL THEN
    INSERT INTO public.pessoas (nome_completo, email, telefone, data_nascimento, status)
    VALUES (trim(p_nome), v_row.email, nullif(trim(p_telefone),''), p_data_nascimento, 'ativo')
    RETURNING id INTO v_pessoa_id;
  ELSE
    UPDATE public.pessoas
       SET nome_completo = trim(p_nome),
           telefone = COALESCE(nullif(trim(p_telefone),''), telefone),
           data_nascimento = COALESCE(p_data_nascimento, data_nascimento)
     WHERE id = v_pessoa_id;
  END IF;

  UPDATE public.convites SET usado_em = now(), pessoa_id = v_pessoa_id WHERE id = v_row.id;
  RETURN jsonb_build_object('ok', true, 'pessoa_id', v_pessoa_id, 'email', v_row.email);
END;
$$;
GRANT EXECUTE ON FUNCTION public.convite_consumir(text, text, text, date) TO anon, authenticated;

INSERT INTO public.email_templates (chave, nome, descricao, assunto, conteudo_html, variaveis, ativo)
VALUES (
  'convite_membro',
  'Convite de membro',
  'Enviado quando um membro é convidado para se registar na plataforma.',
  'Foste convidado(a) para a Meeru',
  '<p>Olá,</p><p>Foste convidado(a) para te juntares à plataforma Meeru.</p><p>Para completares o teu registo, clica no link abaixo e preenche os teus dados:</p><p><a href="{{convite_url}}">{{convite_url}}</a></p><p>Este convite expira a {{expira_em}}.</p><p>Bem-vindo(a)!</p>',
  '["convite_url","email","expira_em"]'::jsonb,
  true
)
ON CONFLICT (chave) DO NOTHING;