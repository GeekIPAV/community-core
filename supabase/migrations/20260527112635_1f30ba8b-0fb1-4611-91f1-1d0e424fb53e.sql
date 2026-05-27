
-- Enums
CREATE TYPE public.status_pessoa AS ENUM ('ativo', 'suspeito_duplicado', 'fundido');
CREATE TYPE public.status_inscricao AS ENUM ('confirmada', 'cancelada', 'pendente');

-- Tabela: familias
CREATE TABLE public.familias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.familias TO authenticated;
GRANT ALL ON public.familias TO service_role;

ALTER TABLE public.familias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all_familias" ON public.familias
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabela: pessoas
CREATE TABLE public.pessoas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id uuid REFERENCES public.familias(id) ON DELETE SET NULL,
  nome_completo text NOT NULL,
  email text,
  nif text,
  data_nascimento date,
  telefone text,
  notas text,
  status public.status_pessoa NOT NULL DEFAULT 'ativo',
  fundido_em uuid REFERENCES public.pessoas(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pessoas_familia_id ON public.pessoas (familia_id);
CREATE INDEX idx_pessoas_email ON public.pessoas (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX idx_pessoas_nome_dob ON public.pessoas (lower(nome_completo), data_nascimento) WHERE data_nascimento IS NOT NULL;
CREATE INDEX idx_pessoas_nif ON public.pessoas (nif) WHERE nif IS NOT NULL;
CREATE INDEX idx_pessoas_status ON public.pessoas (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pessoas TO authenticated;
GRANT ALL ON public.pessoas TO service_role;

ALTER TABLE public.pessoas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all_pessoas" ON public.pessoas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabela: acoes
CREATE TABLE public.acoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  data_inicio timestamptz,
  data_fim timestamptz,
  local text,
  config_campos jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.acoes TO authenticated;
GRANT ALL ON public.acoes TO service_role;

ALTER TABLE public.acoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all_acoes" ON public.acoes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabela: inscricoes
CREATE TABLE public.inscricoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id uuid NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
  acao_id uuid NOT NULL REFERENCES public.acoes(id) ON DELETE CASCADE,
  status public.status_inscricao NOT NULL DEFAULT 'confirmada',
  valores_dinamicos jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inscricoes_pessoa ON public.inscricoes (pessoa_id);
CREATE INDEX idx_inscricoes_acao ON public.inscricoes (acao_id);

-- Unicidade parcial: 1 inscrição ativa por (pessoa, ação)
CREATE UNIQUE INDEX uniq_inscricao_ativa
  ON public.inscricoes (pessoa_id, acao_id)
  WHERE status <> 'cancelada';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inscricoes TO authenticated;
GRANT ALL ON public.inscricoes TO service_role;

ALTER TABLE public.inscricoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all_inscricoes" ON public.inscricoes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger genérico para updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_familias_updated_at BEFORE UPDATE ON public.familias
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_pessoas_updated_at BEFORE UPDATE ON public.pessoas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_acoes_updated_at BEFORE UPDATE ON public.acoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_inscricoes_updated_at BEFORE UPDATE ON public.inscricoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger Soft-Match: marca como suspeito_duplicado quando há colisão
CREATE OR REPLACE FUNCTION public.detect_pessoa_duplicado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só aplica em inserts onde o status veio como 'ativo' (default)
  IF NEW.status = 'ativo' THEN
    IF (
      NEW.email IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.pessoas
        WHERE status = 'ativo'
          AND email IS NOT NULL
          AND lower(email) = lower(NEW.email)
      )
    ) OR (
      NEW.data_nascimento IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.pessoas
        WHERE status = 'ativo'
          AND data_nascimento = NEW.data_nascimento
          AND lower(nome_completo) = lower(NEW.nome_completo)
      )
    ) THEN
      NEW.status := 'suspeito_duplicado';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pessoas_soft_match
  BEFORE INSERT ON public.pessoas
  FOR EACH ROW EXECUTE FUNCTION public.detect_pessoa_duplicado();

-- View: pessoas_com_stats
CREATE VIEW public.pessoas_com_stats
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.familia_id,
  p.nome_completo,
  p.email,
  p.nif,
  p.data_nascimento,
  p.telefone,
  p.notas,
  p.status,
  p.fundido_em,
  p.created_at,
  p.updated_at,
  COALESCE(i.total, 0) AS inscricoes_count,
  i.ultima_acao_em,
  f.nome AS familia_nome,
  CASE
    WHEN p.familia_id IS NOT NULL THEN 'Família'
    WHEN COALESCE(i.total, 0) = 1 THEN 'Único'
    ELSE 'Isolada'
  END AS tipo_participante
FROM public.pessoas p
LEFT JOIN public.familias f ON f.id = p.familia_id
LEFT JOIN (
  SELECT
    i.pessoa_id,
    COUNT(*)::int AS total,
    MAX(COALESCE(a.data_inicio, a.created_at)) AS ultima_acao_em
  FROM public.inscricoes i
  JOIN public.acoes a ON a.id = i.acao_id
  WHERE i.status <> 'cancelada'
  GROUP BY i.pessoa_id
) i ON i.pessoa_id = p.id;

GRANT SELECT ON public.pessoas_com_stats TO authenticated;

-- RPC: fundir_perfis (atómica)
CREATE OR REPLACE FUNCTION public.fundir_perfis(principal uuid, duplicado uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF principal = duplicado THEN
    RAISE EXCEPTION 'O perfil principal e o duplicado não podem ser o mesmo';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.pessoas WHERE id = principal) THEN
    RAISE EXCEPTION 'Perfil principal não encontrado';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pessoas WHERE id = duplicado) THEN
    RAISE EXCEPTION 'Perfil duplicado não encontrado';
  END IF;

  -- Move inscrições do duplicado para o principal, evitando colidir com unique parcial
  UPDATE public.inscricoes
     SET pessoa_id = principal
   WHERE pessoa_id = duplicado
     AND NOT EXISTS (
       SELECT 1 FROM public.inscricoes i2
       WHERE i2.pessoa_id = principal
         AND i2.acao_id = public.inscricoes.acao_id
         AND i2.status <> 'cancelada'
     );

  -- Inscrições remanescentes (duplicadas activas no principal) são canceladas
  UPDATE public.inscricoes
     SET status = 'cancelada'
   WHERE pessoa_id = duplicado;

  -- Marca o duplicado como fundido
  UPDATE public.pessoas
     SET status = 'fundido',
         fundido_em = principal
   WHERE id = duplicado;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fundir_perfis(uuid, uuid) TO authenticated;
