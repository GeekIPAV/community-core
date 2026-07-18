import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ChevronRight,
  Users,
  Palette,
  Type,
  Ruler,
  Search,
  Trash2,
  Plus,
  Home,
  Folder,
  Command as CmdIcon,
  Inbox,
} from "lucide-react";
import { useState } from "react";

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-background p-4 overflow-hidden">
      {children}
    </div>
  );
}

function KpiCardPreview() {
  return (
    <Wrap>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Pessoas", value: "1.284", delta: "+12%", icon: Users },
          { label: "Casos", value: "37", delta: "+3", icon: Folder },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="rounded-md bg-primary/10 p-2">
                <k.icon className="h-4 w-4 text-primary" />
              </div>
              <span className="text-xs text-emerald-600">{k.delta}</span>
            </div>
            <div className="mt-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {k.label}
            </div>
            <div className="text-2xl font-bold tabular-nums">{k.value}</div>
          </div>
        ))}
      </div>
    </Wrap>
  );
}

function FrostedPreview() {
  return (
    <Wrap>
      <div className="relative rounded-lg p-6 bg-gradient-to-br from-primary/20 via-accent/40 to-secondary/40">
        <Card className="border-border/60 bg-card/60 backdrop-blur-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">Frosted</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Glassmorphism surface
          </CardContent>
        </Card>
      </div>
    </Wrap>
  );
}

function StatusBadgePreview() {
  return (
    <Wrap>
      <div className="flex flex-wrap gap-2">
        <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">Pago</Badge>
        <Badge className="bg-amber-500 text-white hover:bg-amber-600">Pendente</Badge>
        <Badge variant="destructive">Cancelado</Badge>
        <Badge className="bg-sky-500 text-white hover:bg-sky-600">Info</Badge>
        <Badge variant="outline">Rascunho</Badge>
      </div>
    </Wrap>
  );
}

function EmptyStatePreview() {
  return (
    <Wrap>
      <div className="flex flex-col items-center py-6 text-center">
        <Inbox className="h-10 w-10 text-muted-foreground/50" />
        <h3 className="mt-3 text-sm font-medium">Sem resultados</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Adiciona a tua primeira entrada.
        </p>
        <Button size="sm" className="mt-3">
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
        </Button>
      </div>
    </Wrap>
  );
}

function SkeletonPreview() {
  return (
    <Wrap>
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </Wrap>
  );
}

function FamilyHeaderPreview() {
  const [open, setOpen] = useState(true);
  return (
    <Wrap>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md p-2 hover:bg-muted">
          <ChevronRight
            className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`}
          />
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
            S
          </div>
          <span className="flex-1 text-left text-sm font-medium">Família Silva</span>
          <Badge variant="outline" className="text-[10px]">
            Direito a bolsa
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            8 ações
          </Badge>
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-9 py-2 space-y-1 text-xs text-muted-foreground">
          <div>· Maria Silva · 34 · F</div>
          <div>· João Silva · 8 · M</div>
        </CollapsibleContent>
      </Collapsible>
    </Wrap>
  );
}

function SmartTablePreview() {
  return (
    <Wrap>
      <div className="rounded-md border overflow-hidden">
        <div className="flex items-center gap-2 border-b bg-muted/40 p-2">
          <div className="flex-1 flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground">
            <Search className="h-3 w-3" /> Pesquisar...
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs">
            Colunas
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs">
            Exportar
          </Button>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-muted/20">
            <tr>
              <th className="text-left p-2 font-medium">Nome</th>
              <th className="text-left p-2 font-medium">Estado</th>
              <th className="text-left p-2 font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Maria Silva", "pago", "12,60 €"],
              ["João Costa", "pendente", "8,40 €"],
              ["Ana Ferreira", "pago", "20,20 €"],
            ].map(([n, s, v]) => (
              <tr key={n} className="border-t">
                <td className="p-2">{n}</td>
                <td className="p-2">
                  <Badge
                    className={
                      s === "pago"
                        ? "bg-emerald-500 text-white text-[10px] hover:bg-emerald-600"
                        : "bg-amber-500 text-white text-[10px] hover:bg-amber-600"
                    }
                  >
                    {s}
                  </Badge>
                </td>
                <td className="p-2 tabular-nums">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Wrap>
  );
}

function InlineEditPreview() {
  const [v, setV] = useState("Clica para editar");
  const [editing, setEditing] = useState(false);
  return (
    <Wrap>
      <div className="rounded border p-3 text-sm">
        {editing ? (
          <input
            autoFocus
            value={v}
            onChange={(e) => setV(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
            className="w-full bg-transparent outline-none ring-1 ring-primary rounded px-1"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="w-full text-left hover:bg-muted/60 rounded px-1"
          >
            {v}
          </button>
        )}
      </div>
    </Wrap>
  );
}

function EditSheetPreview() {
  const [open, setOpen] = useState(false);
  return (
    <Wrap>
      <Sheet open={open} onOpenChange={setOpen}>
        <Button size="sm" onClick={() => setOpen(true)}>
          Abrir sheet
        </Button>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle>Editar entidade</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto py-4 space-y-3 text-sm text-muted-foreground">
            <div className="h-8 rounded bg-muted" />
            <div className="h-8 rounded bg-muted" />
            <div className="h-20 rounded bg-muted" />
          </div>
          <div className="border-t pt-3 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={() => setOpen(false)}>
              Guardar
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </Wrap>
  );
}

function AcoesHoverPreview() {
  return (
    <Wrap>
      <Popover>
        <PopoverTrigger asChild>
          <Badge variant="secondary" className="cursor-pointer">
            8 ações
          </Badge>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0">
          <div className="max-h-64 overflow-y-auto divide-y text-xs">
            {[
              "Workshop de cozinha",
              "Passeio ao Gerês",
              "Sessão de apoio",
              "Feira do livro",
            ].map((a) => (
              <div key={a} className="flex justify-between p-2">
                <span>{a}</span>
                <span className="text-muted-foreground">12/06</span>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </Wrap>
  );
}

function CommandPalettePreview() {
  return (
    <Wrap>
      <div className="rounded-lg border shadow-sm bg-popover overflow-hidden max-w-md">
        <div className="flex items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
          <CmdIcon className="h-3 w-3" /> Escrever comando...
          <span className="ml-auto rounded bg-muted px-1.5 py-0.5 font-mono">⌘K</span>
        </div>
        <div className="p-2 text-xs">
          <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground">
            Navegação
          </div>
          {[
            { label: "Dashboard", icon: Home },
            { label: "Casos", icon: Folder },
          ].map((i) => (
            <div
              key={i.label}
              className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
            >
              <i.icon className="h-3.5 w-3.5" />
              {i.label}
            </div>
          ))}
        </div>
      </div>
    </Wrap>
  );
}

function SidebarPreview() {
  return (
    <Wrap>
      <div className="rounded-md border bg-sidebar w-56 p-2 text-sm">
        <div className="text-[10px] uppercase text-muted-foreground px-2 py-1">
          Gestão
        </div>
        <div className="flex items-center gap-2 rounded px-2 py-1.5 bg-sidebar-primary/10 text-sidebar-primary">
          <Folder className="h-4 w-4" /> Casos
        </div>
        <div className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted">
          <Users className="h-4 w-4" /> Participantes
        </div>
        <div className="text-[10px] uppercase text-muted-foreground px-2 py-1 mt-2">
          Admin
        </div>
        <div className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted">
          <Palette className="h-4 w-4" /> Style Guide
        </div>
      </div>
    </Wrap>
  );
}

function TabsIconsPreview() {
  return (
    <Wrap>
      <Tabs defaultValue="a">
        <TabsList className="grid grid-cols-3 max-w-md">
          <TabsTrigger value="a">
            <Palette className="h-3.5 w-3.5 mr-1.5" />
            Cores
          </TabsTrigger>
          <TabsTrigger value="b">
            <Type className="h-3.5 w-3.5 mr-1.5" />
            Tipografia
          </TabsTrigger>
          <TabsTrigger value="c">
            <Ruler className="h-3.5 w-3.5 mr-1.5" />
            Espaço
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </Wrap>
  );
}

function AddDialogFamilyPreview() {
  const [expanded, setExpanded] = useState(true);
  return (
    <Wrap>
      <div className="rounded-md border p-2 text-xs space-y-1">
        <div className="flex items-center gap-2 rounded p-1.5 hover:bg-muted">
          <input type="checkbox" defaultChecked />
          <button onClick={() => setExpanded(!expanded)}>
            <ChevronRight
              className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`}
            />
          </button>
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
            S
          </div>
          <span className="flex-1 font-medium">Família Silva</span>
          <Badge variant="outline" className="text-[10px]">
            Direito a KM
          </Badge>
          <button className="rounded bg-emerald-500/10 text-emerald-700 px-2 py-0.5 text-[10px]">
            + KM
          </button>
          <button className="rounded bg-sky-500/10 text-sky-700 px-2 py-0.5 text-[10px]">
            🚌 + Bolsa
          </button>
        </div>
        {expanded && (
          <div className="pl-11 space-y-1 text-muted-foreground">
            <label className="flex items-center gap-2">
              <input type="checkbox" /> Maria Silva <span>· 34 · F</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" /> João Silva <span>· 8 · M</span>
            </label>
          </div>
        )}
      </div>
    </Wrap>
  );
}

function ConfirmDeletePreview() {
  return (
    <Wrap>
      <div className="rounded-md border bg-popover shadow-sm p-4 max-w-sm">
        <div className="text-sm font-semibold">Tens a certeza?</div>
        <div className="text-xs text-muted-foreground mt-1">
          Esta acção não pode ser revertida.
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <Button variant="outline" size="sm">
            Cancelar
          </Button>
          <Button variant="destructive" size="sm">
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Apagar
          </Button>
        </div>
      </div>
    </Wrap>
  );
}

export const PREVIEWS: Record<string, React.FC> = {
  "kpi-card": KpiCardPreview,
  "frosted-card": FrostedPreview,
  "status-badge": StatusBadgePreview,
  "empty-state": EmptyStatePreview,
  "loading-skeleton": SkeletonPreview,
  "family-group-header": FamilyHeaderPreview,
  "smart-table": SmartTablePreview,
  "inline-edit": InlineEditPreview,
  "edit-sheet": EditSheetPreview,
  "acoes-hover": AcoesHoverPreview,
  "command-palette": CommandPalettePreview,
  "sidebar-groups": SidebarPreview,
  "tabs-icons": TabsIconsPreview,
  "add-dialog-family": AddDialogFamilyPreview,
  "confirm-delete": ConfirmDeletePreview,
};

export const PREVIEW_KEYS = Object.keys(PREVIEWS);