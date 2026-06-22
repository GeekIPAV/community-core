import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronDown, Trash2, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Colab = { id: string; nome_completo: string; ativo: boolean };
type Tipo = { id: string; nome: string; unidade: string; preco_unitario: number; ativo: boolean };

type RowStatus = "ready" | "warning" | "error";
type Confidence = "exact" | "fuzzy" | "none";

export type ParsedRow = {
  raw: string;
  rawFields: string[];
  colaborador_id: string | null;
  colaboradorInput: string;
  colaboradorConfidence: Confidence;
  tipo_servico_id: string | null;
  tipoInput: string;
  tipoConfidence: Confidence;
  data: string | null; // ISO YYYY-MM-DD
  dataInput: string;
  descricao: string;
  quantidade: number;
  valor: number | null; // user provided override
  valorProvided: boolean;
  outrosCustos: number;
  outrosCustosDescricao: string;
};

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function matchColab(input: string, colabs: Colab[]): { id: string | null; conf: Confidence } {
  const n = norm(input);
  if (!n) return { id: null, conf: "none" };
  const exact = colabs.find((c) => norm(c.nome_completo) === n);
  if (exact) return { id: exact.id, conf: "exact" };
  const firstName = colabs.find((c) => norm(c.nome_completo).split(" ")[0] === n);
  if (firstName) {
    const ambiguous = colabs.filter((c) => norm(c.nome_completo).split(" ")[0] === n);
    return { id: firstName.id, conf: ambiguous.length === 1 ? "exact" : "fuzzy" };
  }
  const fuzzy = colabs.find((c) => {
    const cn = norm(c.nome_completo);
    return cn.includes(n) || n.includes(cn);
  });
  if (fuzzy) return { id: fuzzy.id, conf: "fuzzy" };
  return { id: null, conf: "none" };
}

function matchTipo(input: string, tipos: Tipo[]): { id: string | null; conf: Confidence } {
  const n = norm(input);
  if (!n) return { id: null, conf: "none" };
  const exact = tipos.find((t) => norm(t.nome) === n);
  if (exact) return { id: exact.id, conf: "exact" };
  const contains = tipos.find((t) => norm(t.nome).includes(n) || n.includes(norm(t.nome)));
  if (contains) return { id: contains.id, conf: "fuzzy" };
  const inputWords = n.split(/\s+/).filter(Boolean);
  const wordMatch = tipos.find((t) => {
    const tw = norm(t.nome).split(/\s+/);
    return inputWords.some((w) => tw.some((x) => x === w || (w.length > 3 && x.includes(w))));
  });
  if (wordMatch) return { id: wordMatch.id, conf: "fuzzy" };
  return { id: null, conf: "none" };
}

function parseDate(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    let y = m[3];
    if (y.length === 2) y = "20" + y;
    return `${y}-${mo}-${d}`;
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return null;
}

function parseValue(input: string): number | null {
  if (!input || !input.trim()) return null;
  const cleaned = input.replace(/[€\s]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parseImportText(raw: string, colabs: Colab[], tipos: Tipo[]): ParsedRow[] {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  const sep = (() => {
    const semi = (raw.match(/;/g) ?? []).length;
    const comma = (raw.match(/,/g) ?? []).length;
    return semi > comma ? ";" : ",";
  })();
  return lines.map((line) => {
    const fields = line.split(sep).map((f) => f.trim());
    const [nameRaw = "", dateRaw = "", descRaw = "", tipoRaw = "", qtyRaw = "", valRaw = "", outrosRaw = "", outrosDescRaw = ""] = fields;
    const c = matchColab(nameRaw, colabs);
    const t = matchTipo(tipoRaw, tipos);
    const qty = Number(qtyRaw.replace(",", ".")) || 1;
    const val = parseValue(valRaw);
    const outros = parseValue(outrosRaw) ?? 0;
    return {
      raw: line,
      rawFields: fields,
      colaborador_id: c.id,
      colaboradorInput: nameRaw,
      colaboradorConfidence: c.conf,
      tipo_servico_id: t.id,
      tipoInput: tipoRaw,
      tipoConfidence: t.conf,
      data: parseDate(dateRaw),
      dataInput: dateRaw,
      descricao: descRaw,
      quantidade: qty,
      valor: val,
      valorProvided: !!valRaw.trim() && val !== null,
      outrosCustos: outros,
      outrosCustosDescricao: outrosDescRaw,
    };
  });
}

export function rowStatus(r: ParsedRow): RowStatus {
  if (!r.colaborador_id || !r.tipo_servico_id || !r.data) return "error";
  if (r.colaboradorConfidence === "fuzzy" || r.tipoConfidence === "fuzzy") return "warning";
  return "ready";
}

const PLACEHOLDER = `Formato: Colaboradora, Data, Descrição, Tipo de Serviço, Qtd, Valor[, Outros Custos[, Desc. Outros Custos]]

Exemplo com outros custos:
Safaa, 23/02/2025, Reunião mesquita, Reunião de Parceiros, 1, 48.24, 12.50, Transportes
Safaa, 30/03/2025, Reunião AFAQ, Reunião de Parceiros, 1, 77.52
Rana, 01/03/2025, Tradução Afaq, Tradução de Documento, 4, 50.00, 0,`;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  colaboradores: Colab[];
  tipos: Tipo[];
  onImported: () => void;
};

export function BulkImportDialog({ open, onOpenChange, colaboradores, tipos, onImported }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [text, setText] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem("bulk_import_text") ?? "";
  });
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [approveAll, setApproveAll] = useState(false);
  const [importing, setImporting] = useState(false);

  const tipoMap = useMemo(() => new Map(tipos.map((t) => [t.id, t])), [tipos]);

  const reset = () => { setStep(1); setRows([]); setApproveAll(false); };

  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) setTimeout(reset, 300);
  };

  const analyze = () => {
    if (!text.trim()) { toast.error("Cola algum texto primeiro"); return; }
    sessionStorage.setItem("bulk_import_text", text);
    const parsed = parseImportText(text, colaboradores, tipos);
    if (parsed.length === 0) { toast.error("Nenhuma linha válida encontrada"); return; }
    setRows(parsed);
    setStep(2);
  };

  const updateRow = (idx: number, patch: Partial<ParsedRow>) => {
    setRows((rs) => rs.map((r, i) => i === idx ? { ...r, ...patch } : r));
  };
  const removeRow = (idx: number) => setRows((rs) => rs.filter((_, i) => i !== idx));

  const summary = useMemo(() => {
    const ready = rows.filter((r) => rowStatus(r) === "ready").length;
    const warn = rows.filter((r) => rowStatus(r) === "warning").length;
    const err = rows.filter((r) => rowStatus(r) === "error").length;
    return { ready, warn, err };
  }, [rows]);

  const calcTotal = (r: ParsedRow): number => {
    const base = r.valorProvided && r.valor != null
      ? r.valor
      : (r.tipo_servico_id ? (tipoMap.get(r.tipo_servico_id)?.preco_unitario ?? 0) : 0) * (r.quantidade || 1);
    return base + (r.outrosCustos || 0);
  };

  const finalSummary = useMemo(() => {
    const valid = rows.filter((r) => rowStatus(r) !== "error");
    const names = new Set<string>();
    let total = 0;
    const dates: string[] = [];
    valid.forEach((r) => {
      const c = colaboradores.find((x) => x.id === r.colaborador_id);
      if (c) names.add(c.nome_completo);
      total += calcTotal(r);
      if (r.data) dates.push(r.data);
    });
    dates.sort();
    return {
      count: valid.length,
      names: Array.from(names),
      total,
      dateMin: dates[0] ?? null,
      dateMax: dates[dates.length - 1] ?? null,
    };
  }, [rows, colaboradores, tipoMap]);

  const doImport = async () => {
    setImporting(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const payload = rows
        .filter((r) => rowStatus(r) !== "error")
        .map((r) => {
          const tipo = r.tipo_servico_id ? tipoMap.get(r.tipo_servico_id) : null;
          let override: number | null = null;
          if (r.valorProvided && r.valor != null && tipo) {
            const calc = tipo.preco_unitario * (r.quantidade || 1);
            if (Math.abs(calc - r.valor) > 0.001) {
              override = r.valor / (r.quantidade || 1);
            }
          }
          return {
            colaborador_id: r.colaborador_id!,
            tipo_servico_id: r.tipo_servico_id!,
            data_inicio: r.data!,
            descricao: r.descricao || null,
            quantidade: r.quantidade || 1,
            preco_unitario_override: override,
            outros_custos: Number(r.outrosCustos) || 0,
            outros_custos_descricao: r.outrosCustosDescricao?.trim() || null,
            estado: approveAll ? "aprovado" : "pendente",
            submetido_pelo_colaborador: false,
            notas_admin: `Importado em massa em ${today}`,
          };
        });
      if (payload.length === 0) { toast.error("Nada para importar"); setImporting(false); return; }
      const { error } = await supabase.from("registos_servico").insert(payload as never);
      if (error) throw error;
      toast.success(`${payload.length} registos importados com sucesso`);
      sessionStorage.removeItem("bulk_import_text");
      if (!approveAll) {
        const uniqueColabs = Array.from(new Set(payload.map((p) => p.colaborador_id)));
        await Promise.all(uniqueColabs.map((cid) =>
          supabase.rpc("notificar_nova_entrada_pendente" as never, { p_colaborador_id: cid } as never)
        ));
      }
      onImported();
      close(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-[95vw] xl:max-w-7xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importação em massa</DialogTitle>
          <DialogDescription>Cola registos de serviço a partir de uma folha de cálculo ou texto.</DialogDescription>
        </DialogHeader>

        <StepIndicator step={step} />

        <div className="flex-1 overflow-y-auto min-h-0 -mx-6 px-6">
          {step === 1 && (
            <div className="space-y-4">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={PLACEHOLDER}
                className="min-h-[300px] font-mono text-sm"
              />
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                  <ChevronDown className="h-4 w-4" />Ver formatos aceites
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 text-xs text-muted-foreground space-y-1 pl-6">
                  <p>• Datas aceites: <b>DD/MM/AAAA</b>, <b>DD-MM-AAAA</b>, <b>AAAA-MM-DD</b></p>
                  <p>• Separador: vírgula (,) ou ponto e vírgula (;) — detetado automaticamente</p>
                  <p>• Colaborador: primeiro nome basta se único; nome completo também funciona</p>
                  <p>• Tipo de serviço: aceita correspondência parcial (ex: "Tradução" → "Tradução de Documento")</p>
                  <p>• Quantidade: opcional, predefinição 1</p>
                  <p>• Valor: opcional — se omitido, calculado por preço × quantidade; se indicado, usado como total</p>
                  <p>• Linhas iniciadas por # são ignoradas (comentários)</p>
                  <p>• Linhas vazias são ignoradas</p>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex gap-3">
                  <span><b className="text-emerald-600">{summary.ready}</b> prontos</span>
                  <span><b className="text-amber-600">{summary.warn}</b> a verificar</span>
                  <span><b className="text-red-600">{summary.err}</b> com erros</span>
                  <span className="text-muted-foreground">· {rows.length} total</span>
                </div>
              </div>
              {(summary.warn > 0 || summary.err > 0) && (
                <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>Alguns registos precisam de atenção. Podes corrigi-los abaixo ou removê-los antes de importar.</span>
                </div>
              )}
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs">
                    <tr>
                      <th className="p-2 text-left w-10">#</th>
                      <th className="p-2 text-left">Colaboradora</th>
                      <th className="p-2 text-left">Data</th>
                      <th className="p-2 text-left">Descrição</th>
                      <th className="p-2 text-left">Tipo de Serviço</th>
                      <th className="p-2 text-left w-20">Qtd</th>
                      <th className="p-2 text-left w-28">Valor</th>
                      <th className="p-2 text-left w-24">Outros</th>
                      <th className="p-2 text-left w-28">Total</th>
                      <th className="p-2 text-left w-24">Estado</th>
                      <th className="p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => (
                      <ImportRow
                        key={idx}
                        idx={idx}
                        row={r}
                        colaboradores={colaboradores}
                        tipos={tipos}
                        tipoMap={tipoMap}
                        onChange={(p) => updateRow(idx, p)}
                        onRemove={() => removeRow(idx)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-md border p-4 space-y-2 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Vais importar {finalSummary.count} registos de serviço:
                </div>
                <ul className="pl-6 list-disc text-muted-foreground space-y-1">
                  <li>{finalSummary.names.length} colaboradoras envolvidas: <span className="text-foreground">{finalSummary.names.join(", ") || "—"}</span></li>
                  <li>Total de valor: <span className="text-foreground font-medium">{finalSummary.total.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</span></li>
                  <li>Período: <span className="text-foreground">
                    {finalSummary.dateMin ? new Date(finalSummary.dateMin).toLocaleDateString("pt-PT") : "—"}
                    {" a "}
                    {finalSummary.dateMax ? new Date(finalSummary.dateMax).toLocaleDateString("pt-PT") : "—"}
                  </span></li>
                </ul>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={approveAll} onCheckedChange={(v) => setApproveAll(!!v)} />
                Marcar todos como <b>Aprovado</b> (em vez de Pendente)
              </label>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-xs text-muted-foreground">
            {step === 2 && `${rows.length} registos`}
          </div>
          <div className="flex gap-2">
            {step === 1 && (
              <>
                <Button variant="outline" onClick={() => close(false)}>Cancelar</Button>
                <Button onClick={analyze}>Analisar texto →</Button>
              </>
            )}
            {step === 2 && (
              <>
                <Button variant="outline" onClick={() => setStep(1)}>← Voltar</Button>
                <Button onClick={() => setStep(3)} disabled={summary.err > 0 || finalSummary.count === 0}>
                  Confirmar importação →
                </Button>
              </>
            )}
            {step === 3 && (
              <>
                <Button variant="outline" onClick={() => setStep(2)} disabled={importing}>← Rever</Button>
                <Button onClick={doImport} disabled={importing}>
                  {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Importar agora
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: "Colar texto" },
    { n: 2, label: "Rever e corrigir" },
    { n: 3, label: "Confirmar importação" },
  ];
  return (
    <div className="flex items-center justify-center gap-2 py-2">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center gap-2">
          <div className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border",
            step === s.n ? "bg-primary text-primary-foreground border-primary" :
            step > s.n ? "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300" :
            "bg-muted text-muted-foreground"
          )}>{s.n}</div>
          <span className={cn("text-xs", step === s.n ? "font-medium" : "text-muted-foreground")}>{s.label}</span>
          {i < steps.length - 1 && <div className="w-8 h-px bg-border mx-1" />}
        </div>
      ))}
    </div>
  );
}

function ImportRow({
  idx, row, colaboradores, tipos, tipoMap, onChange, onRemove,
}: {
  idx: number;
  row: ParsedRow;
  colaboradores: Colab[];
  tipos: Tipo[];
  tipoMap: Map<string, Tipo>;
  onChange: (p: Partial<ParsedRow>) => void;
  onRemove: () => void;
}) {
  const status = rowStatus(row);
  const tipo = row.tipo_servico_id ? tipoMap.get(row.tipo_servico_id) : null;
  const calc = tipo ? tipo.preco_unitario * (row.quantidade || 1) : 0;

  return (
    <tr className={cn("border-t align-top", status === "error" && "bg-red-50/50 dark:bg-red-950/10")}>
      <td className="p-2 text-muted-foreground text-xs">{idx + 1}</td>
      <td className="p-2">
        <Select
          value={row.colaborador_id ?? ""}
          onValueChange={(v) => onChange({ colaborador_id: v, colaboradorConfidence: "exact" })}
        >
          <SelectTrigger className={cn(
            "h-8 text-sm",
            !row.colaborador_id && "border-red-400 text-red-600",
            row.colaboradorConfidence === "fuzzy" && "border-amber-400"
          )}>
            <SelectValue placeholder={row.colaboradorInput || "Escolher..."} />
          </SelectTrigger>
          <SelectContent>
            {colaboradores.filter((c) => c.ativo).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nome_completo}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {row.colaboradorConfidence === "fuzzy" && (
          <TooltipProvider><Tooltip>
            <TooltipTrigger asChild>
              <p className="text-[10px] text-amber-600 mt-0.5 cursor-help">~ "{row.colaboradorInput}"</p>
            </TooltipTrigger>
            <TooltipContent>Correspondência aproximada para: {row.colaboradorInput}</TooltipContent>
          </Tooltip></TooltipProvider>
        )}
      </td>
      <td className="p-2">
        <Input
          type="date"
          value={row.data ?? ""}
          onChange={(e) => onChange({ data: e.target.value || null, dataInput: e.target.value })}
          className={cn("h-8 text-sm", !row.data && "border-red-400")}
        />
        {!row.data && row.dataInput && (
          <p className="text-[10px] text-red-600 mt-0.5">{row.dataInput}</p>
        )}
      </td>
      <td className="p-2">
        <Input
          value={row.descricao}
          onChange={(e) => onChange({ descricao: e.target.value })}
          className="h-8 text-sm"
        />
      </td>
      <td className="p-2">
        <Select
          value={row.tipo_servico_id ?? ""}
          onValueChange={(v) => onChange({ tipo_servico_id: v, tipoConfidence: "exact" })}
        >
          <SelectTrigger className={cn(
            "h-8 text-sm",
            !row.tipo_servico_id && "border-red-400 text-red-600",
            row.tipoConfidence === "fuzzy" && "border-amber-400"
          )}>
            <SelectValue placeholder={row.tipoInput || "Escolher..."} />
          </SelectTrigger>
          <SelectContent>
            {tipos.filter((t) => t.ativo).map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.nome} · €{t.preco_unitario}/{t.unidade}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {row.tipoConfidence === "fuzzy" && (
          <TooltipProvider><Tooltip>
            <TooltipTrigger asChild>
              <p className="text-[10px] text-amber-600 mt-0.5 cursor-help">~ "{row.tipoInput}"</p>
            </TooltipTrigger>
            <TooltipContent>Correspondência aproximada para: {row.tipoInput}</TooltipContent>
          </Tooltip></TooltipProvider>
        )}
      </td>
      <td className="p-2">
        <Input
          type="number"
          step="0.01"
          value={row.quantidade}
          onChange={(e) => onChange({ quantidade: Number(e.target.value) || 0 })}
          className="h-8 text-sm tabular-nums"
        />
      </td>
      <td className="p-2">
        <Input
          type="number"
          step="0.01"
          value={row.valorProvided && row.valor != null ? row.valor : ""}
          placeholder={tipo ? calc.toFixed(2) : ""}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) onChange({ valor: null, valorProvided: false });
            else onChange({ valor: Number(v), valorProvided: true });
          }}
          className="h-8 text-sm tabular-nums"
        />
        {!row.valorProvided && tipo && (
          <p className="text-[10px] text-muted-foreground mt-0.5">calculado: €{calc.toFixed(2)}</p>
        )}
      </td>
      <td className="p-2">
        <Input
          type="number"
          step="0.01"
          value={row.outrosCustos || ""}
          placeholder="0"
          onChange={(e) => onChange({ outrosCustos: Number(e.target.value) || 0 })}
          className="h-8 text-sm tabular-nums text-muted-foreground"
        />
        {row.outrosCustos > 0 && row.outrosCustosDescricao && (
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate" title={row.outrosCustosDescricao}>{row.outrosCustosDescricao}</p>
        )}
      </td>
      <td className="p-2 text-right tabular-nums font-semibold">
        €{(((row.valorProvided && row.valor != null ? row.valor : calc)) + (row.outrosCustos || 0)).toFixed(2)}
      </td>
      <td className="p-2">
        {status === "ready" && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-300">Pronto</Badge>}
        {status === "warning" && <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-300">Verificar</Badge>}
        {status === "error" && <Badge variant="destructive">Erro</Badge>}
      </td>
      <td className="p-2">
        <Button size="icon" variant="ghost" onClick={onRemove} className="h-8 w-8">
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}