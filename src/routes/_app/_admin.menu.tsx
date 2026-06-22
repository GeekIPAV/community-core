import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  GripVertical, Eye, EyeOff, Trash2, Lock, Loader2, Plus, ChevronDown, ChevronRight, RotateCcw, Settings2,
} from "lucide-react";
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  useSidebarConfig, type SidebarGroupRow, type SidebarItemRow,
} from "@/components/app-sidebar";
import { PICKABLE_ICONS, renderIcon } from "@/components/sidebar-icons";

export const Route = createFileRoute("/_app/_admin/menu")({
  component: MenuAdminPage,
});

const ROLE_OPTIONS = [
  { key: "admin", label: "Admin" },
  { key: "staff", label: "Staff" },
  { key: "user", label: "Utilizador" },
] as const;

function toggleRole(arr: string[], role: string) {
  return arr.includes(role) ? arr.filter((r) => r !== role) : [...arr, role];
}

function MenuAdminPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useSidebarConfig();
  const [busy, setBusy] = useState(false);

  // Local optimistic state
  const [groups, setGroups] = useState<SidebarGroupRow[]>([]);
  const [items, setItems] = useState<SidebarItemRow[]>([]);
  useEffect(() => {
    if (data) {
      setGroups([...data.groups].sort((a, b) => a.position - b.position));
      setItems([...data.items].sort((a, b) => a.position - b.position));
    }
  }, [data]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["sidebar-config"] });
  const ok = () => toast.success("Guardado", { duration: 1500 });
  const fail = (e: any) => toast.error(e?.message ?? "Erro ao guardar");

  const run = async <T,>(fn: () => Promise<T>) => {
    setBusy(true);
    try { const r = await fn(); ok(); invalidate(); return r; }
    catch (e) { fail(e); throw e; }
    finally { setBusy(false); }
  };

  // ---- Mutations ----
  const updateGroup = (id: string, patch: Partial<SidebarGroupRow>) => {
    setGroups((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    return run(async () => {
      const { error } = await supabase.from("sidebar_groups").update(patch as never).eq("id", id);
      if (error) throw error;
    });
  };

  const updateItem = (id: string, patch: Partial<SidebarItemRow>) => {
    setItems((is) => is.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    return run(async () => {
      const { error } = await supabase.from("sidebar_items").update(patch as never).eq("id", id);
      if (error) throw error;
    });
  };

  const reorderGroups = async (newOrder: SidebarGroupRow[]) => {
    setGroups(newOrder.map((g, i) => ({ ...g, position: i + 1 })));
    await run(async () => {
      await Promise.all(newOrder.map((g, i) =>
        supabase.from("sidebar_groups").update({ position: i + 1 } as never).eq("id", g.id)
      ));
    });
  };

  const reorderItems = async (groupId: string, newOrder: SidebarItemRow[]) => {
    setItems((all) => {
      const others = all.filter((i) => i.group_id !== groupId);
      const repos = newOrder.map((i, idx) => ({ ...i, position: idx + 1, group_id: groupId }));
      return [...others, ...repos];
    });
    await run(async () => {
      await Promise.all(newOrder.map((it, idx) =>
        supabase.from("sidebar_items")
          .update({ position: idx + 1, group_id: groupId } as never).eq("id", it.id)
      ));
    });
  };

  const addItem = async (groupId: string, payload: { label: string; url: string; icon: string; visible_to: string[] }) => {
    const key = `custom-${Date.now()}`;
    const groupItems = items.filter((i) => i.group_id === groupId);
    const position = groupItems.length + 1;
    await run(async () => {
      const { error } = await supabase.from("sidebar_items").insert({
        group_id: groupId, key, label: payload.label, url: payload.url, icon: payload.icon,
        position, visible_to: payload.visible_to, is_visible: true, is_system: false,
      } as never);
      if (error) throw error;
    });
  };

  const deleteItem = async (id: string) => {
    setItems((is) => is.filter((i) => i.id !== id));
    await run(async () => {
      const { error } = await supabase.from("sidebar_items").delete().eq("id", id);
      if (error) throw error;
    });
  };

  const addGroup = async () => {
    const position = groups.length + 1;
    await run(async () => {
      const { error } = await supabase.from("sidebar_groups").insert({
        key: `custom-${Date.now()}`, label: "Nova Secção", position,
        is_visible: true, visible_to: ["admin"], is_system: false,
      } as never);
      if (error) throw error;
    });
  };

  const deleteGroup = async (id: string) => {
    setGroups((gs) => gs.filter((g) => g.id !== id));
    await run(async () => {
      const { error } = await supabase.from("sidebar_groups").delete().eq("id", id);
      if (error) throw error;
    });
  };

  const resetDefaults = useMutation({
    mutationFn: async () => {
      // Wipe everything; the next deploy/migration could re-seed.
      await supabase.from("sidebar_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("sidebar_groups").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      toast.message("Configuração apagada. Volte a executar o seed para repor predefinições.");
      invalidate();
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Settings2 className="h-6 w-6" /> Gestão do Menu
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reorganize secções, páginas, ícones e permissões da barra lateral.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {busy && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> A guardar…
            </span>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <RotateCcw className="h-4 w-4 mr-1" /> Repor configuração padrão
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Repor configuração padrão?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acção apaga toda a configuração actual do menu. Terá de voltar a executar o seed para repor as predefinições.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => resetDefaults.mutate()}>Repor</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-6">
        {/* LIVE PREVIEW */}
        <aside className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pré-visualização</h2>
          <Card><CardContent className="p-3 space-y-3">
            {groups.map((g) => (
              <div key={g.id} className={cn("space-y-1", !g.is_visible && "opacity-40")}>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">{g.label}</div>
                {items.filter((i) => i.group_id === g.id)
                  .sort((a, b) => a.position - b.position)
                  .map((it) => (
                    <div key={it.id} className={cn(
                      "flex items-center gap-2 px-2 py-1 rounded text-sm hover:bg-muted/50",
                      !it.is_visible && "opacity-40 line-through"
                    )}>
                      {renderIcon(it.icon)} <span className="truncate">{it.label}</span>
                    </div>
                  ))}
              </div>
            ))}
          </CardContent></Card>
        </aside>

        {/* EDITOR */}
        <section className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">A carregar…</p>
          ) : (
            <SortableGroupList
              groups={groups}
              items={items}
              onReorderGroups={reorderGroups}
              onUpdateGroup={updateGroup}
              onDeleteGroup={deleteGroup}
              onUpdateItem={updateItem}
              onDeleteItem={deleteItem}
              onAddItem={addItem}
              onReorderItems={reorderItems}
            />
          )}
          <Button variant="outline" onClick={addGroup}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar secção
          </Button>
        </section>
      </div>
    </div>
  );
}

// ============================================================
// Sortable group list
// ============================================================
function SortableGroupList(props: {
  groups: SidebarGroupRow[];
  items: SidebarItemRow[];
  onReorderGroups: (g: SidebarGroupRow[]) => void;
  onUpdateGroup: (id: string, patch: Partial<SidebarGroupRow>) => void;
  onDeleteGroup: (id: string) => void;
  onUpdateItem: (id: string, patch: Partial<SidebarItemRow>) => void;
  onDeleteItem: (id: string) => void;
  onAddItem: (groupId: string, payload: { label: string; url: string; icon: string; visible_to: string[] }) => void;
  onReorderItems: (groupId: string, newOrder: SidebarItemRow[]) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const { groups } = props;

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = groups.findIndex((g) => g.id === active.id);
    const newIdx = groups.findIndex((g) => g.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    props.onReorderGroups(arrayMove(groups, oldIdx, newIdx));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={groups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {groups.map((g) => (
            <GroupCard key={g.id} group={g} {...props} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function GroupCard(props: {
  group: SidebarGroupRow;
  items: SidebarItemRow[];
  onUpdateGroup: (id: string, patch: Partial<SidebarGroupRow>) => void;
  onDeleteGroup: (id: string) => void;
  onUpdateItem: (id: string, patch: Partial<SidebarItemRow>) => void;
  onDeleteItem: (id: string) => void;
  onAddItem: (groupId: string, payload: { label: string; url: string; icon: string; visible_to: string[] }) => void;
  onReorderItems: (groupId: string, newOrder: SidebarItemRow[]) => void;
}) {
  const { group } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const [expanded, setExpanded] = useState(true);
  const [adding, setAdding] = useState(false);
  const groupItems = props.items.filter((i) => i.group_id === group.id).sort((a, b) => a.position - b.position);

  return (
    <Card ref={setNodeRef} style={style}>
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
            <GripVertical className="h-4 w-4" />
          </button>
          <button onClick={() => setExpanded((v) => !v)} className="text-muted-foreground">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <InlineEdit
            value={group.label}
            onSave={(v) => props.onUpdateGroup(group.id, { label: v })}
            className="flex-1 font-medium"
          />
          <button
            onClick={() => props.onUpdateGroup(group.id, { is_visible: !group.is_visible })}
            className="text-muted-foreground hover:text-foreground"
            title={group.is_visible ? "Ocultar" : "Mostrar"}
          >
            {group.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 opacity-50" />}
          </button>
          <RolesPicker
            value={group.visible_to ?? []}
            onChange={(v) => props.onUpdateGroup(group.id, { visible_to: v })}
          />
          {group.is_system ? (
            <Lock className="h-4 w-4 text-muted-foreground" />
          ) : (
            <button onClick={() => props.onDeleteGroup(group.id)} className="text-destructive/70 hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {expanded && (
          <div className="pl-6 space-y-2">
            <ItemList
              groupId={group.id}
              items={groupItems}
              onUpdateItem={props.onUpdateItem}
              onDeleteItem={props.onDeleteItem}
              onReorder={(no) => props.onReorderItems(group.id, no)}
            />
            {adding ? (
              <AddItemForm
                onCancel={() => setAdding(false)}
                onSubmit={(p) => { props.onAddItem(group.id, p); setAdding(false); }}
              />
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar página
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ItemList(props: {
  groupId: string;
  items: SidebarItemRow[];
  onUpdateItem: (id: string, patch: Partial<SidebarItemRow>) => void;
  onDeleteItem: (id: string) => void;
  onReorder: (newOrder: SidebarItemRow[]) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const o = props.items.findIndex((i) => i.id === active.id);
    const n = props.items.findIndex((i) => i.id === over.id);
    if (o < 0 || n < 0) return;
    props.onReorder(arrayMove(props.items, o, n));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={props.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1">
          {props.items.map((it) => (
            <ItemRow key={it.id} item={it} onUpdate={props.onUpdateItem} onDelete={props.onDeleteItem} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function ItemRow({
  item, onUpdate, onDelete,
}: {
  item: SidebarItemRow;
  onUpdate: (id: string, patch: Partial<SidebarItemRow>) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded border bg-card px-2 py-1.5">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <IconPicker value={item.icon} onChange={(v) => onUpdate(item.id, { icon: v })} />
      <div className="flex-1 min-w-0">
        <InlineEdit value={item.label} onSave={(v) => onUpdate(item.id, { label: v })} className="text-sm" />
        <div className="text-[10px] text-muted-foreground truncate">{item.url}</div>
      </div>
      <RolesPicker value={item.visible_to ?? []} onChange={(v) => onUpdate(item.id, { visible_to: v })} />
      <button
        onClick={() => onUpdate(item.id, { is_visible: !item.is_visible })}
        title={item.is_visible ? "Ocultar" : "Mostrar"}
        className="text-muted-foreground hover:text-foreground"
      >
        {item.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 opacity-50" />}
      </button>
      {item.is_system ? (
        <Lock className="h-4 w-4 text-muted-foreground" aria-label="Item de sistema — não pode ser eliminado" />
      ) : (
        <button onClick={() => onDelete(item.id)} className="text-destructive/70 hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ============================================================
// Pieces
// ============================================================
function InlineEdit({
  value, onSave, className,
}: { value: string; onSave: (v: string) => void; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className={cn("text-left truncate hover:bg-muted/50 rounded px-1", className)}>
        {value}
      </button>
    );
  }
  const save = () => { setEditing(false); if (v !== value) onSave(v); };
  return (
    <Input
      autoFocus
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setV(value); setEditing(false); } }}
      className={cn("h-7 text-sm", className)}
    />
  );
}

function RolesPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-[11px]">
          {value.length === 0 ? "Visível para" : value.join(", ")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2 space-y-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground px-1">Visível para</p>
        {ROLE_OPTIONS.map((r) => (
          <button
            key={r.key}
            onClick={() => onChange(toggleRole(value, r.key))}
            className={cn(
              "w-full text-left rounded px-2 py-1 text-sm",
              value.includes(r.key) ? "bg-primary/15 text-foreground" : "hover:bg-muted/50"
            )}
          >
            {value.includes(r.key) ? "✓ " : "  "} {r.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          {renderIcon(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        <div className="grid grid-cols-6 gap-1">
          {PICKABLE_ICONS.map((name) => (
            <button
              key={name}
              onClick={() => onChange(name)}
              className={cn(
                "h-8 w-8 rounded flex items-center justify-center hover:bg-muted",
                value === name && "bg-primary/15 ring-1 ring-primary"
              )}
              title={name}
            >
              {renderIcon(name)}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AddItemForm({
  onCancel, onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (p: { label: string; url: string; icon: string; visible_to: string[] }) => void;
}) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("/");
  const [icon, setIcon] = useState("Circle");
  const [roles, setRoles] = useState<string[]>(["admin", "staff"]);
  const ok = label.trim().length > 0 && url.startsWith("/");
  return (
    <div className="rounded border bg-muted/30 p-2 space-y-2">
      <div className="flex items-center gap-2">
        <IconPicker value={icon} onChange={setIcon} />
        <Input placeholder="Etiqueta" value={label} onChange={(e) => setLabel(e.target.value)} className="h-8 text-sm" />
        <Input placeholder="/url" value={url} onChange={(e) => setUrl(e.target.value)} className="h-8 text-sm w-32" />
        <RolesPicker value={roles} onChange={setRoles} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" disabled={!ok} onClick={() => onSubmit({ label, url, icon, visible_to: roles })}>
          Adicionar
        </Button>
      </div>
    </div>
  );
}