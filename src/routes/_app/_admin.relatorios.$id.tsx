import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { InlineMultiSelect } from "@/components/inline-edit";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, ChevronDown, Download, FileText, GripVertical, Loader2, MoreVertical,
  Printer, CheckCircle2, Copy as CopyIcon, Send, Trash2,
} from "lucide-react";
import {
  estadoColor, ESTADOS_RELATORIO,
  type Relatorio, type RelatorioEstado, type Secao, type SecaoTipo,
} from "@/lib/relatorios/types";
import { SecaoRenderer } from "@/components/relatorios/secoes";
import { SecaoAddPopover } from "@/components/relatorios/secao-add-popover";
import { RelatorioDataPanel } from "@/components/relatorios/data-panel";
import { relatorioToTexto } from "@/lib/relatorios/export-texto";
import { exportRelatorioDocx, type ExportSnapshot } from "@/lib/relatorios/export-docx";
import { fetchPeriodoDados } from "@/lib/relatorios/use-periodo-dados";

function effectiveProjetoIds(r: Relatorio): string[] {
  if (r.geral) return [];
  if (r.projeto_ids && r.projeto_ids.length > 0) return r.projeto_ids;
  if (r.projeto_id) return [r.projeto_id];
  return [];
}

export const Route = createFileRoute("/_app/_admin/relatorios/$id")({
  component: RelatorioEditorPage,
});

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-PT") : "—");
const periodoFmt = (a: string, b: string) =>
  `${new Date(a).toLocaleDateString("pt-PT", { month: "short", year: "numeric" })} → ${new Date(b).toLocaleDateString("pt-PT", { month: "short", year: "numeric" })}`;

function RelatorioEditorPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const snapshotRef = useRef<ExportSnapshot>({ porSecao: {} });
  const [savingCount, setSavingCount] = useState(0);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: relatorio, isLoading } = useQuery({
    queryKey: ["relatorio", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("relatorios" as any).select("*").eq("id", id).single();
      if (error) throw error;
      return data as unknown as Relatorio;
    },
  });

  const { data: secoes } = useQuery({
    queryKey: ["relatorio-secoes", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("relatorio_secoes" as any).select("*").eq("relatorio_id", id).order("position");
      if (error) throw error;
      return (data ?? []) as unknown as Secao[];
    },
  });

  // ─── Mutations ─────────────────────────────────────────────
  const patchRelatorio = useMutation({
    mutationFn: async (patch: Partial<Relatorio>) => {
      const { error } = await supabase.from("relatorios" as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onMutate: () => setSavingCount((n) => n + 1),
    onSettled: () => {
      setSavingCount((n) => Math.max(0, n - 1));
      qc.invalidateQueries({ queryKey: ["relatorio", id] });
      qc.invalidateQueries({ queryKey: ["relatorios"] });
      qc.invalidateQueries({ queryKey: ["sidebar-badge"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro a guardar"),
  });

  const patchSecao = useMutation({
    mutationFn: async (args: { secaoId: string; patch: Partial<Secao> }) => {
      const { error } = await supabase.from("relatorio_secoes" as any).update(args.patch).eq("id", args.secaoId);
      if (error) throw error;
    },
    onMutate: async (args) => {
      setSavingCount((n) => n + 1);
      const key = ["relatorio-secoes", id];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Secao[]>(key);
      qc.setQueryData<Secao[]>(key, (old) =>
        (old ?? []).map((s) => (s.id === args.secaoId ? { ...s, ...args.patch } : s)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["relatorio-secoes", id], ctx.prev);
      toast.error("Erro a guardar");
    },
    onSettled: () => setSavingCount((n) => Math.max(0, n - 1)),
  });

  const addSecao = useMutation({
    mutationFn: async (args: { tipo: SecaoTipo; position: number }) => {
      // Bump positions of subsequent sections first
      const list = secoes ?? [];
      const toBump = list.filter((s) => s.position >= args.position);
      for (const s of toBump) {
        await supabase.from("relatorio_secoes" as any).update({ position: s.position + 1 }).eq("id", s.id);
      }
      const { error } = await supabase.from("relatorio_secoes" as any).insert({
        relatorio_id: id, tipo: args.tipo, titulo: null, conteudo_texto: null, config: {}, position: args.position,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["relatorio-secoes", id] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const deleteSecao = useMutation({
    mutationFn: async (secaoId: string) => {
      const { error } = await supabase.from("relatorio_secoes" as any).delete().eq("id", secaoId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["relatorio-secoes", id] }),
  });

  const duplicateSecao = useMutation({
    mutationFn: async (secao: Secao) => {
      const list = secoes ?? [];
      const newPos = secao.position + 1;
      const toBump = list.filter((s) => s.position >= newPos);
      for (const s of toBump) {
        await supabase.from("relatorio_secoes" as any).update({ position: s.position + 1 }).eq("id", s.id);
      }
      const { error } = await supabase.from("relatorio_secoes" as any).insert({
        relatorio_id: id, tipo: secao.tipo, titulo: secao.titulo, conteudo_texto: secao.conteudo_texto,
        config: secao.config, position: newPos,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["relatorio-secoes", id] }),
  });

  const moveSecao = useMutation({
    mutationFn: async (args: { secao: Secao; dir: -1 | 1 }) => {
      const list = (secoes ?? []).slice().sort((a, b) => a.position - b.position);
      const idx = list.findIndex((s) => s.id === args.secao.id);
      const targetIdx = idx + args.dir;
      if (targetIdx < 0 || targetIdx >= list.length) return;
      const a = list[idx], b = list[targetIdx];
      await supabase.from("relatorio_secoes" as any).update({ position: b.position }).eq("id", a.id);
      await supabase.from("relatorio_secoes" as any).update({ position: a.position }).eq("id", b.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["relatorio-secoes", id] }),
  });

  const deleteRelatorio = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("relatorios" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Relatório eliminado");
      qc.invalidateQueries({ queryKey: ["relatorios"] });
      window.location.href = "/relatorios";
    },
  });

  // ─── Snapshot callback (recebido das secções) ─────────────
  const handleSecaoData = (secaoId: string, payload: any) => {
    snapshotRef.current.porSecao[secaoId] = {
      ...(snapshotRef.current.porSecao[secaoId] ?? {}),
      ...payload,
    };
  };

  // ─── Export handlers ──────────────────────────────────────
  const copiarTexto = async () => {
    if (!relatorio || !secoes) return;
    const txt = relatorioToTexto(relatorio, secoes);
    try {
      await navigator.clipboard.writeText(txt);
      toast.success("Texto copiado ✓");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const exportarWord = async () => {
    if (!relatorio || !secoes) return;
    try {
      await exportRelatorioDocx(relatorio, secoes, snapshotRef.current);
      toast.success("Word exportado ✓");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao exportar");
    }
  };

  const imprimir = () => window.print();

  // ─── Submeter ─────────────────────────────────────────────
  const submeter = useMutation({
    mutationFn: async () => {
      if (!relatorio) return;
      const today = new Date().toISOString().slice(0, 10);
      // 1. Snapshot
      const ids = effectiveProjetoIds(relatorio);
      const dados = await fetchPeriodoDados(
        relatorio.periodo_inicio,
        relatorio.periodo_fim,
        ids.length > 0 ? ids : null,
      );
      await supabase.from("relatorio_snapshots" as any).insert({
        relatorio_id: relatorio.id,
        dados: { quick_stats: dados, por_secao: snapshotRef.current.porSecao },
      });
      // 2. Update estado
      const { error } = await supabase.from("relatorios" as any).update({
        estado: "Submetido",
        data_submissao_real: today,
      }).eq("id", relatorio.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Relatório marcado como submetido ✓");
      setSubmitOpen(false);
      qc.invalidateQueries({ queryKey: ["relatorio", id] });
      qc.invalidateQueries({ queryKey: ["relatorios"] });
      qc.invalidateQueries({ queryKey: ["sidebar-badge"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro a submeter"),
  });

  const orderedSecoes = useMemo(
    () => (secoes ?? []).slice().sort((a, b) => a.position - b.position),
    [secoes],
  );

  if (isLoading || !relatorio) {
    return <div className="space-y-3"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-32 w-full" /></div>;
  }

  const relProjetoIds = effectiveProjetoIds(relatorio);

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <Link to="/relatorios" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground" data-print-hide="true">
        <ArrowLeft className="me-1 h-3 w-3" /> Relatórios
      </Link>

      {/* Top sticky bar */}
      <div data-relatorio-toolbar className="sticky top-0 z-20 -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-b">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <TituloInline value={relatorio.titulo} onSave={(v) => patchRelatorio.mutate({ titulo: v })} />
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="font-normal">{relatorio.financiador}</Badge>
              <Badge variant="outline" className="font-normal">{relatorio.tipo}</Badge>
              <span>{periodoFmt(relatorio.periodo_inicio, relatorio.periodo_fim)}</span>
              {relatorio.data_submissao_prevista && (
                <span>· Submissão prevista: {fmtDate(relatorio.data_submissao_prevista)}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <SavingIndicator saving={savingCount > 0} />
            <EstadoDropdown
              value={relatorio.estado}
              onChange={(v) => patchRelatorio.mutate({ estado: v })}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="me-1 h-3.5 w-3.5" /> Exportar <ChevronDown className="ms-1 h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={copiarTexto}><CopyIcon className="me-2 h-4 w-4" /> Copiar texto</DropdownMenuItem>
                <DropdownMenuItem onClick={exportarWord}><FileText className="me-2 h-4 w-4" /> Exportar Word</DropdownMenuItem>
                <DropdownMenuItem onClick={imprimir}><Printer className="me-2 h-4 w-4" /> Imprimir</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {relatorio.estado === "Aprovado" && (
              <Button size="sm" onClick={() => setSubmitOpen(true)}>
                <Send className="me-1 h-3.5 w-3.5" /> Submeter
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9"><MoreVertical className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="text-destructive focus:text-destructive">
                  <Trash2 className="me-2 h-4 w-4" /> Eliminar relatório
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_18rem] gap-6">
        {/* DOCUMENTO */}
        <div data-relatorio-doc className="space-y-2">
          {orderedSecoes.length === 0 && (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Este relatório ainda não tem secções.
              <div className="mt-3 flex justify-center">
                <SecaoAddPopover onAdd={(t) => addSecao.mutate({ tipo: t, position: 0 })} />
              </div>
            </div>
          )}

          {orderedSecoes.map((s, idx) => (
            <div key={s.id}>
              <SecaoCard
                secao={s}
                index={idx}
                total={orderedSecoes.length}
                relatorio={relatorio}
                onPatch={(patch) => patchSecao.mutate({ secaoId: s.id, patch })}
                onDelete={() => deleteSecao.mutate(s.id)}
                onDuplicate={() => duplicateSecao.mutate(s)}
                onMove={(dir) => moveSecao.mutate({ secao: s, dir })}
                onDataReady={(payload) => handleSecaoData(s.id, payload)}
              />
              <div className="group/add flex justify-center my-1" data-print-hide="true">
                <div className="opacity-0 group-hover/add:opacity-100 transition-opacity">
                  <SecaoAddPopover compact onAdd={(t) => addSecao.mutate({ tipo: t, position: idx + 1 })} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* DATA PANEL */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <RelatorioDataPanel inicio={relatorio.periodo_inicio} fim={relatorio.periodo_fim} />
        </div>
      </div>

      {/* Submeter dialog */}
      <AlertDialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar como submetido a {relatorio.financiador}?</AlertDialogTitle>
            <AlertDialogDescription>
              Data de submissão: <strong>{new Date().toLocaleDateString("pt-PT")}</strong>.
              <br />
              Esta ação guarda um snapshot dos dados atuais para registo histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); submeter.mutate(); }}>
              {submeter.isPending ? "A submeter…" : "Submeter"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar relatório?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente e elimina todas as secções e snapshots.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); deleteRelatorio.mutate(); }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
function TituloInline({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <Input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { if (v !== value && v.trim()) onSave(v.trim()); }}
      className="text-xl font-semibold border-0 px-0 shadow-none focus-visible:ring-0 h-auto"
    />
  );
}

function SavingIndicator({ saving }: { saving: boolean }) {
  if (saving) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> A guardar…
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Guardado
    </span>
  );
}

function EstadoDropdown({ value, onChange }: { value: RelatorioEstado; onChange: (v: RelatorioEstado) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium", estadoColor[value])}>
          {value} <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {ESTADOS_RELATORIO.map((e) => (
          <DropdownMenuItem key={e} onClick={() => onChange(e)}>{e}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SecaoCard({
  secao, index, total, relatorio, onPatch, onDelete, onDuplicate, onMove, onDataReady,
}: {
  secao: Secao;
  index: number;
  total: number;
  relatorio: Relatorio;
  onPatch: (patch: Partial<Pick<Secao, "titulo" | "conteudo_texto" | "config">>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (dir: -1 | 1) => void;
  onDataReady: (snapshot: any) => void;
}) {
  if (secao.tipo === "separador") {
    return (
      <div className="group/sec relative" data-relatorio-section data-tipo="separador">
        <SecaoMenu
          onMoveUp={index > 0 ? () => onMove(-1) : undefined}
          onMoveDown={index < total - 1 ? () => onMove(1) : undefined}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
        <SecaoRenderer
          secao={secao}
          relPeriodoInicio={relatorio.periodo_inicio}
          relPeriodoFim={relatorio.periodo_fim}
          relProjetoId={relatorio.projeto_id}
          onPatch={onPatch}
          onDataReady={onDataReady}
        />
      </div>
    );
  }
  return (
    <div className="group/sec relative rounded-lg border bg-card p-5 hover:border-foreground/20 transition-colors" data-relatorio-section data-tipo={secao.tipo}>
      <div className="absolute -left-7 top-6 opacity-0 group-hover/sec:opacity-100 transition-opacity hidden md:block" data-relatorio-drag>
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex items-start justify-between gap-2 mb-1">
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-normal text-muted-foreground">
          {secao.tipo}
        </Badge>
        <SecaoMenu
          onMoveUp={index > 0 ? () => onMove(-1) : undefined}
          onMoveDown={index < total - 1 ? () => onMove(1) : undefined}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      </div>
      <SecaoRenderer
        secao={secao}
        relPeriodoInicio={relatorio.periodo_inicio}
        relPeriodoFim={relatorio.periodo_fim}
        relProjetoId={relatorio.projeto_id}
        onPatch={onPatch}
        onDataReady={onDataReady}
      />
    </div>
  );
}

function SecaoMenu({
  onMoveUp, onMoveDown, onDuplicate, onDelete,
}: {
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover/sec:opacity-100 transition-opacity" data-relatorio-section-menu>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onMoveUp && <DropdownMenuItem onClick={onMoveUp}>Mover para cima</DropdownMenuItem>}
        {onMoveDown && <DropdownMenuItem onClick={onMoveDown}>Mover para baixo</DropdownMenuItem>}
        <DropdownMenuItem onClick={onDuplicate}>Duplicar</DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">Eliminar</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}