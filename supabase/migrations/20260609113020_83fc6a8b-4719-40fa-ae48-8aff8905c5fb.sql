ALTER TABLE public.pessoas ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
ALTER TABLE public.familias ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
CREATE INDEX IF NOT EXISTS idx_pessoas_deleted_at ON public.pessoas(deleted_at);
CREATE INDEX IF NOT EXISTS idx_familias_deleted_at ON public.familias(deleted_at);