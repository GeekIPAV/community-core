CREATE TABLE public.atividade_registos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atividade_id uuid NOT NULL REFERENCES public.atividades_catalogo(id) ON DELETE CASCADE,
  data date,
  descricao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atividade_registos TO authenticated;
GRANT ALL ON public.atividade_registos TO service_role;
ALTER TABLE public.atividade_registos ENABLE ROW LEVEL SECURITY;
CREATE POLICY atividade_registos_staff_all ON public.atividade_registos FOR ALL TO authenticated USING (is_current_user_staff()) WITH CHECK (is_current_user_staff());

CREATE TABLE public.atividade_registo_participantes (
  atividade_registo_id uuid NOT NULL REFERENCES public.atividade_registos(id) ON DELETE CASCADE,
  pessoa_id uuid NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (atividade_registo_id, pessoa_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atividade_registo_participantes TO authenticated;
GRANT ALL ON public.atividade_registo_participantes TO service_role;
ALTER TABLE public.atividade_registo_participantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY arp_staff_all ON public.atividade_registo_participantes FOR ALL TO authenticated USING (is_current_user_staff()) WITH CHECK (is_current_user_staff());
CREATE POLICY arp_self_select ON public.atividade_registo_participantes FOR SELECT TO authenticated USING (pessoa_id = current_user_pessoa_id());

CREATE TABLE public.atividade_registo_voluntarios (
  atividade_registo_id uuid NOT NULL REFERENCES public.atividade_registos(id) ON DELETE CASCADE,
  pessoa_id uuid NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (atividade_registo_id, pessoa_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atividade_registo_voluntarios TO authenticated;
GRANT ALL ON public.atividade_registo_voluntarios TO service_role;
ALTER TABLE public.atividade_registo_voluntarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY arv_staff_all ON public.atividade_registo_voluntarios FOR ALL TO authenticated USING (is_current_user_staff()) WITH CHECK (is_current_user_staff());
CREATE POLICY arv_self_select ON public.atividade_registo_voluntarios FOR SELECT TO authenticated USING (pessoa_id = current_user_pessoa_id());

CREATE INDEX idx_atividade_registos_atividade ON public.atividade_registos(atividade_id);
CREATE INDEX idx_arp_pessoa ON public.atividade_registo_participantes(pessoa_id);
CREATE INDEX idx_arv_pessoa ON public.atividade_registo_voluntarios(pessoa_id);

CREATE TRIGGER atividade_registos_touch BEFORE UPDATE ON public.atividade_registos
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Backfill a partir do modelo antigo (por família)
INSERT INTO public.atividade_registos (id, atividade_id, data, descricao, created_by, created_at)
SELECT fa.id, fa.atividade_id, fa.data, fa.descricao, fa.created_by, fa.created_at
FROM public.familia_atividades fa;

INSERT INTO public.atividade_registo_participantes (atividade_registo_id, pessoa_id)
SELECT DISTINCT fa.id, p.id
FROM public.familia_atividades fa
JOIN public.pessoas p ON p.familia_id = fa.familia_id AND p.status = 'ativo' AND p.deleted_at IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.atividade_registo_voluntarios (atividade_registo_id, pessoa_id)
SELECT DISTINCT fav.familia_atividade_id, fav.pessoa_id
FROM public.familia_atividade_voluntarios fav
JOIN public.atividade_registos ar ON ar.id = fav.familia_atividade_id
ON CONFLICT DO NOTHING;