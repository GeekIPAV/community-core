import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Car, ChevronDown, AlertTriangle, Download } from "lucide-react";
import { formatEuro } from "@/lib/bolsa-transporte";
import { downloadCSV } from "@/lib/download-csv";
import { EstadoBadge, FamiliaSubgrupoBlock, formatDate, subgruposPorFamilia } from "./helpers";
import type { AcaoGrupo, BolsaPagamento, Faltante, InscricaoComBolsa, MapaKmRow } from "./types";

export type PagamentosKpis = {
  porPagarN: number;
  porPagarV: number;
  pagoN: number;
  pagoV: number;
  nAcoes: number;
  total: number;
};

export type KmKpis = {
  porPagarN: number;
  porPagarV: number;
  pagoN: number;
  pagoV: number;
  totalKm: number;
  totalV: number;
};

export function PagamentosTab({
  loading,
  acoesFiltradas,
  kpis,
  kmKpis,
  kmPorFamilia,
  search,
  setSearch,
  estadoFilter,
  setEstadoFilter,
  criarFaltantesPending,
  onCriarFaltantes,
  onChangeEstado,
  onUpdateCampo,
  onMarcarPago,
  onDeleteBolsa,
  onBulkMarcarPagosFamilia,
}: {
  loading: boolean;
  acoesFiltradas: AcaoGrupo[];
  kpis: PagamentosKpis;
  kmKpis: KmKpis;
  kmPorFamilia: Map<string, MapaKmRow[]>;
  search: string;
  setSearch: (v: string) => void;
  estadoFilter: "todos" | BolsaPagamento["estado"];
  setEstadoFilter: (v: "todos" | BolsaPagamento["estado"]) => void;
  criarFaltantesPending: boolean;
  onCriarFaltantes: (faltantes: Faltante[]) => void;
  onChangeEstado: (i: InscricaoComBolsa, estado: BolsaPagamento["estado"]) => void;
  onUpdateCampo: (i: InscricaoComBolsa, campo: "metodo_pagamento" | "notas", valor: string) => void;
  onMarcarPago: (i: InscricaoComBolsa) => void;
  onDeleteBolsa: (i: InscricaoComBolsa) => void;
  onBulkMarcarPagosFamilia: (members: InscricaoComBolsa[]) => void;
}) {
  return (
    <>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Por pagar</CardDescription></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-amber-700">{kpis.porPagarN}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{formatEuro(kpis.porPagarV)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Pago</CardDescription></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-emerald-700">{kpis.pagoN}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{formatEuro(kpis.pagoV)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Ações com bolsa</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{kpis.nAcoes}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Total geral</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-semibold tabular-nums">{formatEuro(kpis.total)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>KM por pagar</CardDescription></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-amber-700">{kmKpis.porPagarN}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{formatEuro(kmKpis.porPagarV)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>KM pago</CardDescription></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-emerald-700">{kmKpis.pagoN}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{formatEuro(kmKpis.pagoV)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-2">
        <Input placeholder="Pesquisar pessoa, família ou ação…" value={search} onChange={(e) => setSearch(e.target.value)} className="md:max-w-md" />
        <Select value={estadoFilter} onValueChange={(v) => setEstadoFilter(v as typeof estadoFilter)}>
          <SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os estados</SelectItem>
            <SelectItem value="por_pagar">Por pagar</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const headers = ["Ação", "Data", "Pessoa", "Família", "Cidade", "Transporte", "Valor", "Estado", "Método", "Notas", "Data pagamento"];
            const rowsCsv = acoesFiltradas.flatMap((a) =>
              a.inscricoes.map((i) => ({
                "Ação": i.acao_nome,
                "Data": i.acao_data ? new Date(i.acao_data).toLocaleDateString("pt-PT") : "",
                "Pessoa": i.pessoa_nome,
                "Família": i.familia_nome ?? "",
                "Cidade": i.cidade_residencia ?? "",
                "Transporte": i.viatura_propria ? `Própria · ${i.viatura_km ?? 0}km` : (i.cidade_residencia ?? ""),
                "Valor": (i.pagamento?.valor ?? i.valor_calculado).toFixed(2).replace(".", ","),
                "Estado": i.pagamento?.estado === "pago" ? "Pago" : i.pagamento?.estado === "cancelado" ? "Cancelado" : "Por pagar",
                "Método": i.pagamento?.metodo_pagamento ?? "",
                "Notas": i.pagamento?.notas ?? "",
                "Data pagamento": i.pagamento?.data_pagamento ?? "",
              }))
            );
            downloadCSV(`bolsas-pagamentos-${new Date().toISOString().slice(0, 10)}.csv`, rowsCsv, headers);
          }}
        >
          <Download className="mr-1 h-3.5 w-3.5" /> Exportar
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : acoesFiltradas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem ações com bolsa de transporte.</p>
      ) : (
        <div className="space-y-2">
          {acoesFiltradas.map((acao) => (
            <Collapsible key={acao.id}>
              <CollapsibleTrigger className="w-full flex items-center justify-between p-4 rounded-lg border hover:bg-muted/40">
                <div className="flex items-center gap-3 min-w-0">
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform [[data-state=open]_&]:rotate-180" />
                  <div className="text-left min-w-0">
                    <p className="font-medium truncate">{acao.nome}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(acao.data_inicio)}{acao.local ? ` · ${acao.local}` : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {acao.nPorPagar > 0 && <Badge className="bg-amber-100 text-amber-800 border-amber-200">{acao.nPorPagar} por pagar</Badge>}
                  {acao.nPago > 0 && <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">{acao.nPago} pagos</Badge>}
                  {acao.faltantes.length > 0 && (
                    <Badge variant="outline" className="border-amber-300 text-amber-700">{acao.faltantes.length} sem bolsa</Badge>
                  )}
                  <span className="text-sm font-medium tabular-nums">{formatEuro(acao.totalValor)}</span>
                  {(() => {
                    const familiaIds = [...new Set(
                      acao.inscricoes.map((i) => i.familia_id).filter(Boolean) as string[]
                    )];
                    const kmRows = familiaIds.flatMap((fid) => kmPorFamilia.get(fid) ?? []);
                    if (kmRows.length === 0) return null;
                    const kmPP = kmRows.filter((r) => r.estado === "por_pagar").reduce((s, r) => s + Number(r.valor), 0);
                    const kmTotal = kmRows.reduce((s, r) => s + Number(r.valor), 0);
                    return (
                      <span className="flex items-center gap-1 text-xs text-orange-700 tabular-nums">
                        <Car className="h-3 w-3" />
                        {formatEuro(kmPP > 0 ? kmPP : kmTotal)}{kmPP > 0 ? " KM p/pagar" : " KM"}
                      </span>
                    );
                  })()}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {acao.faltantes.length > 0 && (
                  <div className="border border-t-0 border-b-0 bg-amber-50/60 px-4 py-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-amber-800">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span className="font-medium">
                        {acao.faltantes.length} membro(s) elegível(is) sem bolsa nesta ação
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-auto h-7 text-xs"
                        disabled={criarFaltantesPending}
                        onClick={() => onCriarFaltantes(acao.faltantes)}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar todos
                      </Button>
                    </div>
                    {Array.from(
                      acao.faltantes.reduce((m, f) => {
                        const key = f.familia_id ?? `__solo_${f.pessoa_id}`;
                        const list = m.get(key) ?? [];
                        list.push(f);
                        m.set(key, list);
                        return m;
                      }, new Map<string, Faltante[]>()),
                    ).map(([key, lista]) => (
                      <div key={key} className="flex items-center gap-2 text-xs">
                        <span className="font-medium">{lista[0].familia_nome ?? lista[0].pessoa_nome}</span>
                        <span className="text-muted-foreground truncate">
                          {lista.map((f) => f.pessoa_nome).join(", ")}
                        </span>
                        <span className="ml-auto tabular-nums text-muted-foreground">
                          {formatEuro(lista.reduce((s, f) => s + f.valor_calculado, 0))}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          disabled={criarFaltantesPending}
                          onClick={() => onCriarFaltantes(lista)}
                        >
                          <Plus className="mr-1 h-3 w-3" /> Adicionar em falta
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="border border-t-0 rounded-b-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pessoa</TableHead>
                        <TableHead>Família</TableHead>
                        <TableHead>Transporte</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Notas</TableHead>
                        <TableHead></TableHead>
                        <TableHead className="w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subgruposPorFamilia(acao.inscricoes).map((fg) => (
                        <FamiliaSubgrupoBlock
                          key={fg.key}
                          group={fg}
                          colSpan={9}
                          onBulkMarcarPagos={onBulkMarcarPagosFamilia}
                          onChangeEstado={onChangeEstado}
                          onUpdate={onUpdateCampo}
                          onMarcarPago={onMarcarPago}
                          onDelete={onDeleteBolsa}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {/* KM records for families in this action */}
                {(() => {
                  // Collect unique familia_ids from this action's inscricoes
                  const familiaIds = [...new Set(
                    acao.inscricoes
                      .map((i) => i.familia_id)
                      .filter(Boolean) as string[]
                  )];
                  // Gather KM rows for those families
                  const kmRows = familiaIds.flatMap((fid) => kmPorFamilia.get(fid) ?? []);
                  if (kmRows.length === 0) return null;
                  const totalKm = kmRows.reduce((s, r) => s + Number(r.valor), 0);
                  const kmPorPagar = kmRows
                    .filter((r) => r.estado === "por_pagar")
                    .reduce((s, r) => s + Number(r.valor), 0);
                  // Group by family for display
                  const byFamilia = new Map<string, { nome: string; rows: MapaKmRow[] }>();
                  for (const r of kmRows) {
                    if (!byFamilia.has(r.familia_id)) {
                      const insc = acao.inscricoes.find((i) => i.familia_id === r.familia_id);
                      byFamilia.set(r.familia_id, { nome: insc?.familia_nome ?? "—", rows: [] });
                    }
                    byFamilia.get(r.familia_id)!.rows.push(r);
                  }
                  return (
                    <div className="border border-t-0 rounded-b-lg overflow-x-auto mt-1">
                      <div className="px-4 py-2 bg-orange-50/60 border-b flex items-center gap-2">
                        <Car className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                        <span className="text-xs font-medium text-orange-800">Mapa de KM associado</span>
                        {kmPorPagar > 0 && (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
                            {formatEuro(kmPorPagar)} por pagar
                          </Badge>
                        )}
                        <span className="ml-auto text-xs text-muted-foreground tabular-nums">Total: {formatEuro(totalKm)}</span>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Família</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Motivo</TableHead>
                            <TableHead className="text-right">KM</TableHead>
                            <TableHead className="text-right">Carros</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead>Estado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Array.from(byFamilia.entries()).map(([, { nome, rows }]) =>
                            rows.map((r, ri) => (
                              <TableRow key={r.id}>
                                <TableCell className="font-medium text-sm">
                                  {ri === 0 ? nome : ""}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{formatDate(r.data)}</TableCell>
                                <TableCell className="max-w-[180px] truncate text-sm" title={r.motivo}>{r.motivo}</TableCell>
                                <TableCell className="text-right tabular-nums text-sm">{r.km}</TableCell>
                                <TableCell className="text-right tabular-nums text-sm">{r.n_carros}</TableCell>
                                <TableCell className="text-right tabular-nums font-medium">{formatEuro(Number(r.valor))}</TableCell>
                                <TableCell><EstadoBadge estado={r.estado} /></TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                        <tfoot>
                          <tr className="border-t bg-muted/30">
                            <td colSpan={5} className="px-4 py-2 text-xs font-medium">Total KM</td>
                            <td className="px-4 py-2 text-right text-xs font-semibold tabular-nums">{formatEuro(totalKm)}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </Table>
                    </div>
                  );
                })()}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      )}
    </>
  );
}
