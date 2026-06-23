import { toast } from "sonner";

/**
 * Mostra um toast de erro em PT-PT a partir de um erro do Supabase ou
 * de uma exceção genérica. Reconhece os códigos mais comuns para
 * mensagens compreensíveis.
 */
export function handleSupabaseError(e: unknown, fallback = "Ocorreu um erro inesperado") {
  const msg = friendlyMessage(e, fallback);
  toast.error(msg);
  // mantém o stack na consola para debug
  // eslint-disable-next-line no-console
  console.error("[supabase]", e);
  return msg;
}

export function friendlyMessage(e: unknown, fallback = "Ocorreu um erro inesperado"): string {
  if (!e) return fallback;
  const err = e as { code?: string; message?: string; details?: string; hint?: string };
  const code = err.code ?? "";
  const raw = (err.message ?? "").toLowerCase();

  // Códigos Postgres mais frequentes
  if (code === "23505") return "Já existe um registo com esses dados (duplicado).";
  if (code === "23503") return "Não é possível concluir: existem registos associados.";
  if (code === "23502") return "Faltam campos obrigatórios.";
  if (code === "23514") return "Os dados não cumprem as regras de validação.";
  if (code === "42501" || raw.includes("permission denied") || raw.includes("rls")) {
    return "Sem permissões para executar esta ação.";
  }
  if (code === "PGRST116") return "Registo não encontrado.";
  if (raw.includes("jwt") || raw.includes("not authenticated")) {
    return "Sessão expirada. Volta a entrar.";
  }
  if (raw.includes("network") || raw.includes("failed to fetch")) {
    return "Sem ligação. Verifica a internet e tenta de novo.";
  }

  return err.message || fallback;
}