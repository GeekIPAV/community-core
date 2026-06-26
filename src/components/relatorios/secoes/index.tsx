import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Settings2 } from "lucide-react";
import type { Secao } from "@/lib/relatorios/types";

export type SecaoEditorProps = {
  secao: Secao;
  relPeriodoInicio: string;
  relPeriodoFim: string;
  relProjetoId: string | null;
  onPatch: (patch: Partial<Pick<Secao, "titulo" | "conteudo_texto" | "config">>) => void;
  onDataReady?: (snapshot: any) => void;
};

/* ============================================================
 * Texto
 * ============================================================ */
export function TextoSecao({ secao, onPatch }: SecaoEditorProps) {
  const [titulo, setTitulo] = useState(secao.titulo ?? "");
  useEffect(() => { setTitulo(secao.titulo ?? ""); }, [secao.id]);
  return (
    <div className="space-y-2">
      <Input
        value={titulo}
        placeholder="Sem título"
        onChange={(e) => setTitulo(e.target.value)}
        onBlur={() => titulo !== (secao.titulo ?? "") && onPatch({ titulo: titulo || null })}
        className="text-lg font-semibold border-0 px-0 shadow-none focus-visible:ring-0"
      />
      <RichTextEditor
        value={secao.conteudo_texto ?? ""}
        onChange={(html) => onPatch({ conteudo_texto: html })}
        placeholder="Clica para começar a escrever…"
      />
    </div>
  );
}

/* ============================================================
 * Separador
 * ============================================================ */
export function SeparadorSecao({ secao, onPatch }: SecaoEditorProps) {
  const [titulo, setTitulo] = useState(secao.titulo ?? "");
  useEffect(() => { setTitulo(secao.titulo ?? ""); }, [secao.id]);
  return (
    <div className="my-6 flex items-center gap-3" data-tipo="separador">
      <div className="h-px flex-1 bg-border" />
      <Input
        value={titulo}
        placeholder="rótulo opcional"
        onChange={(e) => setTitulo(e.target.value)}
        onBlur={() => titulo !== (secao.titulo ?? "") && onPatch({ titulo: titulo || null })}
        className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground text-center w-auto min-w-32 border-0 shadow-none focus-visible:ring-0 bg-transparent"
      />
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

/* ============================================================
 * Citação
 * ============================================================ */
export function CitacaoSecao({ secao, onPatch }: SecaoEditorProps) {
  const [texto, setTexto] = useState(secao.config?.texto ?? "");
  const [autor, setAutor] = useState(secao.config?.autor ?? "");
  useEffect(() => {
    setTexto(secao.config?.texto ?? "");
    setAutor(secao.config?.autor ?? "");
  }, [secao.id]);
  const commit = () => onPatch({ config: { ...secao.config, texto, autor } });
  return (
    <div className="space-y-3 rounded-lg border border-dashed p-6 bg-muted/30">
      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={commit}
        placeholder='"Aqui vai o testemunho…"'
        className="border-0 shadow-none focus-visible:ring-0 text-xl italic text-center leading-relaxed bg-transparent resize-none"
        rows={3}
      />
      <Input
        value={autor}
        onChange={(e) => setAutor(e.target.value)}
        onBlur={commit}
        placeholder="— Autor / fonte"
        className="border-0 shadow-none focus-visible:ring-0 text-center text-muted-foreground bg-transparent"
      />
    </div>
  );
}

/* ============================================================
 * Indicadores
 * ============================================================ */
export function IndicadoresSecao({ secao, relProjetoId, onPatch, onDataReady }: SecaoEditorProps) {
  const [titulo, setTitulo] = useState(secao.titulo ?? "");
  useEffect(() => { setTitulo(secao.titulo ?? ""); }, [secao.id]);

  const { data: kpis, isLoading } = useQuery({
    queryKey: ["secao-indicadores-kpis", relProjetoId],
    queryFn: async () => {
      let q = supabase.from("projeto_kpis").select("id, nome, unidade, meta, narrativa, valor_manual, projeto_id");
      if (relProjetoId) q = q.eq("projeto_id", relProjetoId);
      const { data } = await q.order("position");
      return (data ?? []) as any[];
    },
  });

  const selectedIds = secao.config?.kpi_ids ?? [];
  const mostrarMeta = secao.config?.mostrar_meta ?? true;
  const mostrarProgresso = secao.config?.mostrar_progresso ?? true;
  const selecionados = (kpis ?? []).filter((k) => selectedIds.length === 0 || selectedIds.includes(k.id));

  useEffect(() => {
    if (onDataReady) {
      onDataReady({
        kpis: selecionados.map((k) => ({
          id: k.id, nome: k.nome, unidade: k.unidade ?? "",
          meta: Number(k.meta ?? 0), valor: Number(k.valor_manual ?? 0),
          narrativa: k.narrativa,
        })),
      });
    }
  }, [JSON.stringify(selectedIds), kpis?.length]);

  const toggleKpi = (id: string) => {
    const cur = new Set(selectedIds);
    if (cur.has(id)) cur.delete(id); else cur.add(id);
    onPatch({ config: { ...secao.config, kpi_ids: Array.from(cur) } });
  };

  return (
    <div className="space-y-3">
      <Input
        value={titulo}
        placeholder="Indicadores"
        onChange={(e) => setTitulo(e.target.value)}
        onBlur={() => titulo !== (secao.titulo ?? "") && onPatch({ titulo: titulo || null })}
        className="text-lg font-semibold border-0 px-0 shadow-none focus-visible:ring-0"
      />

      <ConfigPanel>
        <div className="space-y-2">
          <Label className="text-xs">KPIs incluídos {selectedIds.length === 0 && <span className="text-muted-foreground">(todos)</span>}</Label>
          <div className="flex flex-wrap gap-1">
            {(kpis ?? []).map((k) => (
              <button key={k.id} type="button" onClick={() => toggleKpi(k.id)}>
                <Badge variant={selectedIds.includes(k.id) ? "default" : "outline"} className="font-normal">
                  {k.nome}
                </Badge>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={mostrarMeta} onCheckedChange={(v) => onPatch({ config: { ...secao.config, mostrar_meta: v } })} /> Mostrar meta
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={mostrarProgresso} onCheckedChange={(v) => onPatch({ config: { ...secao.config, mostrar_progresso: v } })} /> Mostrar progresso
            </label>
          </div>
        </div>
      </ConfigPanel>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : selecionados.length === 0 ? (
        <EmptyHint>Sem KPIs disponíveis. Configura o projeto associado.</EmptyHint>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {selecionados.map((k) => {
            const valor = Number(k.valor_manual ?? 0);
            const meta = Number(k.meta ?? 0);
            const pct = meta > 0 ? Math.round((valor / meta) * 100) : 0;
            const cor = pct >= 100 ? "hsl(142 71% 45%)" : pct >= 50 ? "hsl(var(--primary))" : "hsl(38 92% 50%)";
            return (
              <div key={k.id} className="rounded-md border p-3 space-y-1">
                <div className="text-xs text-muted-foreground">{k.nome}</div>
                <div className="text-2xl font-semibold tabular-nums">
                  {valor} <span className="text-sm font-normal text-muted-foreground">{k.unidade}</span>
                </div>
                {mostrarMeta && meta > 0 && (
                  <div className="text-xs text-muted-foreground">Meta: {meta} {k.unidade}</div>
                )}
                {mostrarProgresso && meta > 0 && (
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mt-1">
                    <div className="h-full" style={{ width: `${Math.min(100, pct)}%`, background: cor }} />
                  </div>
                )}
                {k.narrativa && <p className="text-xs text-muted-foreground italic mt-1">{k.narrativa}</p>}
              </div>
            );
          })}
        </div>
      )}

      <NarrativaArea secao={secao} onPatch={onPatch} />
    </div>
  );
}

/* ============================================================
 * Atividades
 * ============================================================ */
export function AtividadesSecao({ secao, relPeriodoInicio, relPeriodoFim, relProjetoId, onPatch, onDataReady }: SecaoEditorProps) {
  const [titulo, setTitulo] = useState(secao.titulo ?? "");
  useEffect(() => { setTitulo(secao.titulo ?? ""); }, [secao.id]);

  const inicio = secao.config?.periodo_inicio || relPeriodoInicio;
  const fim = secao.config?.periodo_fim || relPeriodoFim;
  const projetoId = secao.config?.projeto_id ?? relProjetoId;

  const { data: projetos } = useQuery({
    queryKey: ["projetos-lista-min"],
    queryFn: async () => {
      const { data } = await supabase.from("projetos").select("id, nome").order("nome");
      return (data ?? []) as { id: string; nome: string }[];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["secao-atividades", inicio, fim, projetoId],
    enabled: !!inicio && !!fim,
    queryFn: async () => {
      let q = supabase.from("acoes").select("id, nome, data_inicio, local, projeto_ids").gte("data_inicio", inicio).lte("data_inicio", fim).order("data_inicio");
      if (projetoId) q = q.overlaps("projeto_ids", [projetoId]);
      const { data: acoes } = await q;
      const ids = (acoes ?? []).map((a: any) => a.id);
      let insc: any[] = [];
      if (ids.length > 0) {
        const { data: i } = await supabase.from("inscricoes").select("pessoa_id, acao_id, status").in("acao_id", ids).neq("status", "cancelada");
        insc = i ?? [];
      }
      const byAcao = new Map<string, number>();
      for (const r of insc) byAcao.set(r.acao_id, (byAcao.get(r.acao_id) ?? 0) + 1);
      const lista = ((acoes ?? []) as any[]).map((a) => ({
        id: a.id, nome: a.nome, data: a.data_inicio, local: a.local ?? "", participantes: byAcao.get(a.id) ?? 0,
      }));
      return {
        lista,
        resumo: {
          acoes: lista.length,
          participacoes: insc.length,
          unicos: new Set(insc.map((i) => i.pessoa_id)).size,
        },
      };
    },
  });

  useEffect(() => {
    if (onDataReady && data) onDataReady({ atividades: data });
  }, [data]);

  return (
    <div className="space-y-3">
      <Input
        value={titulo}
        placeholder="Atividades"
        onChange={(e) => setTitulo(e.target.value)}
        onBlur={() => titulo !== (secao.titulo ?? "") && onPatch({ titulo: titulo || null })}
        className="text-lg font-semibold border-0 px-0 shadow-none focus-visible:ring-0"
      />

      <ConfigPanel>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Projeto</Label>
            <Select
              value={projetoId ?? "__none"}
              onValueChange={(v) => onPatch({ config: { ...secao.config, projeto_id: v === "__none" ? null : v } })}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— Todos —</SelectItem>
                {(projetos ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Início</Label>
            <Input type="date" value={inicio} className="h-8 text-xs" onChange={(e) => onPatch({ config: { ...secao.config, periodo_inicio: e.target.value || null } })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fim</Label>
            <Input type="date" value={fim} className="h-8 text-xs" onChange={(e) => onPatch({ config: { ...secao.config, periodo_fim: e.target.value || null } })} />
          </div>
        </div>
      </ConfigPanel>

      {isLoading ? <Skeleton className="h-32 w-full" /> : (
        <>
          <p className="text-sm">
            <strong>{data?.resumo.acoes ?? 0}</strong> ações realizadas ·{" "}
            <strong>{data?.resumo.participacoes ?? 0}</strong> participações ·{" "}
            <strong>{data?.resumo.unicos ?? 0}</strong> participantes únicos
          </p>
          {(data?.lista.length ?? 0) === 0 ? (
            <EmptyHint>Sem ações no período selecionado.</EmptyHint>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Data</TableHead>
                    <TableHead>Nome da ação</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead className="w-24 text-right">Participantes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data!.lista.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs">{a.data ? new Date(a.data).toLocaleDateString("pt-PT") : "—"}</TableCell>
                      <TableCell className="text-sm">{a.nome}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.local || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.participantes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      <NarrativaArea secao={secao} onPatch={onPatch} />
    </div>
  );
}

/* ============================================================
 * Participantes
 * ============================================================ */
const BREAKDOWN_LABELS: Record<string, string> = {
  nacionalidade: "Nacionalidade",
  genero: "Género",
  familia: "Família",
  projeto: "Projeto",
  faixa_etaria: "Faixa etária",
};

function faixaEtaria(nasc: string | null) {
  if (!nasc) return "(sem dados)";
  const idade = Math.floor((Date.now() - new Date(nasc).getTime()) / (365.25 * 24 * 3600 * 1000));
  if (idade < 18) return "< 18";
  if (idade < 30) return "18–29";
  if (idade < 45) return "30–44";
  if (idade < 65) return "45–64";
  return "65+";
}

export function ParticipantesSecao({ secao, relPeriodoInicio, relPeriodoFim, relProjetoId, onPatch, onDataReady }: SecaoEditorProps) {
  const [titulo, setTitulo] = useState(secao.titulo ?? "");
  useEffect(() => { setTitulo(secao.titulo ?? ""); }, [secao.id]);

  const breakdown = (secao.config?.breakdown_por ?? "nacionalidade") as keyof typeof BREAKDOWN_LABELS;
  const projetoIds = secao.config?.projeto_ids ?? (relProjetoId ? [relProjetoId] : []);

  const { data, isLoading } = useQuery({
    queryKey: ["secao-participantes", breakdown, projetoIds.join(","), relPeriodoInicio, relPeriodoFim],
    queryFn: async () => {
      let q = supabase.from("pessoas").select("id, nacionalidade, genero, data_nascimento, familia_id, projeto_ids, created_at, status").eq("status", "ativo");
      if (projetoIds.length > 0) q = q.overlaps("projeto_ids", projetoIds);
      const { data: ps } = await q;
      const pessoas = (ps ?? []) as any[];

      const counts = new Map<string, number>();
      const familiaIds = new Set<string>();
      let projetoMap = new Map<string, string>();

      if (breakdown === "projeto") {
        const { data: prj } = await supabase.from("projetos").select("id, nome");
        for (const p of (prj ?? []) as any[]) projetoMap.set(p.id, p.nome);
      }

      for (const p of pessoas) {
        if (p.familia_id) familiaIds.add(p.familia_id);
        let key = "(sem dados)";
        if (breakdown === "nacionalidade") key = (p.nacionalidade ?? "").trim() || "(sem dados)";
        else if (breakdown === "genero") key = (p.genero ?? "").trim() || "(sem dados)";
        else if (breakdown === "faixa_etaria") key = faixaEtaria(p.data_nascimento);
        else if (breakdown === "familia") key = p.familia_id ? "Com família" : "Sem família";
        else if (breakdown === "projeto") {
          for (const pid of (p.projeto_ids ?? [])) {
            const k = projetoMap.get(pid) ?? "(projeto)";
            counts.set(k, (counts.get(k) ?? 0) + 1);
          }
          continue;
        }
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }

      const novas = pessoas.filter((p) => p.created_at >= relPeriodoInicio && p.created_at <= `${relPeriodoFim}T23:59:59`).length;
      const total = pessoas.length;
      const list = Array.from(counts.entries())
        .map(([nome, count]) => ({ nome, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
        .sort((a, b) => b.count - a.count);

      return {
        stats: { pessoas: total, familias: familiaIds.size, novas },
        breakdown: list,
        breakdown_label: BREAKDOWN_LABELS[breakdown] ?? "Categoria",
      };
    },
  });

  useEffect(() => { if (onDataReady && data) onDataReady({ participantes: data }); }, [data]);

  const maxCount = data ? Math.max(1, ...data.breakdown.map((b) => b.count)) : 1;

  return (
    <div className="space-y-3">
      <Input
        value={titulo}
        placeholder="Participantes"
        onChange={(e) => setTitulo(e.target.value)}
        onBlur={() => titulo !== (secao.titulo ?? "") && onPatch({ titulo: titulo || null })}
        className="text-lg font-semibold border-0 px-0 shadow-none focus-visible:ring-0"
      />

      <ConfigPanel>
        <div className="space-y-1">
          <Label className="text-xs">Breakdown por</Label>
          <Select
            value={breakdown}
            onValueChange={(v) => onPatch({ config: { ...secao.config, breakdown_por: v as any } })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(BREAKDOWN_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </ConfigPanel>

      {isLoading || !data ? <Skeleton className="h-32 w-full" /> : (
        <>
          <p className="text-sm">
            <strong>{data.stats.pessoas}</strong> pessoas apoiadas ·{" "}
            <strong>{data.stats.familias}</strong> famílias ·{" "}
            <strong>{data.stats.novas}</strong> novas entradas no período
          </p>
          {data.breakdown.length === 0 ? <EmptyHint>Sem dados.</EmptyHint> : (
            <div className="space-y-1">
              {data.breakdown.map((b) => (
                <div key={b.nome} className="grid grid-cols-[1fr_auto_3rem] items-center gap-3 text-sm">
                  <span className="truncate">{b.nome}</span>
                  <div className="w-40 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${Math.max(2, (b.count / maxCount) * 100)}%` }} />
                  </div>
                  <span className="text-right tabular-nums text-xs text-muted-foreground">{b.count} · {b.pct}%</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <NarrativaArea secao={secao} onPatch={onPatch} />
    </div>
  );
}

/* ============================================================
 * Casos
 * ============================================================ */
export function CasosSecao({ secao, relPeriodoInicio, relPeriodoFim, onPatch, onDataReady }: SecaoEditorProps) {
  const [titulo, setTitulo] = useState(secao.titulo ?? "");
  useEffect(() => { setTitulo(secao.titulo ?? ""); }, [secao.id]);

  const { data, isLoading } = useQuery({
    queryKey: ["secao-casos", relPeriodoInicio, relPeriodoFim],
    queryFn: async () => {
      const { data } = await supabase
        .from("casos_apoio" as any)
        .select("id, area, estado, data_abertura, data_encerramento")
        .gte("data_abertura", relPeriodoInicio)
        .lte("data_abertura", relPeriodoFim);
      const arr = (data ?? []) as any[];
      const byArea = new Map<string, { abertos: number; concluidos: number; em_curso: number }>();
      for (const c of arr) {
        const a = (c.area ?? "—").trim() || "—";
        const entry = byArea.get(a) ?? { abertos: 0, concluidos: 0, em_curso: 0 };
        entry.abertos += 1;
        if (c.estado === "Concluído" || c.estado === "Encerrado") entry.concluidos += 1;
        else entry.em_curso += 1;
        byArea.set(a, entry);
      }
      const lista = Array.from(byArea.entries()).map(([area, v]) => ({ area, ...v }));
      const stats = lista.reduce(
        (acc, x) => ({ abertos: acc.abertos + x.abertos, concluidos: acc.concluidos + x.concluidos, em_curso: acc.em_curso + x.em_curso }),
        { abertos: 0, concluidos: 0, em_curso: 0 },
      );
      return { stats, lista };
    },
  });

  useEffect(() => { if (onDataReady && data) onDataReady({ casos: data }); }, [data]);

  return (
    <div className="space-y-3">
      <Input
        value={titulo}
        placeholder="Casos de apoio"
        onChange={(e) => setTitulo(e.target.value)}
        onBlur={() => titulo !== (secao.titulo ?? "") && onPatch({ titulo: titulo || null })}
        className="text-lg font-semibold border-0 px-0 shadow-none focus-visible:ring-0"
      />

      {isLoading || !data ? <Skeleton className="h-24 w-full" /> : (
        <>
          <p className="text-sm">
            <strong>{data.stats.abertos}</strong> casos abertos ·{" "}
            <strong>{data.stats.concluidos}</strong> concluídos ·{" "}
            <strong>{data.stats.em_curso}</strong> em curso no período
          </p>
          {data.lista.length === 0 ? <EmptyHint>Sem casos no período.</EmptyHint> : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Área</TableHead>
                    <TableHead className="text-right">Abertos</TableHead>
                    <TableHead className="text-right">Concluídos</TableHead>
                    <TableHead className="text-right">Em curso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.lista.map((r) => (
                    <TableRow key={r.area}>
                      <TableCell className="text-sm">{r.area}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.abertos}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.concluidos}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.em_curso}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      <NarrativaArea secao={secao} onPatch={onPatch} />
    </div>
  );
}

/* ============================================================
 * Helpers
 * ============================================================ */
function ConfigPanel({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} data-print-hide="true">
      <CollapsibleTrigger asChild>
        <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Settings2 className="h-3 w-3" /> Configurar
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 rounded-md border bg-muted/30 p-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground italic">{children}</p>;
}

function NarrativaArea({ secao, onPatch }: { secao: Secao; onPatch: SecaoEditorProps["onPatch"] }) {
  return (
    <div className="mt-2">
      <RichTextEditor
        value={secao.conteudo_texto ?? ""}
        onChange={(html) => onPatch({ conteudo_texto: html })}
        placeholder="Acrescenta uma narrativa para esta secção…"
      />
    </div>
  );
}

/* ============================================================
 * Router
 * ============================================================ */
export function SecaoRenderer(props: SecaoEditorProps) {
  switch (props.secao.tipo) {
    case "texto": return <TextoSecao {...props} />;
    case "separador": return <SeparadorSecao {...props} />;
    case "citacao": return <CitacaoSecao {...props} />;
    case "indicadores": return <IndicadoresSecao {...props} />;
    case "atividades": return <AtividadesSecao {...props} />;
    case "participantes": return <ParticipantesSecao {...props} />;
    case "casos": return <CasosSecao {...props} />;
    default: return null;
  }
}