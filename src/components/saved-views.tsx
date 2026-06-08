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
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type ViewSnapshot = {
  columnFilters?: any;
  sorting?: any;
  columnVisibility?: Record<string, boolean>;
  columnOrder?: string[];
  grouping?: string[];
  search?: string;
  extra?: Record<string, any>;
};

type SavedView = { id: string; name: string; snapshot: ViewSnapshot };

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
  const [views, setViews] = useState<SavedView[]>([]);
  const [activeId, setActiveId] = useState<string>(ALL_KEY);
  const [saveOpen, setSaveOpen] = useState(false);
  const [renaming, setRenaming] = useState<SavedView | null>(null);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { views?: SavedView[]; activeId?: string };
        setViews(parsed.views ?? []);
        if (parsed.activeId) setActiveId(parsed.activeId);
      }
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const persist = (next: SavedView[], nextActive: string = activeId) => {
    setViews(next);
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ views: next, activeId: nextActive }),
      );
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
    setActiveId(ALL_KEY);
    persist(views, ALL_KEY);
    table.setColumnFilters([]);
    onSearchChange?.("");
  };

  const activateView = (v: SavedView) => {
    setActiveId(v.id);
    persist(views, v.id);
    applySnapshot(v.snapshot);
  };

  const saveCurrent = () => {
    const name = newName.trim();
    if (!name) {
      toast.error("Nome obrigatório");
      return;
    }
    const v: SavedView = {
      id: Math.random().toString(36).slice(2, 10),
      name,
      snapshot: captureSnapshot(),
    };
    const next = [...views, v];
    persist(next, v.id);
    setActiveId(v.id);
    setSaveOpen(false);
    setNewName("");
    toast.success("Vista guardada");
  };

  const updateActive = () => {
    if (activeId === ALL_KEY) {
      setSaveOpen(true);
      return;
    }
    const next = views.map((v) =>
      v.id === activeId ? { ...v, snapshot: captureSnapshot() } : v,
    );
    persist(next);
    toast.success("Vista atualizada");
  };

  const rename = () => {
    if (!renaming) return;
    const name = newName.trim();
    if (!name) return;
    const next = views.map((v) => (v.id === renaming.id ? { ...v, name } : v));
    persist(next);
    setRenaming(null);
    setNewName("");
  };

  const remove = (v: SavedView) => {
    if (!confirm(`Apagar vista "${v.name}"?`)) return;
    const next = views.filter((x) => x.id !== v.id);
    const nextActive = activeId === v.id ? ALL_KEY : activeId;
    persist(next, nextActive);
    if (activeId === v.id) setActiveId(ALL_KEY);
  };

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
            "h-8 rounded-md border px-3 text-sm",
            activeId === v.id
              ? "bg-background shadow-sm border-foreground/20"
              : "bg-muted/40 text-muted-foreground hover:bg-muted",
          )}
        >
          {v.name}
        </button>
      ))}
      {activeId !== ALL_KEY && (
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