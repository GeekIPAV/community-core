import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type EquipaPessoa = { id: string; nome_completo: string };

/**
 * Pessoas com o perfil "Equipa", considerando tipos cumulativos:
 * o tipo principal (pessoas.tipo_user_id) e os tipos adicionais (pessoa_tipos).
 * Admins são sempre incluídos.
 */
export async function fetchEquipa(opts?: { exigirConta?: boolean }): Promise<EquipaPessoa[]> {
  const { data: tipos, error: eT } = await supabase.from("tipos_user").select("id, nome");
  if (eT) throw eT;
  const equipaIds = new Set(
    ((tipos ?? []) as { id: string; nome: string | null }[])
      .filter((t) => (t.nome ?? "").trim().toLowerCase() === "equipa")
      .map((t) => t.id),
  );

  let q = supabase
    .from("pessoas")
    .select("id, nome_completo, is_admin, tipo_user_id")
    .eq("status", "ativo")
    .is("deleted_at", null)
    .order("nome_completo");
  if (opts?.exigirConta) q = q.not("auth_user_id", "is", null);
  const { data: pessoas, error } = await q;
  if (error) throw error;

  const rows = (pessoas ?? []) as Array<{
    id: string;
    nome_completo: string;
    is_admin: boolean;
    tipo_user_id: string | null;
  }>;

  const extra = new Set<string>();
  if (equipaIds.size > 0) {
    const { data: pt } = await supabase
      .from("pessoa_tipos")
      .select("pessoa_id, tipo_user_id")
      .in("tipo_user_id", Array.from(equipaIds));
    for (const r of (pt ?? []) as { pessoa_id: string }[]) extra.add(r.pessoa_id);
  }

  return rows
    .filter((p) => p.is_admin || (p.tipo_user_id && equipaIds.has(p.tipo_user_id)) || extra.has(p.id))
    .map((p) => ({ id: p.id, nome_completo: p.nome_completo }));
}

export function useEquipaLookup(enabled = true, opts?: { exigirConta?: boolean }) {
  return useQuery({
    enabled,
    queryKey: ["equipa-lookup", opts?.exigirConta ?? false],
    queryFn: () => fetchEquipa(opts),
  });
}
