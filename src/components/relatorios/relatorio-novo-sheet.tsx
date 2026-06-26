import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { InlineMultiSelect } from "@/components/inline-edit";
import { cn } from "@/lib/utils";
import { ESTADOS_RELATORIO, FINANCIADORES_SUGESTOES, TIPOS_RELATORIO } from "@/lib/relatorios/types";
import type { RelatorioEstado, RelatorioTipo } from "@/lib/relatorios/types";
import { REPORT_TEMPLATES, type ReportTemplate } from "@/lib/relatorios/templates";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projetoIdDefault?: string | null;
  projetoIdsDefault?: string[];
  financiadorDefault?: string;
  tituloDefault?: string;
};

export function RelatorioNovoSheet({
  open,
  onOpenChange,
  projetoIdDefault = null,
  projetoIdsDefault,
  financiadorDefault,
  tituloDefault,
}: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [titulo, setTitulo] = useState("");
  const [financiador, setFinanciador] = useState("");
  const [projetoIds, setProjetoIds] = useState<string[]>(
    projetoIdsDefault?.length ? projetoIdsDefault : projetoIdDefault ? [projetoIdDefault] : [],
  );
  const [geral, setGeral] = useState<boolean>(false);
  const [tipo, setTipo] = useState<RelatorioTipo>("Intercalar");
  const [estado, setEstado] = useState<RelatorioEstado>("Rascunho");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [dataPrevista, setDataPrevista] = useState("");
  const [template, setTemplate] = useState<ReportTemplate | null>(null);

  useEffect(() => {
    if (open) {
      setTitulo(tituloDefault ?? "");
      setFinanciador(financiadorDefault ?? "");
      setProjetoIds(
        projetoIdsDefault?.length ? projetoIdsDefault : projetoIdDefault ? [projetoIdDefault] : [],
      );
      setGeral(false);
      setTipo("Intercalar");
      setEstado("Rascunho");
      const today = new Date();
      const yyyy = today.getFullYear();
      setPeriodoInicio(`${yyyy}-01-01`);
      setPeriodoFim(`${yyyy}-06-30`);
      setDataPrevista("");
      setTemplate(null);
    }
  }, [open, projetoIdDefault, projetoIdsDefault, financiadorDefault, tituloDefault]);

  const { data: projetos } = useQuery({
    queryKey: ["projetos-lista-min"],
    queryFn: async () => {
      const { data } = await supabase.from("projetos").select("id, nome").order("nome");
      return (data ?? []) as { id: string; nome: string }[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: ins, error } = await supabase
        .from("relatorios" as any)
        .insert({
          titulo,
          financiador,
          projeto_id: !geral && projetoIds.length === 1 ? projetoIds[0] : null,
          projeto_ids: geral ? [] : projetoIds,
          geral,
          tipo,
          estado,
          periodo_inicio: periodoInicio,
          periodo_fim: periodoFim,
          data_submissao_prevista: dataPrevista || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      const id = (ins as any).id as string;

      const secoes = (template?.secoes ?? [{ tipo: "texto" as const, titulo: "Introdução" }])
        .map((s, idx) => ({
          relatorio_id: id,
          tipo: s.tipo,
          titulo: s.titulo ?? null,
          conteudo_texto: s.conteudo_texto ?? null,
          config: s.config ?? {},
          position: idx,
        }));
      const { error: e2 } = await supabase.from("relatorio_secoes" as any).insert(secoes);
      if (e2) throw e2;
      return id;
    },
    onSuccess: (id) => {
      toast.success("Relatório criado ✓");
      qc.invalidateQueries({ queryKey: ["relatorios"] });
      qc.invalidateQueries({ queryKey: ["sidebar-badge"] });
      onOpenChange(false);
      navigate({ to: "/relatorios/$id", params: { id } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar"),
  });

  const canSave = titulo.trim() && financiador.trim() && periodoInicio && periodoFim;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo relatório</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto pr-1">
          <div className="col-span-2 space-y-1">
            <Label>Título</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Relatório intercalar — Gulbenkian IGI — 1º semestre 2026"
            />
          </div>

          <div className="space-y-1">
            <Label>Financiador</Label>
            <Input
              list="rel-fin-sug"
              value={financiador}
              onChange={(e) => setFinanciador(e.target.value)}
              placeholder="Gulbenkian IGI"
            />
            <datalist id="rel-fin-sug">
              {FINANCIADORES_SUGESTOES.map((f) => <option key={f} value={f} />)}
            </datalist>
          </div>

          <div className="space-y-1">
            <Label>Projetos associados</Label>
            <InlineMultiSelect
              values={projetoIds}
              options={(projetos ?? []).map((p) => ({ value: p.id, label: p.nome }))}
              onSave={(v) => setProjetoIds(v)}
              placeholder={geral ? "Todos os projetos" : "Nenhum"}
            />
            <label className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
              <Checkbox checked={geral} onCheckedChange={(v) => { setGeral(!!v); if (v) setProjetoIds([]); }} />
              Relatório geral — todas as atividades da organização no período
            </label>
          </div>

          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as RelatorioTipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_RELATORIO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Estado</Label>
            <Select value={estado} onValueChange={(v) => setEstado(v as RelatorioEstado)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ESTADOS_RELATORIO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Período — início</Label>
            <Input type="date" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Período — fim</Label>
            <Input type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} />
          </div>

          <div className="col-span-2 space-y-1">
            <Label>Data prevista de submissão (opcional)</Label>
            <Input type="date" value={dataPrevista} onChange={(e) => setDataPrevista(e.target.value)} />
          </div>

          <div className="col-span-2 space-y-2 pt-2">
            <Label>Usar template (opcional)</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {REPORT_TEMPLATES.map((t) => {
                const active = template?.id === t.id;
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => {
                      setTemplate(active ? null : t);
                      if (!active && t.financiador && !financiador) setFinanciador(t.financiador);
                    }}
                    className={cn(
                      "text-left rounded-lg border p-3 hover:border-foreground/40 transition",
                      active && "border-primary ring-2 ring-primary/20 bg-primary/5",
                    )}
                  >
                    <div className="text-sm font-medium">{t.nome}</div>
                    {t.financiador && <Badge variant="secondary" className="mt-1 text-[10px]">{t.financiador}</Badge>}
                    <p className="mt-1 text-xs text-muted-foreground">{t.descricao}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {t.secoes.length} secção(ões): {t.secoes.map((s) => s.tipo).join(" · ")}
                    </p>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Sem template, é criada uma secção inicial em branco.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!canSave || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "A criar…" : "Criar relatório"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}