import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

type Acao = {
  id: string;
  nome: string;
  data_inicio: string | null;
  data_fim: string | null;
  projeto_ids?: string[] | null;
  local?: string | null;
  status?: string | null;
  tipo?: string | null;
  descricao?: string | null;
  inscricoes_abertas?: boolean | null;
  bolsa_transporte?: boolean | null;
  restrito_a_projetos?: boolean | null;
};
type Projeto = { id: string; nome: string };

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_LONG = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// Stable color from project id
function projColor(id: string | undefined): string {
  if (!id) return "hsl(220 10% 60%)";
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 65% 55%)`;
}

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function daysBetween(a: Date, b: Date) { return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000); }

export function AcoesPlaneamento({ acoes, projetos }: { acoes: Acao[]; projetos: Projeto[] }) {
  const [mode, setMode] = useState<"gantt" | "calendario">("gantt");
  const [year, setYear] = useState(new Date().getFullYear());
  const projMap = useMemo(() => new Map(projetos.map((p) => [p.id, p])), [projetos]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setYear((y) => y - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="min-w-20 text-center text-lg font-semibold">{year}</div>
          <Button variant="outline" size="icon" onClick={() => setYear((y) => y + 1)}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setYear(new Date().getFullYear())}>Hoje</Button>
        </div>
        <div className="inline-flex rounded-md border p-0.5">
          <Button size="sm" variant={mode === "gantt" ? "default" : "ghost"} onClick={() => setMode("gantt")}>Gantt</Button>
          <Button size="sm" variant={mode === "calendario" ? "default" : "ghost"} onClick={() => setMode("calendario")}>Calendário</Button>
        </div>
      </div>
      {mode === "gantt" ? (
        <GanttView acoes={acoes} year={year} projMap={projMap} projetos={projetos} />
      ) : (
        <CalendarioView acoes={acoes} year={year} projMap={projMap} />
      )}
    </div>
  );
}

function useUpdateDates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data_inicio, data_fim }: { id: string; data_inicio: string; data_fim: string }) => {
      const { error } = await supabase.from("acoes").update({ data_inicio, data_fim } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["acoes"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

function GanttView({ acoes, year, projMap, projetos }: { acoes: Acao[]; year: number; projMap: Map<string, Projeto>; projetos: Projeto[] }) {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);
  const totalDays = daysBetween(yearStart, yearEnd);
  const update = useUpdateDates();

  const items = useMemo(() => {
    return acoes
      .filter((a) => a.data_inicio)
      .map((a) => {
        const ini = new Date(a.data_inicio!);
        const fim = a.data_fim ? new Date(a.data_fim) : addDays(ini, 1);
        return { acao: a, ini, fim };
      })
      .filter(({ ini, fim }) => fim >= yearStart && ini < yearEnd)
      .sort((a, b) => a.ini.getTime() - b.ini.getTime());
  }, [acoes, year]);

  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<null | { id: string; mode: "move" | "resize-l" | "resize-r"; startX: number; iniDay: number; fimDay: number }>(null);
  const [preview, setPreview] = useState<Record<string, { iniDay: number; fimDay: number }>>({});

  const onPointerDown = (e: React.PointerEvent, item: typeof items[number], mode: "move" | "resize-l" | "resize-r") => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const iniDay = Math.max(0, daysBetween(yearStart, item.ini));
    const fimDay = Math.min(totalDays, daysBetween(yearStart, item.fim));
    setDrag({ id: item.acao.id, mode, startX: e.clientX, iniDay, fimDay });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag || !trackRef.current) return;
    const width = trackRef.current.clientWidth;
    const pxPerDay = width / totalDays;
    const deltaDays = Math.round((e.clientX - drag.startX) / pxPerDay);
    let iniDay = drag.iniDay;
    let fimDay = drag.fimDay;
    if (drag.mode === "move") { iniDay += deltaDays; fimDay += deltaDays; }
    else if (drag.mode === "resize-l") iniDay = Math.min(fimDay - 1, iniDay + deltaDays);
    else fimDay = Math.max(iniDay + 1, fimDay + deltaDays);
    setPreview((p) => ({ ...p, [drag.id]: { iniDay, fimDay } }));
  };

  const onPointerUp = () => {
    if (!drag) return;
    const p = preview[drag.id];
    if (p) {
      const item = items.find((i) => i.acao.id === drag.id)!;
      const newIni = addDays(yearStart, p.iniDay);
      const newFim = addDays(yearStart, p.fimDay);
      // preserve time-of-day
      newIni.setHours(item.ini.getHours(), item.ini.getMinutes(), 0, 0);
      newFim.setHours(item.fim.getHours(), item.fim.getMinutes(), 0, 0);
      update.mutate({ id: drag.id, data_inicio: newIni.toISOString(), data_fim: newFim.toISOString() });
    }
    setDrag(null);
    setPreview({});
  };

  const today = new Date();
  const todayDay = today.getFullYear() === year ? daysBetween(yearStart, today) : -1;

  return (
    <div className="overflow-x-auto rounded-md border">
      <div className="min-w-[900px]">
        {/* Header */}
        <div className="flex border-b bg-muted/30 text-xs font-medium">
          <div className="w-56 shrink-0 border-r px-3 py-2">Ação</div>
          <div className="flex flex-1">
            {MESES.map((m, i) => {
              const days = daysBetween(new Date(year, i, 1), new Date(year, i + 1, 1));
              return (
                <div key={m} className="border-r px-2 py-2 text-center last:border-r-0" style={{ flex: days }}>{m}</div>
              );
            })}
          </div>
        </div>
        {items.length === 0 && (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">Sem ações com data neste ano.</div>
        )}
        {/* Rows */}
        <div onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          {items.map((item) => {
            const proj = (item.acao.projeto_ids ?? [])[0];
            const color = projColor(proj);
            const projName = proj ? projMap.get(proj)?.nome : null;
            const pv = preview[item.acao.id];
            const iniDay = pv?.iniDay ?? Math.max(0, daysBetween(yearStart, item.ini));
            const fimDay = pv?.fimDay ?? Math.min(totalDays, daysBetween(yearStart, item.fim));
            const leftPct = (iniDay / totalDays) * 100;
            const widthPct = Math.max(0.4, ((fimDay - iniDay) / totalDays) * 100);
            return (
              <div key={item.acao.id} className="flex border-b last:border-b-0 hover:bg-muted/20">
                <div className="w-56 shrink-0 border-r px-3 py-2 text-xs">
                  <div className="truncate font-medium">{item.acao.nome}</div>
                  {projName && <div className="truncate text-[11px] text-muted-foreground">{projName}</div>}
                </div>
                <div ref={items[0].acao.id === item.acao.id ? trackRef : undefined} className="relative flex-1" style={{ height: 44 }}>
                  {/* month dividers */}
                  {MESES.map((_, i) => {
                    if (i === 0) return null;
                    const dayOffset = daysBetween(yearStart, new Date(year, i, 1));
                    return <div key={i} className="absolute top-0 bottom-0 w-px bg-border/60" style={{ left: `${(dayOffset / totalDays) * 100}%` }} />;
                  })}
                  {todayDay >= 0 && (
                    <div className="absolute top-0 bottom-0 w-px bg-primary/70" style={{ left: `${(todayDay / totalDays) * 100}%` }} />
                  )}
                  <div
                    role="button"
                    onPointerDown={(e) => onPointerDown(e, item, "move")}
                    className="absolute top-1.5 flex h-8 cursor-grab items-center rounded-md text-[11px] text-white shadow-sm active:cursor-grabbing select-none"
                    style={{ left: `${leftPct}%`, width: `${widthPct}%`, background: color }}
                    title={`${item.acao.nome}${projName ? " — " + projName : ""}`}
                  >
                    <div onPointerDown={(e) => onPointerDown(e, item, "resize-l")} className="h-full w-1.5 cursor-ew-resize rounded-l-md bg-black/20" />
                    <span className="flex-1 truncate px-2">{item.acao.nome}</span>
                    <div onPointerDown={(e) => onPointerDown(e, item, "resize-r")} className="h-full w-1.5 cursor-ew-resize rounded-r-md bg-black/20" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Legend */}
      {projetos.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-t bg-muted/20 px-3 py-2 text-xs">
          {projetos.map((p) => (
            <div key={p.id} className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded" style={{ background: projColor(p.id) }} />
              <span>{p.nome}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded" style={{ background: projColor(undefined) }} />
            <span>Sem projeto</span>
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarioView({ acoes, year, projMap }: { acoes: Acao[]; year: number; projMap: Map<string, Projeto> }) {
  const months = Array.from({ length: 12 }, (_, m) => m);

  const byDay = useMemo(() => {
    const map = new Map<string, Acao[]>();
    for (const a of acoes) {
      if (!a.data_inicio) continue;
      const ini = startOfDay(new Date(a.data_inicio));
      const fim = startOfDay(new Date(a.data_fim ?? a.data_inicio));
      for (let d = new Date(ini); d <= fim; d = addDays(d, 1)) {
        if (d.getFullYear() !== year) continue;
        const key = `${d.getMonth()}-${d.getDate()}`;
        const arr = map.get(key) ?? [];
        arr.push(a);
        map.set(key, arr);
      }
    }
    return map;
  }, [acoes, year]);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {months.map((m) => {
        const first = new Date(year, m, 1);
        const startWeekday = (first.getDay() + 6) % 7; // Monday=0
        const daysInMonth = new Date(year, m + 1, 0).getDate();
        const cells: (number | null)[] = [];
        for (let i = 0; i < startWeekday; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);
        while (cells.length % 7 !== 0) cells.push(null);
        return (
          <div key={m} className="rounded-md border">
            <div className="border-b bg-muted/30 px-3 py-2 text-sm font-semibold">{MESES_LONG[m]} {year}</div>
            <div className="grid grid-cols-7 gap-px bg-border text-[11px]">
              {["S", "T", "Q", "Q", "S", "S", "D"].map((d, i) => (
                <div key={i} className="bg-muted/20 px-1 py-1 text-center font-medium text-muted-foreground">{d}</div>
              ))}
              {cells.map((d, i) => {
                const items = d ? byDay.get(`${m}-${d}`) ?? [] : [];
                return (
                  <div key={i} className="min-h-16 bg-background p-1">
                    {d && <div className="text-[10px] text-muted-foreground">{d}</div>}
                    <div className="space-y-0.5">
                      {items.slice(0, 3).map((a) => {
                        const proj = (a.projeto_ids ?? [])[0];
                        return (
                          <div
                            key={a.id}
                            className="truncate rounded px-1 py-0.5 text-[10px] text-white"
                            style={{ background: projColor(proj) }}
                            title={`${a.nome}${proj ? " — " + (projMap.get(proj)?.nome ?? "") : ""}`}
                          >
                            {a.nome}
                          </div>
                        );
                      })}
                      {items.length > 3 && <div className="text-[10px] text-muted-foreground">+{items.length - 3}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}