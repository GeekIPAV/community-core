
-- 1) Categoria nas ações
ALTER TABLE public.acoes ADD COLUMN IF NOT EXISTS categoria text;
CREATE INDEX IF NOT EXISTS idx_acoes_categoria ON public.acoes(categoria);

-- 2) Filtro + estado nos KPIs
ALTER TABLE public.projeto_kpis ADD COLUMN IF NOT EXISTS filtro jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.projeto_kpis ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'em_execucao';

ALTER TABLE public.projeto_kpis DROP CONSTRAINT IF EXISTS projeto_kpis_fonte_check;
ALTER TABLE public.projeto_kpis ADD CONSTRAINT projeto_kpis_fonte_check
  CHECK (fonte = ANY (ARRAY['acoes','atividades','participantes','manual','inscricoes','auto_total_unicos']));

ALTER TABLE public.projeto_kpis DROP CONSTRAINT IF EXISTS projeto_kpis_estado_check;
ALTER TABLE public.projeto_kpis ADD CONSTRAINT projeto_kpis_estado_check
  CHECK (estado = ANY (ARRAY['por_iniciar','em_execucao','concluido']));

-- 3) Seed dos 19 indicadores Gulbenkian
WITH novos(projeto_id, nome, meta, unidade, fonte, filtro, estado, position) AS (
  VALUES
    -- APROXIMA (a6e4b442-b6ce-4e2b-abc8-ac2b3462e572)
    ('a6e4b442-b6ce-4e2b-abc8-ac2b3462e572'::uuid, 'Pessoas imigrantes diretamente envolvidas (indivíduos únicos)', 200::numeric, 'participantes', 'participantes', '{"imigrante":true}'::jsonb, 'em_execucao', 1),
    ('a6e4b442-b6ce-4e2b-abc8-ac2b3462e572'::uuid, 'Pessoas imigrantes com participação regular (≥3 atividades)', 80::numeric, 'participantes', 'participantes', '{"imigrante":true,"regular":3}'::jsonb, 'em_execucao', 2),
    ('a6e4b442-b6ce-4e2b-abc8-ac2b3462e572'::uuid, 'Pessoas imigrantes que mitigaram problemas identificados', 120::numeric, 'pessoas', 'manual', '{}'::jsonb, 'por_iniciar', 3),
    ('a6e4b442-b6ce-4e2b-abc8-ac2b3462e572'::uuid, 'Voluntários diretamente envolvidos', 50::numeric, 'voluntários', 'participantes', '{"voluntario":true}'::jsonb, 'em_execucao', 4),
    ('a6e4b442-b6ce-4e2b-abc8-ac2b3462e572'::uuid, 'Voluntários com participação regular (≥3 momentos)', 30::numeric, 'voluntários', 'participantes', '{"voluntario":true,"regular":3}'::jsonb, 'por_iniciar', 5),
    ('a6e4b442-b6ce-4e2b-abc8-ac2b3462e572'::uuid, 'Encontros de Proximidade realizados (jantares)', 12::numeric, 'jantares', 'acoes', '{"categoria":"jantar"}'::jsonb, 'em_execucao', 6),
    ('a6e4b442-b6ce-4e2b-abc8-ac2b3462e572'::uuid, 'Ações de mediação, encaminhamento e tradução', 50::numeric, 'ações', 'acoes', '{"categoria":"mediacao"}'::jsonb, 'em_execucao', 7),
    ('a6e4b442-b6ce-4e2b-abc8-ac2b3462e572'::uuid, 'Sessões MEERU Convida Amigos realizadas', 6::numeric, 'sessões', 'acoes', '{"categoria":"mca"}'::jsonb, 'por_iniciar', 8),
    ('a6e4b442-b6ce-4e2b-abc8-ac2b3462e572'::uuid, 'Participantes indiretos abrangidos', 600::numeric, 'pessoas', 'manual', '{}'::jsonb, 'por_iniciar', 9),
    ('a6e4b442-b6ce-4e2b-abc8-ac2b3462e572'::uuid, 'Total de pessoas envolvidas (diretos únicos)', 1250::numeric, 'pessoas', 'auto_total_unicos', '{}'::jsonb, 'em_execucao', 10),
    ('a6e4b442-b6ce-4e2b-abc8-ac2b3462e572'::uuid, 'Horas de voluntariado registadas', 1368::numeric, 'horas', 'manual', '{}'::jsonb, 'em_execucao', 11),

    -- ACADEMIA AMAL
    ('e79eee85-d95d-463b-b9af-a5c3e55a7ba0'::uuid, 'Participantes em workshops AMAL SOAP / MESA', 200::numeric, 'participantes', 'inscricoes', '{"categoria":"workshop","projeto_ids":["af1175b4-555e-4596-98b0-c98789b12481","aac9e909-bfb9-4f5d-bf3d-09694509513a"]}'::jsonb, 'em_execucao', 1),

    -- EVENTOS INTERCULTURAIS
    ('fe6ce326-4aed-4106-889e-36ec991f95f9'::uuid, 'Participantes em eventos comunitários e sensibilização', 200::numeric, 'participantes', 'inscricoes', '{"categoria":"evento_comunitario"}'::jsonb, 'em_execucao', 1),
    ('fe6ce326-4aed-4106-889e-36ec991f95f9'::uuid, 'Eventos Comunitários Interculturais realizados', 6::numeric, 'eventos', 'acoes', '{"categoria":"intercultural"}'::jsonb, 'por_iniciar', 2),

    -- AMAL SOAP
    ('af1175b4-555e-4596-98b0-c98789b12481'::uuid, 'Mulheres na AMAL SOAP', 10::numeric, 'mulheres', 'participantes', '{"mulheres":true}'::jsonb, 'em_execucao', 1),

    -- MESA
    ('aac9e909-bfb9-4f5d-bf3d-09694509513a'::uuid, 'Mulheres no MESA', 20::numeric, 'mulheres', 'participantes', '{"mulheres":true}'::jsonb, 'por_iniciar', 1),

    -- AFAQ
    ('da013cdc-193a-4f71-abd6-ab25bb819d81'::uuid, 'Mulheres na AFAQ', 20::numeric, 'mulheres', 'participantes', '{"mulheres":true}'::jsonb, 'em_execucao', 1),

    -- RECONSTRUIR
    ('808f91cc-8a93-448a-a5c8-3ce209563d2e'::uuid, 'Artigos publicados no Observatório MEERU', 6::numeric, 'artigos', 'manual', '{}'::jsonb, 'por_iniciar', 1),
    ('808f91cc-8a93-448a-a5c8-3ce209563d2e'::uuid, 'Plataforma comunitária digital lançada', 1::numeric, 'plataforma', 'manual', '{}'::jsonb, 'em_execucao', 2)
)
INSERT INTO public.projeto_kpis (projeto_id, nome, meta, unidade, fonte, filtro, estado, position)
SELECT n.projeto_id, n.nome, n.meta, n.unidade, n.fonte, n.filtro, n.estado, n.position
FROM novos n
WHERE NOT EXISTS (
  SELECT 1 FROM public.projeto_kpis k
  WHERE k.projeto_id = n.projeto_id AND k.nome = n.nome
);
