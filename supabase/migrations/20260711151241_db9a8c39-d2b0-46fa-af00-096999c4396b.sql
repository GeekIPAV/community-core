DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bolsas_pagamentos' AND cmd='DELETE') THEN
    EXECUTE 'CREATE POLICY "Allow authenticated delete on bolsas_pagamentos" ON public.bolsas_pagamentos FOR DELETE TO authenticated USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mapa_km' AND cmd='DELETE') THEN
    EXECUTE 'CREATE POLICY "Allow authenticated delete on mapa_km" ON public.mapa_km FOR DELETE TO authenticated USING (true)';
  END IF;
END $$;