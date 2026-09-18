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
import { Users, CalendarDays, Home, FolderOpen } from "lucide-react";

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
  const roles = useEffectiveRoles();
  const { data: sidebarData } = useSidebarConfig();

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

  const { data: familias } = useQuery({
    queryKey: ["cmdk-familias", debounced],
    enabled: open && debounced.length >= 2 && (isAdmin || isStaff),
    queryFn: async () => {
      const { data } = await supabase
        .from("familias")
        .select("id, nome, status")
        .is("deleted_at", null)
        .ilike("nome", `%${debounced}%`)
        .limit(6);
      return data ?? [];
    },
  });

  const { data: casos } = useQuery({
    queryKey: ["cmdk-casos", debounced],
    enabled: open && debounced.length >= 2 && (isAdmin || isStaff),
    queryFn: async () => {
      const sel =
        "id, numero, titulo, estado, pessoa:pessoas!casos_apoio_pessoa_id_fkey(nome_completo), familia:familias!casos_apoio_familia_id_fkey(nome)";
      const [porTexto, porPessoa, porFamilia] = await Promise.all([
        supabase
          .from("casos_apoio")
          .select(sel)
          .or(`titulo.ilike.%${debounced}%,numero.ilike.%${debounced}%`)
          .limit(6),
        supabase
          .from("casos_apoio")
          .select(sel)
          .ilike("pessoas.nome_completo", `%${debounced}%`)
          .not("pessoa_id", "is", null)
          .limit(6),
        supabase
          .from("casos_apoio")
          .select(sel)
          .ilike("familias.nome", `%${debounced}%`)
          .not("familia_id", "is", null)
          .limit(6),
      ]);
      const todos = [
        ...(porTexto.data ?? []),
        ...(porPessoa.data ?? []),
        ...(porFamilia.data ?? []),
      ] as any[];
      const vistos = new Set<string>();
      return todos.filter((c) => (vistos.has(c.id) ? false : (vistos.add(c.id), true))).slice(0, 6);
    },
  });

  const navItems = useMemo(() => {
    const src = sidebarData ?? { groups: FALLBACK_GROUPS, items: FALLBACK_ITEMS };
    const visibleGroups = src.groups
      .filter((g) => g.is_visible && canSee(g.visible_to, roles))
      .sort((a, b) => a.position - b.position);
    const out: { key: string; label: string; to: string; icon: string; group: string }[] = [];
    for (const g of visibleGroups) {
      const its = src.items
        .filter((i) => i.group_id === g.id && i.is_visible && canSee(i.visible_to, roles))
        .sort((a, b) => a.position - b.position);
      for (const it of its) {
        out.push({
          key: it.id,
          label: it.sub_group ? `${it.sub_group} · ${it.label}` : it.label,
          to: it.url,
          icon: it.icon,
          group: g.label,
        });
      }
    }
    return out;
  }, [sidebarData, roles]);

  const go = (to: string, params?: Record<string, string>, search?: Record<string, string>) => {
    setOpen(false);
    setQuery("");
    navigate({ to, params, search } as any);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Pesquisar páginas, ações, participantes…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        <CommandGroup heading="Páginas">
          {navItems.map((n) => (
            <CommandItem key={n.key} value={`page-${n.group}-${n.label}`} onSelect={() => go(n.to)}>
              <span className="mr-2">{renderIcon(n.icon)}</span>
              <span className="flex-1 truncate">{n.label}</span>
              <span className="ml-2 text-xs text-muted-foreground">{n.group}</span>
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
                <CommandItem
                  key={p.id}
                  value={`pessoa-${p.id}-${p.nome_completo}`}
                  onSelect={() => go("/participantes", undefined, { pessoa: p.id })}
                >
                  <Users className="mr-2 h-4 w-4" />
                  <span className="flex-1 truncate">{p.nome_completo}</span>
                  {p.email && <span className="ml-2 text-xs text-muted-foreground truncate">{p.email}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {(familias?.length ?? 0) > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Famílias">
              {familias!.map((f: any) => (
                <CommandItem
                  key={f.id}
                  value={`familia-${f.id}-${f.nome}`}
                  onSelect={() => go("/familias", undefined, { familia: f.id })}
                >
                  <Home className="mr-2 h-4 w-4" />
                  <span className="flex-1 truncate">{f.nome}</span>
                  {f.status && <span className="ml-2 text-xs text-muted-foreground truncate">{f.status}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {(casos?.length ?? 0) > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Casos de apoio">
              {casos!.map((c: any) => (
                <CommandItem
                  key={c.id}
                  value={`caso-${c.id}-${c.numero}-${c.titulo}`}
                  onSelect={() => go("/casos/$id", { id: c.id })}
                >
                  <FolderOpen className="mr-2 h-4 w-4" />
                  <span className="flex-1 truncate">
                    {c.numero ? `${c.numero} · ` : ""}
                    {c.titulo}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground truncate">
                    {c.pessoa?.nome_completo ?? c.familia?.nome ?? c.estado ?? ""}
                  </span>
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