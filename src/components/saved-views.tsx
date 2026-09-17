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
import { Check, List, Pencil, Plus, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PICKABLE_ICONS, renderIcon } from "@/components/sidebar-icons";

export type ViewSnapshot = {
  columnFilters?: any;
  sorting?: any;
  columnVisibility?: Record<string, boolean>;
  columnOrder?: string[];
  grouping?: string[];
  search?: string;
  extra?: Record<string, any>;
  viewIcon?: string;
};

type SavedView = {
  id: string;
  name: string;
  snapshot: ViewSnapshot;
  created_by: string;
  is_admin_view: boolean;
};

const ALL_KEY = "__all__";
const DEFAULT_VIEW_ICON = "List";

const ICON_LABELS: Record<string, string> = {
  Globe: "Globo",
  BarChart3: "Gráfico",
  User: "Pessoa",
  Users: "Pessoas",
  Users2: "Grupo",
  Briefcase: "Mala",
  AlertTriangle: "Alerta",
  CalendarDays: "Calendário",
  CalendarCheck: "Calendário confirmado",
  Activity: "Atividade",
  Wallet: "Carteira",
  CreditCard: "Cartão",
  ClipboardList: "Lista de tarefas",
  Settings2: "Controlos",
  Settings: "Definições",
  LayoutDashboard: "Painel",
  Bus: "Transporte",
  MapPin: "Localização",
  FileText: "Documento",
  FileSpreadsheet: "Tabela",
  FileBarChart: "Relatório",
  Handshake: "Parceria",
  Mail: "Email",
  UserCog: "Gestão de pessoa",
  Trash2: "Eliminados",
  ShieldAlert: "Segurança",
  Palette: "Paleta",
  ChartBar: "Barras",
  Folder: "Pasta",
  Star: "Estrela",
  Heart: "Coração",
  Tag: "Etiqueta",
};

function ViewIconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Ícone da vista</p>
      <div className="grid max-h-40 grid-cols-8 gap-1 overflow-y-auto rounded-md border p-2">
        {PICKABLE_ICONS.map((icon) => (
          <Tooltip key={icon}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8",
                  value === icon && "bg-primary/15 text-primary ring-1 ring-primary",
                )}
                onClick={() => onChange(icon)}
                aria-label={`Escolher ícone: ${ICON_LABELS[icon] ?? icon}`}
              >
                {renderIcon(icon, "h-4 w-4")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{ICON_LABELS[icon] ?? icon}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}

export function SavedViews<T>({
  storageKey,
  table,
  search,
  onSearchChange,
  extra,
  onExtraChange,
  defaultViewName,
}: {
  storageKey: string;
  table: Table<T>;
  search?: string;
  onSearchChange?: (v: string) => void;
  extra?: Record<string, any>;
  onExtraChange?: (e: Record<string, any>) => void;
  defaultViewName?: string;
}) {
  const { realIsAdmin, session } = useAuth();
  const currentUserId = session?.user?.id;
  const [views, setViews] = useState<SavedView[]>([]);
  const [activeId, setActiveId] = useState<string>(ALL_KEY);
  const [saveOpen, setSaveOpen] = useState(false);
  const [renaming, setRenaming] = useState<SavedView | null>(null);
  const [newName, setNewName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState(DEFAULT_VIEW_ICON);
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
    const loaded = (data ?? []) as SavedView[];
    setViews(loaded);
    return loaded;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await loadViews();
      if (cancelled) return;
      let savedId: string | null = null;
      try {
        savedId = localStorage.getItem(activeLocalKey);
      } catch {
        /* ignore */
      }
      if (savedId) {
        setActiveId(savedId);
        const v = (loaded ?? []).find((x) => x.id === savedId);
        if (v) applySnapshot(v.snapshot);
      } else if (defaultViewName && loaded) {
        const v = loaded.find((x) => x.name === defaultViewName);
        if (v) {
          setActiveId(v.id);
          try { localStorage.setItem(activeLocalKey, v.id); } catch { /* ignore */ }
          applySnapshot(v.snapshot);
        }
      }
    })();
    return () => { cancelled = true; };
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

  const captureSnapshot = (viewIcon?: string): ViewSnapshot => {
    const s = table.getState();
    return {
      columnFilters: s.columnFilters,
      sorting: s.sorting,
      columnVisibility: s.columnVisibility,
      columnOrder: s.columnOrder,
      grouping: s.grouping,
      search,
      extra,
      ...(viewIcon ? { viewIcon } : {}),
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
        snapshot: captureSnapshot(selectedIcon) as any,
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
    setSelectedIcon(DEFAULT_VIEW_ICON);
    toast.success("Vista guardada");
  };

  const updateActive = async () => {
    if (activeId === ALL_KEY) {
      setSaveOpen(true);
      return;
    }
    const activeView = views.find((view) => view.id === activeId);
    const snap = captureSnapshot(activeView?.snapshot.viewIcon);
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
    const snapshot = { ...renaming.snapshot, viewIcon: selectedIcon };
    const { error } = await supabase
      .from("vistas_guardadas")
      .update({ name, snapshot: snapshot as any })
      .eq("id", renaming.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setViews((prev) =>
      prev.map((v) => (v.id === renaming.id ? { ...v, name, snapshot } : v)),
    );
    setRenaming(null);
    setNewName("");
    setSelectedIcon(DEFAULT_VIEW_ICON);
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
    !!activeView &&
    (realIsAdmin ||
      (activeView.is_admin_view === false && activeView.created_by === currentUserId));

  return (
    <TooltipProvider delayDuration={300}>
    <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:thin]">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={activateAll}
        className={cn(
          "h-7 shrink-0 gap-1.5 rounded-none border-b-2 border-transparent px-2 text-xs font-normal",
          activeId === ALL_KEY
            ? "border-primary text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <List className="h-3.5 w-3.5 opacity-70" />
        Todos
      </Button>
      {views.map((v) => (
        <Button
          key={v.id}
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => activateView(v)}
          className={cn(
            "h-7 shrink-0 gap-1.5 rounded-none border-b-2 border-transparent px-2 text-xs font-normal",
            activeId === v.id
              ? "border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          aria-label={`${v.name}, ${v.is_admin_view ? "vista partilhada" : "vista pessoal"}`}
        >
          {v.snapshot.viewIcon
            ? renderIcon(v.snapshot.viewIcon, "h-3.5 w-3.5 opacity-70")
            : v.is_admin_view
              ? <Users className="h-3.5 w-3.5 opacity-70" />
              : <List className="h-3.5 w-3.5 opacity-70" />}
          {v.name}
        </Button>
      ))}
      {activeId !== ALL_KEY && canEditActive && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={updateActive} aria-label="Atualizar vista com os filtros atuais">
                <Check className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Atualizar vista</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => {
                  const v = views.find((x) => x.id === activeId);
                  if (!v) return;
                  setRenaming(v);
                  setNewName(v.name);
                  setSelectedIcon(v.snapshot.viewIcon ?? (v.is_admin_view ? "Users" : DEFAULT_VIEW_ICON));
                }}
                aria-label="Editar nome e ícone da vista"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Editar vista</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                onClick={() => {
                  const v = views.find((x) => x.id === activeId);
                  if (v) remove(v);
                }}
                aria-label="Apagar vista"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Apagar vista</TooltipContent>
          </Tooltip>
        </>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => {
              setNewName("");
              setSelectedIcon(DEFAULT_VIEW_ICON);
              setSaveOpen(true);
            }}
            aria-label="Nova vista"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Nova vista</TooltipContent>
      </Tooltip>

      <Dialog open={saveOpen} onOpenChange={(open) => {
        setSaveOpen(open);
        if (!open) setSelectedIcon(DEFAULT_VIEW_ICON);
      }}>
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
          <ViewIconPicker value={selectedIcon} onChange={setSelectedIcon} />
          <DialogFooter>
            <Button onClick={saveCurrent}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renaming} onOpenChange={(o) => {
        if (!o) {
          setRenaming(null);
          setSelectedIcon(DEFAULT_VIEW_ICON);
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar vista</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && rename()}
          />
          <ViewIconPicker value={selectedIcon} onChange={setSelectedIcon} />
          <DialogFooter>
            <Button onClick={rename}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}