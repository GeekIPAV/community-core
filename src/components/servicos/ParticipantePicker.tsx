import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { toast } from "sonner";
import { UserPlus, X } from "lucide-react";
import type { PessoaLite } from "./types";

export function ParticipantePicker({
  value,
  label,
  onChange,
  inline = false,
}: {
  value: string | null;
  label: string | null;
  onChange: (pessoaId: string | null) => void | Promise<unknown>;
  inline?: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const { data: current } = useQuery({
    queryKey: ["pessoa_lite", value],
    enabled: !!value && !label,
    queryFn: async () => {
      const { data, error } = await supabase.from("pessoas").select("id, nome_completo").eq("id", value!).maybeSingle();
      if (error) throw error;
      return data as { id: string; nome_completo: string } | null;
    },
  });

  const { data: results, isFetching } = useQuery({
    queryKey: ["pessoas_search", q],
    enabled: open,
    queryFn: async () => {
      let qb = supabase.from("pessoas").select("id, nome_completo, email").eq("status", "ativo").order("nome_completo").limit(20);
      if (q.trim()) qb = qb.or(`nome_completo.ilike.%${q}%,email.ilike.%${q}%`);
      const { data, error } = await qb;
      if (error) throw error;
      return data as PessoaLite[];
    },
  });

  const create = useMutation({
    mutationFn: async (nome: string) => {
      const { data, error } = await supabase.from("pessoas").insert({ nome_completo: nome.trim(), status: "ativo" }).select("id, nome_completo").single();
      if (error) throw error;
      return data as { id: string; nome_completo: string };
    },
    onSuccess: async (p) => {
      toast.success("Participante criado");
      qc.invalidateQueries({ queryKey: ["pessoas_search"] });
      await onChange(p.id);
      setOpen(false);
      setQ("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const displayName = label ?? current?.nome_completo ?? null;
  const trigger = (
    <Button
      type="button"
      variant={inline ? "outline" : "ghost"}
      size="sm"
      className={inline ? "w-full justify-between" : "h-7 px-2 text-xs justify-start max-w-full"}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="truncate">
        {displayName ?? (value ? "…" : <span className="text-muted-foreground">Sem participante</span>)}
      </span>
      {value && (
        <span
          role="button"
          tabIndex={0}
          aria-label="Desassociar"
          className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded hover:bg-muted shrink-0"
          onClick={(e) => { e.stopPropagation(); onChange(null); }}
        >
          <X className="h-3 w-3" />
        </span>
      )}
    </Button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start" onClick={(e) => e.stopPropagation()}>
        <Command shouldFilter={false}>
          <CommandInput placeholder="Pesquisar participante…" value={q} onValueChange={setQ} />
          <CommandList>
            {isFetching && <div className="p-2 text-xs text-muted-foreground">A pesquisar…</div>}
            <CommandEmpty>
              <div className="p-2 text-sm text-muted-foreground">Sem resultados.</div>
            </CommandEmpty>
            <CommandGroup>
              {(results ?? []).map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  onSelect={async () => { await onChange(p.id); setOpen(false); setQ(""); }}
                >
                  <div className="flex flex-col">
                    <span>{p.nome_completo}</span>
                    {p.email && <span className="text-xs text-muted-foreground">{p.email}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            {q.trim().length >= 2 && (
              <CommandGroup heading="Criar">
                <CommandItem
                  value={`__new__${q}`}
                  onSelect={() => create.mutate(q)}
                  disabled={create.isPending}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Criar participante "{q.trim()}"
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
