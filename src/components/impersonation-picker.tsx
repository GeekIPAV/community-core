import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, UserSquare2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export function ImpersonationPicker() {
  const { realPessoa, realIsAdmin, pessoa, impersonating, startImpersonation, stopImpersonation } = useAuth();
  const [open, setOpen] = useState(false);

  const { data: pessoas } = useQuery({
    queryKey: ["impersonate-pessoas"],
    enabled: realIsAdmin && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome_completo, email")
        .eq("status", "ativo")
        .order("nome_completo")
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!realIsAdmin) return null;

  const label = impersonating
    ? (pessoa?.nome_completo ?? pessoa?.email ?? "—")
    : "Ver como…";

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={impersonating ? "default" : "outline"}
            size="sm"
            role="combobox"
            className="w-full justify-between h-8 text-xs"
          >
            <span className="flex items-center gap-1.5 min-w-0 truncate">
              <UserSquare2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{label}</span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput placeholder="Procurar pessoa…" />
            <CommandList>
              <CommandEmpty>Sem resultados.</CommandEmpty>
              <CommandGroup>
                {(pessoas ?? []).map((p) => {
                  const isMe = p.id === realPessoa?.id;
                  const isActive = pessoa?.id === p.id && impersonating;
                  return (
                    <CommandItem
                      key={p.id}
                      value={`${p.nome_completo} ${p.email ?? ""}`}
                      disabled={isMe}
                      onSelect={async () => {
                        await startImpersonation(p.id);
                        setOpen(false);
                      }}
                    >
                      <Check className={cn("me-2 h-4 w-4", isActive ? "opacity-100" : "opacity-0")} />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{p.nome_completo}{isMe ? " (eu)" : ""}</span>
                        {p.email && <span className="truncate text-[10px] text-muted-foreground">{p.email}</span>}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {impersonating && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-[11px] text-muted-foreground"
          onClick={() => stopImpersonation()}
        >
          <X className="me-1 h-3 w-3" /> Voltar ao meu perfil
        </Button>
      )}
    </div>
  );
}