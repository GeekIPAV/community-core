import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, X, Tag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export type Etiqueta = { id: string; nome: string; cor: string };

const COR_CLASSES: Record<string, string> = {
  gray: "bg-muted text-muted-foreground border-border",
  blue: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-900",
  green: "bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-900",
  yellow: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-900",
  red: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900",
  purple: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-900",
};
const COR_OPTS = Object.keys(COR_CLASSES);

export function etiquetaClass(cor: string | null | undefined) {
  return COR_CLASSES[cor ?? "gray"] ?? COR_CLASSES.gray;
}

export function useEtiquetas() {
  return useQuery({
    queryKey: ["etiquetas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("etiquetas").select("id, nome, cor").order("nome");
      if (error) throw error;
      return (data ?? []) as Etiqueta[];
    },
  });
}

export function EtiquetasPicker({ pessoaId }: { pessoaId: string }) {
  const qc = useQueryClient();
  const { data: catalogo } = useEtiquetas();

  const { data: ligacoes } = useQuery({
    queryKey: ["pessoa-etiquetas", pessoaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoa_etiquetas")
        .select("etiqueta_id")
        .eq("pessoa_id", pessoaId);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.etiqueta_id as string);
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["pessoa-etiquetas", pessoaId] });
    qc.invalidateQueries({ queryKey: ["pessoa-etiquetas-all"] });
  };

  const add = useMutation({
    mutationFn: async (etiqueta_id: string) => {
      const { error } = await supabase.from("pessoa_etiquetas").insert({ pessoa_id: pessoaId, etiqueta_id });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (etiqueta_id: string) => {
      const { error } = await supabase.from("pessoa_etiquetas").delete()
        .eq("pessoa_id", pessoaId).eq("etiqueta_id", etiqueta_id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const ativas = new Set(ligacoes ?? []);
  const ativasEt = (catalogo ?? []).filter((e) => ativas.has(e.id));
  const disponiveis = (catalogo ?? []).filter((e) => !ativas.has(e.id));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {ativasEt.length === 0 && <p className="text-sm text-muted-foreground">Sem etiquetas atribuídas.</p>}
        {ativasEt.map((e) => (
          <Badge key={e.id} variant="outline" className={`gap-1 ${etiquetaClass(e.cor)}`}>
            <Tag className="h-3 w-3" />
            {e.nome}
            <button onClick={() => remove.mutate(e.id)} className="ml-1 opacity-70 hover:opacity-100" aria-label="remover">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {disponiveis.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm"><Plus className="mr-1 h-4 w-4" /> Atribuir etiqueta</Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <div className="flex flex-wrap gap-1.5">
                {disponiveis.map((e) => (
                  <button key={e.id} onClick={() => add.mutate(e.id)}>
                    <Badge variant="outline" className={`cursor-pointer ${etiquetaClass(e.cor)}`}>{e.nome}</Badge>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
        <CriarEtiquetaInline />
      </div>
    </div>
  );
}

function CriarEtiquetaInline() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("gray");

  const criar = useMutation({
    mutationFn: async () => {
      const n = nome.trim();
      if (!n) throw new Error("Nome obrigatório");
      const { error } = await supabase.from("etiquetas").insert({ nome: n, cor });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Etiqueta criada");
      setNome(""); setCor("gray"); setOpen(false);
      qc.invalidateQueries({ queryKey: ["etiquetas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Plus className="mr-1 h-4 w-4" /> Nova etiqueta
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2" align="start">
        <Input placeholder="Nome da etiqueta" value={nome} onChange={(e) => setNome(e.target.value)} />
        <div className="flex flex-wrap gap-1.5">
          {COR_OPTS.map((c) => (
            <button key={c} onClick={() => setCor(c)} aria-label={c}
              className={`h-6 w-6 rounded-full border-2 ${etiquetaClass(c)} ${cor === c ? "ring-2 ring-ring" : ""}`} />
          ))}
        </div>
        <Button size="sm" className="w-full" disabled={criar.isPending || !nome.trim()} onClick={() => criar.mutate()}>
          {criar.isPending ? "A criar…" : "Criar"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}