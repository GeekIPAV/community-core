CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  assunto text NOT NULL,
  conteudo_html text NOT NULL DEFAULT '',
  variaveis jsonb NOT NULL DEFAULT '[]'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff pode ver templates" ON public.email_templates
  FOR SELECT TO authenticated USING (public.is_current_user_staff());

CREATE POLICY "Staff pode gerir templates" ON public.email_templates
  FOR ALL TO authenticated
  USING (public.is_current_user_staff())
  WITH CHECK (public.is_current_user_staff());

CREATE TRIGGER email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.email_templates (chave, nome, descricao, assunto, conteudo_html, variaveis) VALUES
  ('inscricao_confirmacao',
   'Confirmação de inscrição',
   'Enviado ao participante imediatamente após inscrição numa ação.',
   'Inscrição confirmada — {{acao_nome}}',
   '<p>Olá <strong>{{pessoa_nome}}</strong>,</p><p>A tua inscrição em <strong>{{acao_nome}}</strong> foi confirmada.</p><p><strong>Data:</strong> {{acao_data}}<br/><strong>Local:</strong> {{acao_local}}</p><p>Até breve!<br/>Equipa Meeru</p>',
   '["pessoa_nome","pessoa_email","acao_nome","acao_data","acao_local"]'::jsonb),
  ('lembrete_24h',
   'Lembrete 24h antes',
   'Enviado automaticamente 24 horas antes do início da ação.',
   'Lembrete: {{acao_nome}} é amanhã',
   '<p>Olá <strong>{{pessoa_nome}}</strong>,</p><p>Este é um lembrete que <strong>{{acao_nome}}</strong> acontece amanhã.</p><p><strong>Data:</strong> {{acao_data}}<br/><strong>Local:</strong> {{acao_local}}</p><p>Contamos contigo!<br/>Equipa Meeru</p>',
   '["pessoa_nome","pessoa_email","acao_nome","acao_data","acao_local"]'::jsonb),
  ('followup_pos_evento',
   'Follow-up pós-evento',
   'Enviado 1 dia depois do fim da ação para agradecer a participação.',
   'Obrigado por participares em {{acao_nome}}',
   '<p>Olá <strong>{{pessoa_nome}}</strong>,</p><p>Obrigado por participares em <strong>{{acao_nome}}</strong>. Esperamos que tenha sido uma boa experiência.</p><p>Até à próxima!<br/>Equipa Meeru</p>',
   '["pessoa_nome","pessoa_email","acao_nome","acao_data","acao_local"]'::jsonb);
