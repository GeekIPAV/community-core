
CREATE OR REPLACE FUNCTION public.recalcular_total_pagamento(p_pagamento_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_pagamento_id IS NULL THEN RETURN; END IF;
  UPDATE public.pagamentos p
  SET total = COALESCE((
    SELECT SUM(
      COALESCE(r.preco_unitario_override, ts.preco_unitario, 0) * COALESCE(r.quantidade, 0)
      + COALESCE(r.outros_custos, 0)
    )
    FROM public.registos_servico r
    LEFT JOIN public.tipos_servico ts ON ts.id = r.tipo_servico_id
    WHERE r.pagamento_id = p_pagamento_id
  ), 0)
  WHERE p.id = p_pagamento_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_registos_recalc_pagamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recalcular_total_pagamento(NEW.pagamento_id);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.recalcular_total_pagamento(NEW.pagamento_id);
    IF OLD.pagamento_id IS DISTINCT FROM NEW.pagamento_id THEN
      PERFORM public.recalcular_total_pagamento(OLD.pagamento_id);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recalcular_total_pagamento(OLD.pagamento_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_registos_recalc_pagamento ON public.registos_servico;
CREATE TRIGGER trg_registos_recalc_pagamento
AFTER INSERT OR UPDATE OF pagamento_id, preco_unitario_override, quantidade, outros_custos, tipo_servico_id
OR DELETE
ON public.registos_servico
FOR EACH ROW EXECUTE FUNCTION public.trg_registos_recalc_pagamento();

-- Recalcular todos os pagamentos existentes
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.pagamentos LOOP
    PERFORM public.recalcular_total_pagamento(r.id);
  END LOOP;
END $$;
