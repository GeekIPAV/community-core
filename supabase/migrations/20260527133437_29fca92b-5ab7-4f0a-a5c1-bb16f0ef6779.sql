ALTER TABLE public.pessoas
  ADD COLUMN genero text,
  ADD COLUMN nacionalidade text,
  ADD COLUMN cidade_residencia text,
  ADD COLUMN religiao text;

ALTER TABLE public.pessoas
  ADD CONSTRAINT pessoas_genero_check CHECK (genero IS NULL OR genero IN ('Masculino', 'Feminino'));