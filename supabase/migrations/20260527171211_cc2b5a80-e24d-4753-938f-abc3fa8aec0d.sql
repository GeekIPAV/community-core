ALTER TABLE public.familias
  ADD COLUMN status text NOT NULL DEFAULT 'Sem estado'
  CHECK (status IN ('Sem estado','Em espera','No programa','Não interessada','Concluído','Fora do País'));