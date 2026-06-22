
-- 1) Trigger to free linked registos when a pagamento is deleted
CREATE OR REPLACE FUNCTION public.pagamento_libertar_registos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.registos_servico
     SET pagamento_id = NULL,
         estado = 'aprovado'
   WHERE pagamento_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_pagamento_libertar_registos ON public.pagamentos;
CREATE TRIGGER trg_pagamento_libertar_registos
BEFORE DELETE ON public.pagamentos
FOR EACH ROW EXECUTE FUNCTION public.pagamento_libertar_registos();

-- 2) Aggregated notification for admins
CREATE OR REPLACE FUNCTION public.notificar_servicos_por_pagar(p_window_days int DEFAULT 7)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count int := 0;
  v_servicos int;
  v_colabs int;
  v_total numeric;
  v_admin record;
  v_descricao text;
BEGIN
  SELECT COUNT(*),
         COUNT(DISTINCT r.colaborador_id),
         COALESCE(SUM(
           COALESCE(r.preco_unitario_override, ts.preco_unitario) * r.quantidade
           + COALESCE(r.outros_custos, 0)
         ), 0)
    INTO v_servicos, v_colabs, v_total
    FROM public.registos_servico r
    JOIN public.tipos_servico ts ON ts.id = r.tipo_servico_id
   WHERE r.estado IN ('pendente', 'aprovado')
     AND r.created_at < now() - (p_window_days || ' days')::interval;

  IF v_servicos = 0 THEN
    RETURN 0;
  END IF;

  v_descricao := 'Há ' || v_servicos || ' serviços pendentes de ' || v_colabs
              || ' colaboradoras. Total por liquidar: €'
              || to_char(v_total, 'FM999G999G990D00');

  FOR v_admin IN
    SELECT p.auth_user_id
      FROM public.pessoas p
     WHERE p.is_admin = true
       AND p.auth_user_id IS NOT NULL
       AND p.status = 'ativo'
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.notificacoes
       WHERE tipo = 'servicos_por_pagar'
         AND recipient_auth_id = v_admin.auth_user_id
         AND created_at > now() - (p_window_days || ' days')::interval
    ) THEN
      CONTINUE;
    END IF;
    INSERT INTO public.notificacoes (recipient_auth_id, tipo, titulo, descricao, link)
    VALUES (v_admin.auth_user_id, 'servicos_por_pagar',
            '⚠️ Serviços por pagar', v_descricao, '/servicos');
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notificar_servicos_por_pagar(int) TO authenticated;

-- 3) Per-collaborator nudge (called immediately after creating a pendente)
CREATE OR REPLACE FUNCTION public.notificar_nova_entrada_pendente(p_colaborador_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count int := 0;
  v_servicos int;
  v_total numeric;
  v_nome text;
  v_admin record;
  v_descricao text;
BEGIN
  SELECT c.nome_completo INTO v_nome FROM public.colaboradores c WHERE c.id = p_colaborador_id;

  SELECT COUNT(*),
         COALESCE(SUM(
           COALESCE(r.preco_unitario_override, ts.preco_unitario) * r.quantidade
           + COALESCE(r.outros_custos, 0)
         ), 0)
    INTO v_servicos, v_total
    FROM public.registos_servico r
    JOIN public.tipos_servico ts ON ts.id = r.tipo_servico_id
   WHERE r.colaborador_id = p_colaborador_id
     AND r.estado IN ('pendente', 'aprovado')
     AND r.created_at < now() - interval '14 days';

  IF v_servicos = 0 THEN
    RETURN 0;
  END IF;

  v_descricao := 'Nova entrada pendente — ' || COALESCE(v_nome, 'Colaborador')
              || ' tem ' || v_servicos || ' serviços por pagar (total €'
              || to_char(v_total, 'FM999G999G990D00') || ')';

  FOR v_admin IN
    SELECT p.auth_user_id
      FROM public.pessoas p
     WHERE p.is_admin = true
       AND p.auth_user_id IS NOT NULL
       AND p.status = 'ativo'
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.notificacoes
       WHERE tipo = 'servicos_por_pagar'
         AND recipient_auth_id = v_admin.auth_user_id
         AND descricao = v_descricao
         AND created_at > now() - interval '7 days'
    ) THEN
      CONTINUE;
    END IF;
    INSERT INTO public.notificacoes (recipient_auth_id, tipo, titulo, descricao, link)
    VALUES (v_admin.auth_user_id, 'servicos_por_pagar',
            '⚠️ Serviços por pagar', v_descricao, '/servicos');
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notificar_nova_entrada_pendente(uuid) TO authenticated;

-- 4) Weekly cron: Monday 08:00 UTC (~09:00 Lisbon)
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'servicos_por_pagar_semanal') THEN
    PERFORM cron.unschedule('servicos_por_pagar_semanal');
  END IF;
END $$;

SELECT cron.schedule(
  'servicos_por_pagar_semanal',
  '0 8 * * 1',
  $$ SELECT public.notificar_servicos_por_pagar(7); $$
);
