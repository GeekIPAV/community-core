import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/_admin/financiamentos/")({
  component: FinanciamentosListPage,
});

export type Financiamento = {
  id: string;
  nome: string;
  financiador: string;
  tipo: "Grant" | "Prémio" | "Contrato" | "Donativo";
  valor_total: number | null;
  data_inicio: string | null;
  data_fim: string | null;
  estado:
    | "Candidatura submetida"
    | "Aprovado"
    | "Em execução"
    | "Encerrado"
    | "Rejeitado";
  referencia: string | null;
  responsavel: string | null;
  notas: string | null;
  created_at: string;
};

export const TIPOS: Financiamento["tipo"][] = ["Grant", "Prémio", "Contrato", "Donativo"];
export const ESTADOS: Financiamento["estado"][] = [
  "Candidatura submetida",
  "Aprovado",
  "Em execução",
  "Encerrado",
  "Rejeitado",
];

export const estadoVariant = (
  estado: Financiamento["estado"],
): "default" | "secondary" | "outline" | "destructive" => {
  switch (estado) {
    case "Aprovado":
    case "Em execução":
      return "default";
    case "Encerrado":
      return "secondary";
    case "Rejeitado":
      return "destructive";
    default:
      return "outline";
  }
};

export const formatEuro = (v: number | null | undefined) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("pt-PT", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(v);

export const formatPeriodo = (inicio: string | null, fim: string | null) => {
  const fmt = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString("pt-PT", { month: "short", year: "numeric" })
      : "—";
  return `${fmt(inicio)} → ${fmt(fim)}`;
};

function FinanciamentosListPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: financiamentos, isLoading } = useQuery({
    queryKey: ["financiamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financiamentos" as any)
        .select("*")
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown) as Financiamento[];
    },
  });

  const create = useMutation({
    mutationFn: async (payload: Partial<Financiamento>) => {
      const { error } = await supabase.from("financiamentos" as any).insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Financiamento criado");
      qc.invalidateQueries({ queryKey: ["financiamentos"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro a criar"),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Financiamentos</h1>
          <p className="text-sm text-muted-foreground">
            Gestão de financiamentos e ligação aos indicadores M&amp;A.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="me-2 h-4 w-4" /> Novo financiamento
            </Button>
          </DialogTrigger>
          <NovoFinanciamentoDialog onSubmit={(v) => create.mutate(v)} />
        </Dialog>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Financiador</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Referência</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  A carregar…
                </TableCell>
              </TableRow>
            ) : (financiamentos ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  Sem financiamentos registados.
                </TableCell>
              </TableRow>
            ) : (
              (financiamentos ?? []).map((f) => (
                <TableRow key={f.id} className="cursor-pointer">
                  <TableCell>
                    <Link
                      to="/financiamentos/$financiamentoId"
                      params={{ financiamentoId: f.id }}
                      className="font-medium hover:underline"
                    >
                      {f.nome}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{f.financiador}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{f.tipo}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatEuro(f.valor_total)}</TableCell>
                  <TableCell className="text-sm">{formatPeriodo(f.data_inicio, f.data_fim)}</TableCell>
                  <TableCell>
                    <Badge variant={estadoVariant(f.estado)} className="font-normal">
                      {f.estado}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{f.referencia ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function NovoFinanciamentoDialog({
  onSubmit,
}: {
  onSubmit: (v: Partial<Financiamento>) => void;
}) {
  const [form, setForm] = useState<Partial<Financiamento>>({
    tipo: "Grant",
    estado: "Candidatura submetida",
  });
  const set = (k: keyof Financiamento, v: any) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <DialogTitle>Novo financiamento</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1">
          <Label>Nome</Label>
          <Input value={form.nome ?? ""} onChange={(e) => set("nome", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Financiador</Label>
          <Input value={form.financiador ?? ""} onChange={(e) => set("financiador", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Tipo</Label>
          <Select value={form.tipo} onValueChange={(v) => set("tipo", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Valor total (€)</Label>
          <Input type="number" value={form.valor_total ?? ""} onChange={(e) => set("valor_total", e.target.value ? Number(e.target.value) : null)} />
        </div>
        <div className="space-y-1">
          <Label>Estado</Label>
          <Select value={form.estado} onValueChange={(v) => set("estado", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ESTADOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Data início</Label>
          <Input type="date" value={form.data_inicio ?? ""} onChange={(e) => set("data_inicio", e.target.value || null)} />
        </div>
        <div className="space-y-1">
          <Label>Data fim</Label>
          <Input type="date" value={form.data_fim ?? ""} onChange={(e) => set("data_fim", e.target.value || null)} />
        </div>
        <div className="space-y-1">
          <Label>Referência</Label>
          <Input value={form.referencia ?? ""} onChange={(e) => set("referencia", e.target.value || null)} />
        </div>
        <div className="space-y-1">
          <Label>Responsável</Label>
          <Input value={form.responsavel ?? ""} onChange={(e) => set("responsavel", e.target.value || null)} />
        </div>
        <div className="col-span-2 space-y-1">
          <Label>Notas</Label>
          <Textarea value={form.notas ?? ""} onChange={(e) => set("notas", e.target.value || null)} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSubmit(form)} disabled={!form.nome || !form.financiador}>
          Criar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}