import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MapaKmRow } from "./types";

export function useMapaKm() {
  return useQuery({
    queryKey: ["mapa-km"],
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mapa_km")
        .select("*, familias(nome), acoes(nome)")
        .order("data", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as Array<MapaKmRow & { familias: { nome: string } | null; acoes: { nome: string } | null }>).map((r) => ({
        ...r,
        familia_nome: r.familias?.nome ?? "—",
        acao_nome: r.acoes?.nome ?? null,
      })) as MapaKmRow[];
    },
  });
}

export function useFolhasKm() {
  return useQuery({
    queryKey: ["folhas-km"],
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folhas_km")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useFamiliasLista() {
  return useQuery({
    queryKey: ["familias-lista-bolsa"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("familias")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string }[];
    },
  });
}
