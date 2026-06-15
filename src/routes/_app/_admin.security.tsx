import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShieldAlert, Plus, History, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

export const Route = createFileRoute("/_app/_admin/security")({
  component: SecurityPage,
});

type Finding = {
  id: string;
  connector: string;
  external_id: string | null;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  resource: string | null;
  url: string | null;
  metadata: Record<string, unknown>;
  first_seen_at: string;
  last_seen_at: string;
  updated_at: string;
};

type Event = {
  id: string;
  finding_id: string;
  actor_name: string | null;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  created_at: string;
};

const STATUSES = ["open", "fixed", "ignored", "wontfix"] as const;
const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;

function sevColor(s: string) {
  switch (s) {
    case "critical":
      return "bg-destructive text-destructive-foreground";
    case "high":
      return "bg-orange-500 text-white";
    case "medium":
      return "bg-amber-500 text-white";
    case "low":
      return "bg-yellow-500 text-black";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function statusColor(s: string) {
  switch (s) {
    case "open":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "fixed":
      return "bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400";
    case "ignored":
      return "bg-muted text-muted-foreground";
    case "wontfix":
      return "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400";
    default:
      return "";
  }
}

function SecurityPage() {
  const qc = useQueryClient();
  const [connectorFilter, setConnectorFilter] = useState<string>("__all__");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [severityFilter, setSeverityFilter] = useState<string>("__all__");
  const [search, setSearch] = useState("");
  const [historyFor, setHistoryFor] = useState<Finding | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const { data: findings, isLoading } = useQuery({
    queryKey: ["security_findings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("security_findings")
        .select("*")
        .order("last_seen_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Finding[];
    },
  });

  const connectors = useMemo(() => {
    const set = new Set((findings ?? []).map((f) => f.connector));
    return Array.from(set).sort();
  }, [findings]);

  const filtered = useMemo(() => {
    return (findings ?? []).filter((f) => {
      if (connectorFilter !== "__all__" && f.connector !== connectorFilter) return false;
      if (statusFilter !== "__all__" && f.status !== statusFilter) return false;
      if (severityFilter !== "__all__" && f.severity !== severityFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !f.title.toLowerCase().includes(q) &&
          !(f.description ?? "").toLowerCase().includes(q) &&
          !(f.resource ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [findings, connectorFilter, statusFilter, severityFilter, search]);

  const counts = useMemo(() => {
    const c = { total: 0, open: 0, fixed: 0, ignored: 0, critical: 0 };
    for (const f of findings ?? []) {
      c.total++;
      if (f.status === "open") c.open++;
      if (f.status === "fixed") c.fixed++;
      if (f.status === "ignored") c.ignored++;
      if (f.severity === "critical" && f.status === "open") c.critical++;
    }
    return c;
  }, [findings]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any)
        .from("security_findings")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["security_findings"] });
      toast.success("Estado atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("security_findings")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["security_findings"] });
      toast.success("Finding eliminado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6" /> Security Findings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vulnerabilidades detetadas pelos conectores de segurança (Wiz, Aikido, Supabase Linter, etc.)
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Registar finding
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total" value={counts.total} />
        <StatCard label="Em aberto" value={counts.open} tone="destructive" />
        <StatCard label="Críticos abertos" value={counts.critical} tone="destructive" />
        <StatCard label="Resolvidos" value={counts.fixed} tone="success" />
        <StatCard label="Ignorados" value={counts.ignored} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[180px]">
              <Label className="text-xs">Pesquisar</Label>
              <Input
                placeholder="Título, descrição, recurso…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Conector</Label>
              <Select value={connectorFilter} onValueChange={setConnectorFilter}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {connectors.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Estado</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Severidade</Label>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Nenhum finding encontrado. Os scans dos conectores são geridos ao nível do workspace —
              regista manualmente os findings que queres acompanhar aqui.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severidade</TableHead>
                  <TableHead>Conector</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Recurso</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Última deteção</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>
                      <Badge className={sevColor(f.severity)}>{f.severity}</Badge>
                    </TableCell>
                    <TableCell><Badge variant="outline">{f.connector}</Badge></TableCell>
                    <TableCell className="max-w-[360px]">
                      <div className="font-medium truncate">{f.title}</div>
                      {f.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1">{f.description}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground max-w-[180px] truncate">
                      {f.resource ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={f.status}
                        onValueChange={(v) => updateStatus.mutate({ id: f.id, status: v })}
                      >
                        <SelectTrigger className={`h-7 w-[110px] text-xs border ${statusColor(f.status)}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(f.last_seen_at), "dd MMM yyyy HH:mm", { locale: pt })}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {f.url && (
                        <Button asChild size="sm" variant="ghost">
                          <a href={f.url} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setHistoryFor(f)}>
                        <History className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm("Eliminar este finding?")) remove.mutate(f.id);
                        }}
                      >
                        ×
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <HistoryDialog finding={historyFor} onClose={() => setHistoryFor(null)} />
      <AddDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "destructive" | "success";
}) {
  const cls =
    tone === "destructive"
      ? "text-destructive"
      : tone === "success"
      ? "text-green-600 dark:text-green-400"
      : "";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold mt-1 ${cls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function HistoryDialog({ finding, onClose }: { finding: Finding | null; onClose: () => void }) {
  const { data: events, isLoading } = useQuery({
    queryKey: ["security_finding_events", finding?.id],
    enabled: !!finding,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("security_finding_events")
        .select("*")
        .eq("finding_id", finding!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Event[];
    },
  });

  return (
    <Dialog open={!!finding} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Histórico — {finding?.title}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (events ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem eventos registados.</p>
        ) : (
          <ol className="relative border-l ml-3 space-y-4">
            {(events ?? []).map((ev) => (
              <li key={ev.id} className="ml-4">
                <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-primary mt-1.5" />
                <div className="text-xs text-muted-foreground">
                  {format(new Date(ev.created_at), "dd MMM yyyy HH:mm", { locale: pt })}
                  {ev.actor_name ? ` · ${ev.actor_name}` : ""}
                </div>
                <div className="text-sm mt-0.5">
                  {ev.event_type === "created" && (
                    <>Criado com estado <Badge variant="outline">{ev.to_status}</Badge></>
                  )}
                  {ev.event_type === "status_change" && (
                    <>
                      Estado <Badge variant="outline">{ev.from_status}</Badge> →{" "}
                      <Badge variant="outline">{ev.to_status}</Badge>
                    </>
                  )}
                  {ev.event_type !== "created" && ev.event_type !== "status_change" && ev.event_type}
                </div>
                {ev.note && <div className="text-xs text-muted-foreground mt-1">{ev.note}</div>}
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    connector: "wiz",
    external_id: "",
    title: "",
    description: "",
    severity: "medium",
    status: "open",
    resource: "",
    url: "",
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("security_findings").insert({
        connector: form.connector,
        external_id: form.external_id || null,
        title: form.title,
        description: form.description || null,
        severity: form.severity,
        status: form.status,
        resource: form.resource || null,
        url: form.url || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["security_findings"] });
      toast.success("Finding registado");
      onClose();
      setForm({
        connector: "wiz",
        external_id: "",
        title: "",
        description: "",
        severity: "medium",
        status: "open",
        resource: "",
        url: "",
      });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registar security finding</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Conector</Label>
              <Select value={form.connector} onValueChange={(v) => setForm({ ...form, connector: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="wiz">Wiz</SelectItem>
                  <SelectItem value="aikido">Aikido</SelectItem>
                  <SelectItem value="supabase">Supabase Linter</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Severidade</Label>
              <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Título</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>ID externo</Label>
              <Input
                value={form.external_id}
                onChange={(e) => setForm({ ...form, external_id: e.target.value })}
              />
            </div>
            <div>
              <Label>Recurso</Label>
              <Input
                value={form.resource}
                onChange={(e) => setForm({ ...form, resource: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>URL</Label>
            <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={!form.title || create.isPending} onClick={() => create.mutate()}>
            Registar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}