import { useEffect, useState } from "react";
import type { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, Pencil, Plus, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type ViewSnapshot = {
  columnFilters?: any;
  sorting?: any;
  columnVisibility?: Record<string, boolean>;
  columnOrder?: string[];
  grouping?: string[];
  search?: string;
  extra?: Record<string, any>;
};

type SavedView = {
  id: string;
  name: string;
  snapshot: ViewSnapshot;
  created_by: string;
  is_admin_view: boolean;
};

const ALL_KEY = "__all__";

export function SavedViews<T>({
  storageKey,
  table,
  search,
  onSearchChange,
  extra,
  onExtraChange,
}: {
  storageKey: string;
  table: Table<T>;
  search?: string;
  onSearchChange?: (v: string) => void;
  extra?: Record<string, any>;
  onExtraChange?: (e: Record<string, any>) => void;
}) {
  const { realIsAdmin } = useAuth();
  const [views, setViews] = useState<SavedView[]>([]);
  const [activeId, setActiveId] = useState<string>(ALL_KEY);
  const [saveOpen, setSaveOpen] = useState(false);
  const [renaming, setRenaming] = useState<SavedView | null>(null);
  const [newName, setNewName] = useState("");
  const activeLocalKey = `${storageKey}:active`;

  const loadViews = async () => {
    const { data, error } = await supabase
      .from("vistas_guardadas")
      .select("id, name, snapshot, created_by, is_admin_view")
      .eq("storage_key", storageKey)
      .order("created_at", { ascending: true });
    if (error) {
      console.error(error);
      return;
    }
    setViews((data ?? []) as SavedView[]);
  };

  useEffect(() => {
    loadViews();
    try {
      const saved = localStorage.getItem(activeLocalKey);
      if (saved) setActiveId(saved);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const setActive = (id: string) => {
    setActiveId(id);
    try {
      localStorage.setItem(activeLocalKey, id);
    } catch {
      /* ignore */
    }
  };

  const captureSnapshot = (): ViewSnapshot => {
    const s = table.getState();
    return {
      columnFilters: s.columnFilters,
      sorting: s.sorting,
      columnVisibility: s.columnVisibility,
      columnOrder: s.columnOrder,
      grouping: s.grouping,
      search,
      extra,
    };
  };

  const applySnapshot = (snap: ViewSnapshot) => {
    table.setColumnFilters(snap.columnFilters ?? []);
    table.setSorting(snap.sorting ?? []);
    if (snap.columnVisibility) table.setColumnVisibility(snap.columnVisibility);
    if (snap.columnOrder) table.setColumnOrder(snap.columnOrder);
    if (snap.grouping) table.setGrouping(snap.grouping);
    if (snap.search !== undefined) onSearchChange?.(snap.search);
    if (snap.extra) onExtraChange?.(snap.extra);
  };

  const activateAll = () => {
    setActive(ALL_KEY);
    table.setColumnFilters([]);
    onSearchChange?.("");
  };

  const activateView = (v: SavedView) => {
    setActive(v.id);
    applySnapshot(v.snapshot);
  };

  const saveCurrent = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error("Nome obrigatório");
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      toast.error("Inicia sessão");
      return;
    }
    const { data, error } = await supabase
      .from("vistas_guardadas")
      .insert({
        storage_key: storageKey,
        name,
        snapshot: captureSnapshot() as any,
        created_by: uid,
      })
      .select("id, name, snapshot, created_by, is_admin_view")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setViews((prev) => [...prev, data as SavedView]);
    setActive((data as SavedView).id);
    setSaveOpen(false);
    setNewName("");
    toast.success("Vista guardada");
  };

  const updateActive = async () => {
    if (activeId === ALL_KEY) {
      setSaveOpen(true);
      return;
    }
    const snap = captureSnapshot();
    const { error } = await supabase
      .from("vistas_guardadas")
      .update({ snapshot: snap as any })
      .eq("id", activeId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setViews((prev) =>
      prev.map((v) => (v.id === activeId ? { ...v, snapshot: snap } : v)),
    );
    toast.success("Vista atualizada");
  };

  const rename = async () => {
    if (!renaming) return;
    const name = newName.trim();
    if (!name) return;
    const { error } = await supabase
      .from("vistas_guardadas")
      .update({ name })
      .eq("id", renaming.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setViews((prev) =>
      prev.map((v) => (v.id === renaming.id ? { ...v, name } : v)),
    );
    setRenaming(null);
    setNewName("");
  };

  const remove = async (v: SavedView) => {
    if (!confirm(`Apagar vista "${v.name}"?`)) return;
    const { error } = await supabase
      .from("vistas_guardadas")
      .delete()
      .eq("id", v.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setViews((prev) => prev.filter((x) => x.id !== v.id));
    if (activeId === v.id) setActive(ALL_KEY);
  };

  const activeView = views.find((v) => v.id === activeId) ?? null;
  const canEditActive =
    !!activeView && (realIsAdmin || activeView.is_admin_view === false);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={activateAll}
        className={cn(
          "h-8 rounded-md border px-3 text-sm",
          activeId === ALL_KEY
            ? "bg-background shadow-sm border-foreground/20"
            : "bg-muted/40 text-muted-foreground hover:bg-muted",
        )}
      >
        Todos
      </button>
      {views.map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => activateView(v)}
          className={cn(
            "h-8 rounded-md border px-3 text-sm inline-flex items-center gap-1",
            activeId === v.id
              ? "bg-background shadow-sm border-foreground/20"
              : "bg-muted/40 text-muted-foreground hover:bg-muted",
          )}
          title={v.is_admin_view ? "Vista partilhada" : "Vista pessoal"}
        >
          {v.is_admin_view && <Users className="h-3 w-3 opacity-60" />}
          {v.name}
        </button>
      ))}
      {activeId !== ALL_KEY && canEditActive && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={updateActive}
            title="Atualizar vista com filtros atuais"
          >
            <Check className="h-4 w-4 mr-1" /> Atualizar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const v = views.find((x) => x.id === activeId);
              if (!v) return;
              setRenaming(v);
              setNewName(v.name);
            }}
            title="Renomear vista"
          >
            <Pencil className="h-4 w-4 mr-1" /> Renomear
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const v = views.find((x) => x.id === activeId);
              if (v) remove(v);
            }}
            title="Apagar vista"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-1" /> Apagar
          </Button>
        </>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setNewName("");
          setSaveOpen(true);
        }}
      >
        <Plus className="h-4 w-4 mr-1" /> Nova vista
      </Button>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Guardar vista</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Nome da vista"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveCurrent()}
          />
          <DialogFooter>
            <Button onClick={saveCurrent}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Renomear vista</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && rename()}
          />
          <DialogFooter>
            <Button onClick={rename}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}