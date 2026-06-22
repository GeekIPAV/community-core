import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Receipt, Wallet, Info } from "lucide-react";
import { SmartTable, type SmartColumnDef } from "@/components/smart-table";

export const Route = createFileRoute("/_app/meus-servicos")({
  component: MeusServicosPage,
});

type Tipo = { id: string; nome: string; unidade: string; preco_unitario: number; ativo: boolean };
type Registo = {
  id: string; tipo_servico_id: string;
  data_inicio: string; descricao: string | null;
  quantidade: number; preco_unitario_override: number | null;
  outros_custos: number; outros_custos_descricao: string | null;
  km: number | null; estado: "pendente" | "aprovado" | "pago";
};
type Pagamento = {
  id: string; data_pagamento: string; total: number;
  referencia: string | null; metodo: string | null; notas: string | null;
};

const fmtEUR = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });

const estadoBadge = (e: Registo["estado"]) => {
  if (e === "pendente") return <Badge className="bg-amber-500 hover:bg-amber-500">Pendente</Badge>;
  if (e === "aprovado") return <Badge className="bg-blue-600 hover:bg-blue-600">Aprovado</Badge>;
  return <Badge className="bg-emerald-600 hover:bg-emerald-600">Pago</Badge>;
};

function MeusServicosPage() {
  const { pessoa } = useAuth();
  const [authUid, setAuthUid] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthUid(data.user?.id ?? null));
  }, []);

  // Find this user's collaborator record. Try by auth_user_id, fall back to email.
  const { data: colab, isLoading: colabLoading } = useQuery({
    queryKey: ["meu_colaborador", authUid, pessoa?.email],
    enabled: !!authUid,
    queryFn: async () => {
      const byAuth = await supabase.from("colaboradores")
        .select("id, nome_completo, email, ativo")
        .eq("auth_user_id", authUid!).maybeSingle();
      if (byAuth.error) throw byAuth.error;
      if (byAuth.data) return byAuth.data;
      if (pessoa?.email) {
        const byEmail = await supabase.from("colaboradores")
          .select("id, nome_completo, email, ativo")
          .ilike("email", pessoa.email).maybeSingle();
        if (byEmail.error) throw byEmail.error;
        return byEmail.data;
      }
      return null;
    },
  });

  if (colabLoading || !authUid) return <Skeleton className="h-64 w-full" />;

  if (!colab) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-3">
        <Info className="h-10 w-10 mx-auto text-muted-foreground" />
        <h1 className="text-xl font-semibold">Os meus serviços</h1>
        <p className="text-sm text-muted-foreground">
          Esta área é para colaboradores. Ainda não existe um registo de colaborador associado à sua conta.
          Contacte a equipa para ser adicionado.
        </p>
      </div>
    );
  }

  return <ColabSelfArea colaboradorId={colab.id} nome={colab.nome_completo} />;
}

function ColabSelfArea({ colaboradorId, nome }: { colaboradorId: string; nome: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: tipos } = useQuery({
    queryKey: ["tipos_servico_self"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tipos_servico")
        .select("id, nome, unidade, preco_unitario, ativo")
        .eq("ativo", true).order("nome");
      if (error) throw error;
      return data as Tipo[];
    },
  });
  const tipoMap = useMemo(() => new Map((tipos ?? []).map((t) => [t.id, t])), [tipos]);

  const { data: registos } = useQuery({
    queryKey: ["meus_registos", colaboradorId],
    queryFn: async () => {
      const { data, error } = await supabase.from("registos_servico")
        .select("id, tipo_servico_id, data_inicio, descricao, quantidade, preco_unitario_override, outros_custos, outros_custos_descricao, km, estado")
        .eq("colaborador_id", colaboradorId).order("data_inicio", { ascending: false });
      if (error) throw error;
      return data as Registo[];
    },
  });

  const { data: pagamentos } = useQuery({
    queryKey: ["meus_pagamentos", colaboradorId],
    queryFn: async () => {
      const { data, error } = await supabase.from("pagamentos")
        .select("id, data_pagamento, total, referencia, metodo, notas")
        .eq("colaborador_id", colaboradorId).order("data_pagamento", { ascending: false });
      if (error) throw error;
      return data as Pagamento[];
    },
  });

  const totals = useMemo(() => {
    const t = (registos ?? []).reduce((acc, r) => {
      const preco = r.preco_unitario_override ?? (tipoMap.get(r.tipo_servico_id)?.preco_unitario ?? 0);
      const v = Number(preco) * Number(r.quantidade) + Number(r.outros_custos ?? 0);
      acc.total += v;
      if (r.estado === "pendente") acc.pendente += v;
      if (r.estado === "aprovado") acc.aprovado += v;
      if (r.estado === "pago") acc.pago += v;
      return acc;
    }, { total: 0, pendente: 0, aprovado: 0, pago: 0 });
    return t;
  }, [registos, tipoMap]);

  type Form = Partial<{
    tipo_servico_id: string; data_inicio: string; descricao: string;
    quantidade: number; outros_custos: number; outros_custos_descricao: string; km: number;
  }>;
  const [form, setForm] = useState<Form>({
    data_inicio: new Date().toISOString().slice(0, 10), quantidade: 1, outros_custos: 0,
  });

  const precoUn = form.tipo_servico_id ? (tipoMap.get(form.tipo_servico_id)?.preco_unitario ?? 0) : 0;
  const calc = Number(precoUn) * Number(form.quantidade ?? 0);
  const totalPreview = calc + Number(form.outros_custos ?? 0);

  type RegRow = Registo & { _tipo: string; _unidade: string; _total: number };
  const registosRows = useMemo<RegRow[]>(() => (registos ?? []).map((r) => {
    const tipo = tipoMap.get(r.tipo_servico_id);
    const preco = r.preco_unitario_override ?? (tipo?.preco_unitario ?? 0);
    return {
      ...r,
      _tipo: tipo?.nome ?? "—",
      _unidade: tipo?.unidade ?? "",
      _total: Number(preco) * Number(r.quantidade) + Number(r.outros_custos ?? 0),
    };
  }), [registos, tipoMap]);

  const registosColumns = useMemo<SmartColumnDef<RegRow>[]>(() => [
    { id: "data_inicio", accessorKey: "data_inicio", header: "Data", size: 130,
      meta: { label: "Data", filterVariant: "date" },
      cell: ({ getValue }) => <span className="text-sm whitespace-nowrap">{new Date(String(getValue())).toLocaleDateString("pt-PT")}</span> },
    { id: "_tipo", accessorKey: "_tipo", header: "Serviço", size: 280,
      meta: { label: "Serviço", filterVariant: "text" },
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{row.original._tipo}</div>
          {row.original.descricao && <div className="text-xs text-muted-foreground truncate">{row.original.descricao}</div>}
        </div>
      ) },
    { id: "quantidade", accessorKey: "quantidade", header: "Qtd", size: 110,
      meta: { label: "Qtd", filterVariant: "number" },
      cell: ({ row }) => <span className="block text-right tabular-nums">{Number(row.original.quantidade)} {row.original._unidade}</span> },
    { id: "_total", accessorKey: "_total", header: "Total", size: 120,
      meta: { label: "Total", filterVariant: "number" },
      cell: ({ getValue }) => <span className="block text-right tabular-nums font-semibold">{fmtEUR(Number(getValue() ?? 0))}</span> },
    { id: "estado", accessorKey: "estado", header: "Estado", size: 120,
      meta: { label: "Estado", filterVariant: "select", filterOptions: ["pendente", "aprovado", "pago"] },
      cell: ({ getValue }) => estadoBadge(getValue() as Registo["estado"]) },
  ], []);

  const pagamentosColumns = useMemo<SmartColumnDef<Pagamento>[]>(() => [
    { id: "data_pagamento", accessorKey: "data_pagamento", header: "Data", size: 130,
      meta: { label: "Data", filterVariant: "date" },
      cell: ({ getValue }) => <span className="text-sm whitespace-nowrap">{new Date(String(getValue())).toLocaleDateString("pt-PT")}</span> },
    { id: "referencia", accessorKey: "referencia", header: "Referência", size: 240,
      meta: { label: "Referência", filterVariant: "text" },
      cell: ({ getValue }) => <span>{(getValue() as string) ?? "—"}</span> },
    { id: "metodo", accessorKey: "metodo", header: "Método", size: 180,
      meta: { label: "Método", filterVariant: "text", hideOnMobile: true },
      cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) ?? "—"}</span> },
    { id: "total", accessorKey: "total", header: "Total", size: 120,
      meta: { label: "Total", filterVariant: "number" },
      cell: ({ getValue }) => <span className="block text-right tabular-nums font-semibold">{fmtEUR(Number(getValue() ?? 0))}</span> },
  ], []);

  const create = useMutation({
    mutationFn: async () => {
      if (!form.tipo_servico_id) throw new Error("Tipo de serviço obrigatório");
      if (!form.data_inicio) throw new Error("Data obrigatória");
      const { error } = await supabase.from("registos_servico").insert({
        colaborador_id: colaboradorId,
        tipo_servico_id: form.tipo_servico_id,
        data_inicio: form.data_inicio,
        descricao: form.descricao?.trim() || null,
        quantidade: Number(form.quantidade) || 1,
        outros_custos: Number(form.outros_custos) || 0,
        outros_custos_descricao: form.outros_custos_descricao?.trim() || null,
        km: form.km != null && (form.km as unknown as string) !== "" ? Number(form.km) : null,
        estado: "pendente",
        submetido_pelo_colaborador: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Serviço submetido para aprovação");
      qc.invalidateQueries({ queryKey: ["meus_registos", colaboradorId] });
      setOpen(false);
      setForm({ data_inicio: new Date().toISOString().slice(0, 10), quantidade: 1, outros_custos: 0 });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Os meus serviços</h1>
        <p className="text-sm text-muted-foreground">Olá {nome} — submete serviços prestados e consulta o teu histórico de pagamentos.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Acumulado" value={fmtEUR(totals.total)} />
        <Card label="Pendente" value={fmtEUR(totals.pendente)} tone="text-amber-600 dark:text-amber-400" />
        <Card label="Aprovado" value={fmtEUR(totals.aprovado)} tone="text-blue-600 dark:text-blue-400" />
        <Card label="Pago" value={fmtEUR(totals.pago)} tone="text-emerald-600 dark:text-emerald-400" />
      </div>

      <Tabs defaultValue="servicos">
        <TabsList>
          <TabsTrigger value="servicos"><Receipt className="mr-2 h-4 w-4" />Os meus registos</TabsTrigger>
          <TabsTrigger value="pagamentos"><Wallet className="mr-2 h-4 w-4" />Pagamentos recebidos</TabsTrigger>
        </TabsList>

        <TabsContent value="servicos" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Registar novo serviço</Button>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(registos ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Ainda não submeteu nenhum serviço.</TableCell></TableRow>
                )}
                {(registos ?? []).map((r) => {
                  const tipo = tipoMap.get(r.tipo_servico_id);
                  const preco = r.preco_unitario_override ?? (tipo?.preco_unitario ?? 0);
                  const v = Number(preco) * Number(r.quantidade) + Number(r.outros_custos ?? 0);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{new Date(r.data_inicio).toLocaleDateString("pt-PT")}</TableCell>
                      <TableCell>
                        <div className="font-medium">{tipo?.nome ?? "—"}</div>
                        {r.descricao && <div className="text-xs text-muted-foreground truncate max-w-xs">{r.descricao}</div>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{Number(r.quantidade)} {tipo?.unidade ?? ""}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{fmtEUR(v)}</TableCell>
                      <TableCell>{estadoBadge(r.estado)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="pagamentos" className="mt-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Referência</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(pagamentos ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sem pagamentos recebidos.</TableCell></TableRow>
                )}
                {(pagamentos ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">{new Date(p.data_pagamento).toLocaleDateString("pt-PT")}</TableCell>
                    <TableCell>{p.referencia ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.metodo ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{fmtEUR(p.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Registar novo serviço</DialogTitle>
            <DialogDescription>O serviço fica pendente até ser aprovado pela equipa.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Tipo de serviço *</Label>
              <Select value={form.tipo_servico_id ?? ""} onValueChange={(v) => setForm({ ...form, tipo_servico_id: v })}>
                <SelectTrigger><SelectValue placeholder="Escolher…" /></SelectTrigger>
                <SelectContent>
                  {(tipos ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.nome} — {fmtEUR(t.preco_unitario)}/{t.unidade}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Data *</Label><Input type="date" value={form.data_inicio ?? ""} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></div>
            <div><Label>Quantidade *</Label><Input type="number" step="0.01" value={form.quantidade ?? 1} onChange={(e) => setForm({ ...form, quantidade: Number(e.target.value) })} /></div>
            <div className="col-span-2"><Label>Descrição</Label><Textarea value={form.descricao ?? ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Descreve brevemente o serviço prestado" /></div>
            <div><Label>Outros custos (€)</Label><Input type="number" step="0.01" value={form.outros_custos ?? 0} onChange={(e) => setForm({ ...form, outros_custos: Number(e.target.value) })} /></div>
            <div><Label>KM (opcional)</Label><Input type="number" step="0.01" value={form.km ?? ""} onChange={(e) => setForm({ ...form, km: e.target.value === "" ? undefined : Number(e.target.value) })} /></div>
            <div className="col-span-2"><Label>Descrição outros custos</Label><Input value={form.outros_custos_descricao ?? ""} onChange={(e) => setForm({ ...form, outros_custos_descricao: e.target.value })} placeholder="ex.: transporte, materiais" /></div>
            <div className="col-span-2 rounded-md border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{Number(form.quantidade ?? 0)} × {fmtEUR(precoUn)}</span><span className="tabular-nums">{fmtEUR(calc)}</span></div>
              {Number(form.outros_custos ?? 0) > 0 && <div className="flex justify-between text-xs text-muted-foreground"><span>Outros custos</span><span className="tabular-nums">{fmtEUR(form.outros_custos)}</span></div>}
              <div className="flex justify-between font-semibold mt-1 pt-1 border-t"><span>Total</span><span className="tabular-nums">{fmtEUR(totalPreview)}</span></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>Submeter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Card({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${tone ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}