import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  useSidebarConfig,
  useEffectiveRoles,
  canSee,
  FALLBACK_GROUPS,
  FALLBACK_ITEMS,
} from "@/components/app-sidebar";
import { renderIcon } from "@/components/sidebar-icons";
import { Users, CalendarDays } from "lucide-react";

export function CommandPalette({
  open: openProp,
  onOpenChange,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
} = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    else setInternalOpen(v);
  };
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { isAdmin, isStaff } = useAuth();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const debounced = useDebounced(query, 200);

  const { data: pessoas } = useQuery({
    queryKey: ["cmdk-pessoas", debounced],
    enabled: open && debounced.length >= 2 && (isAdmin || isStaff),
    queryFn: async () => {
      const { data } = await supabase
        .from("pessoas")
        .select("id, nome_completo, email")
        .eq("status", "ativo")
        .ilike("nome_completo", `%${debounced}%`)
        .limit(6);
      return data ?? [];
    },
  });

  const { data: acoes } = useQuery({
    queryKey: ["cmdk-acoes", debounced],
    enabled: open && debounced.length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("acoes")
        .select("id, nome, data_inicio")
        .ilike("nome", `%${debounced}%`)
        .order("data_inicio", { ascending: false, nullsFirst: false })
        .limit(6);
      return data ?? [];
    },
  });

  const navItems = useMemo(
    () => NAV.filter((n) => !n.admin || isAdmin || isStaff),
    [isAdmin, isStaff],
  );

  const go = (to: string, params?: Record<string, string>) => {
    setOpen(false);
    setQuery("");
    navigate({ to, params } as any);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Pesquisar páginas, ações, participantes…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        <CommandGroup heading="Páginas">
          {navItems.map((n) => (
            <CommandItem key={n.to} value={`page-${n.label}`} onSelect={() => go(n.to)}>
              <n.icon className="mr-2 h-4 w-4" />
              {n.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {(acoes?.length ?? 0) > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Ações">
              {acoes!.map((a) => (
                <CommandItem key={a.id} value={`acao-${a.id}-${a.nome}`} onSelect={() => go("/acao/$id", { id: a.id })}>
                  <CalendarDays className="mr-2 h-4 w-4" />
                  <span className="flex-1 truncate">{a.nome}</span>
                  {a.data_inicio && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {new Date(a.data_inicio).toLocaleDateString("pt-PT")}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {(pessoas?.length ?? 0) > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Participantes">
              {pessoas!.map((p) => (
                <CommandItem key={p.id} value={`pessoa-${p.id}-${p.nome_completo}`} onSelect={() => go("/participantes")}>
                  <Users className="mr-2 h-4 w-4" />
                  <span className="flex-1 truncate">{p.nome_completo}</span>
                  {p.email && <span className="ml-2 text-xs text-muted-foreground truncate">{p.email}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

function useDebounced<T>(value: T, delay: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}