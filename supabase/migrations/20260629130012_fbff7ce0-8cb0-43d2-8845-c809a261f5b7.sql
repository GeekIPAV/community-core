
-- Link financiamentos.financiador to parceiros (entidades)
ALTER TABLE public.financiamentos
  ADD COLUMN IF NOT EXISTS financiador_id uuid REFERENCES public.parceiros(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_financiamentos_financiador_id ON public.financiamentos(financiador_id);

-- Backfill: create missing parceiros for each distinct financiador text
INSERT INTO public.parceiros (nome, tipo, estado)
SELECT DISTINCT trim(f.financiador), 'Financiador', 'Ativa'
  FROM public.financiamentos f
 WHERE f.financiador IS NOT NULL
   AND length(trim(f.financiador)) > 0
   AND NOT EXISTS (
     SELECT 1 FROM public.parceiros p
      WHERE lower(trim(p.nome)) = lower(trim(f.financiador))
   );

-- Link financiamentos to matching parceiro by name
UPDATE public.financiamentos f
   SET financiador_id = p.id
  FROM public.parceiros p
 WHERE f.financiador_id IS NULL
   AND f.financiador IS NOT NULL
   AND lower(trim(p.nome)) = lower(trim(f.financiador));
