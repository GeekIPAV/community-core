import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Car, ChevronDown } from "lucide-react";
import { formatEuro } from "@/lib/bolsa-transporte";
import { EstadoBadge, formatDate } from "./helpers";
import type { FamiliaResumo, MapaKmRow } from "./types";

export function FamiliasTab({
  loading,
  familiasFiltradas,
  familiaSearch,
  setFamiliaSearch,
  kmPorFamilia,
}: {
  loading: boolean;
  familiasFiltradas: FamiliaResumo[];
  familiaSearch: string;
  setFamiliaSearch: (v: string) => void;
  kmPorFamilia: Map<string, MapaKmRow[]>;
}) {
  return (
    <>
      <Input placeholder="Pesquisar família…" value={familiaSearch} onChange={(e) => setFamiliaSearch(e.target.value)} className="md:max-w-md" />
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : familiasFiltradas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem famílias com bolsa.</p>
      ) : (
        <div className="space-y-2">
          {familiasFiltradas.map((familia) => (
            <Collapsible key={familia.familia_id}>
              <CollapsibleTrigger className="w-full flex items-center justify-between p-4 rounded-lg border hover:bg-muted/40">
                <span className="font-medium">{familia.familia_nome}</span>
                <div className="flex items-center gap-3">
                  {familia.totalPorReceber > 0 && <span className="text-amber-700 text-sm tabular-nums">{formatEuro(familia.totalPorReceber)} por receber</span>}
                  {familia.totalRecebido > 0 && <span className="text-emerald-700 text-sm tabular-nums">{formatEuro(familia.totalRecebido)} recebido</span>}
                  {(() => {
                    const kmRows = kmPorFamilia.get(familia.familia_id) ?? [];
                    const kmTotal = kmRows.reduce((s, r) => s + Number(r.valor), 0);
                    if (kmTotal === 0) return null;
                    const kmPP = kmRows.filter((r) => r.estado === "por_pagar").reduce((s, r) => s + Number(r.valor), 0);
                    return (
                      <span className="flex items-center gap-1 text-orange-700 text-sm tabular-nums">
                        <Car className="h-3.5 w-3.5" />
                        {formatEuro(kmPP > 0 ? kmPP : kmTotal)}{kmPP > 0 ? " KM p/pagar" : " KM"}
                      </span>
                    );
                  })()}
                  <ChevronDown className="h-4 w-4 transition-transform [[data-state=open]_&]:rotate-180" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border border-t-0 rounded-b-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ação</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Pessoa</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Data pagamento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {familia.inscricoes.map((i) => (
                        <TableRow key={i.inscricao_id}>
                          <TableCell className="font-medium">{i.acao_nome}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{formatDate(i.acao_data)}</TableCell>
                          <TableCell>{i.pessoa_nome}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatEuro(i.pagamento?.valor ?? i.valor_calculado)}</TableCell>
                          <TableCell><EstadoBadge estado={i.pagamento?.estado ?? "por_pagar"} /></TableCell>
                          <TableCell className="text-muted-foreground text-xs">{i.pagamento?.data_pagamento ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <tfoot>
                      <tr className="border-t bg-muted/30">
                        <td colSpan={3} className="px-4 py-2 text-xs font-medium">Total</td>
                        <td className="px-4 py-2 text-right text-xs font-semibold tabular-nums">{formatEuro(familia.totalRecebido + familia.totalPorReceber)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </Table>
                </div>
                {(() => {
                  const kmRows = kmPorFamilia.get(familia.familia_id) ?? [];
                  if (kmRows.length === 0) return null;
                  const totalKm = kmRows.reduce((s, r) => s + Number(r.valor), 0);
                  const kmPorPagar = kmRows.filter((r) => r.estado === "por_pagar").reduce((s, r) => s + Number(r.valor), 0);
                  return (
                    <div className="border-t border-border">
                      <div className="px-4 py-2 bg-orange-50/50 flex items-center gap-2">
                        <Car className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                        <span className="text-xs font-medium text-orange-800">Mapa de KM</span>
                        {kmPorPagar > 0 && (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs ml-auto">
                            {formatEuro(kmPorPagar)} por pagar
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto tabular-nums">Total: {formatEuro(totalKm)}</span>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Motivo</TableHead>
                            <TableHead className="text-right">KM</TableHead>
                            <TableHead className="text-right">Carros</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead>Estado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {kmRows.map((r) => (
                            <TableRow key={r.id}>
                              <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{formatDate(r.data)}</TableCell>
                              <TableCell className="max-w-[180px] truncate text-sm" title={r.motivo}>{r.motivo}</TableCell>
                              <TableCell className="text-right tabular-nums text-sm">{r.km}</TableCell>
                              <TableCell className="text-right tabular-nums text-sm">{r.n_carros}</TableCell>
                              <TableCell className="text-right tabular-nums font-medium">{formatEuro(Number(r.valor))}</TableCell>
                              <TableCell><EstadoBadge estado={r.estado} /></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <tfoot>
                          <tr className="border-t bg-muted/30">
                            <td colSpan={4} className="px-4 py-2 text-xs font-medium">Total KM</td>
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
