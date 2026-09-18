import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { AlertTriangle, Trash2 } from "lucide-react";
import { formatEuro } from "@/lib/bolsa-transporte";
import type { BolsaPagamento, FamiliaSubgrupo, InscricaoComBolsa } from "./types";

export function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-PT", { day: "numeric", month: "short", year: "numeric" });
}

export function EstadoBadge({ estado }: { estado: BolsaPagamento["estado"] }) {
  if (estado === "pago") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Pago</Badge>;
  if (estado === "cancelado") return <Badge variant="outline" className="text-muted-foreground">Cancelado</Badge>;
  return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Por pagar</Badge>;
}

export function FolhaEstadoBadge({ estado }: { estado: string | null }) {
  if (estado === "enviada") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Enviada</Badge>;
  if (estado === "erro_envio" || estado === "erro") return <Badge variant="destructive">Erro no envio</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">Rascunho</Badge>;
}

export function InlineEditCell({ value, onSave, placeholder = "—" }: { value: string | null; onSave: (v: string) => void; placeholder?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  if (editing) {
    return (
      <Input
        autoFocus
        className="h-7 w-32 text-xs px-2"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { onSave(draft); setEditing(false); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { onSave(draft); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }
  return (
    <button onClick={() => { setDraft(value ?? ""); setEditing(true); }} className="text-left text-sm hover:underline decoration-dotted text-muted-foreground">
      {value || <span className="italic opacity-50">{placeholder}</span>}
    </button>
  );
}

export function InscricaoRow({
  i,
  onChangeEstado,
  onUpdate,
  onMarcarPago,
  onDelete,
  indented = false,
}: {
  i: InscricaoComBolsa;
  onChangeEstado: (i: InscricaoComBolsa, estado: BolsaPagamento["estado"]) => void;
  onUpdate: (i: InscricaoComBolsa, campo: "metodo_pagamento" | "notas", valor: string) => void;
  onMarcarPago: (i: InscricaoComBolsa) => void;
  onDelete: (i: InscricaoComBolsa) => void;
  indented?: boolean;
}) {
  const estado = i.pagamento?.estado ?? "por_pagar";
  const valor = i.pagamento?.valor ?? i.valor_calculado;
  const semCidade = !i.viatura_propria && i.valor_calculado === 0;
  return (
    <TableRow className={semCidade ? "opacity-60" : ""}>
      <TableCell className={`font-medium ${indented ? "pl-8" : ""}`}>{i.pessoa_nome}</TableCell>
      <TableCell className="text-muted-foreground text-xs">{i.familia_nome ?? "—"}</TableCell>
      <TableCell>
        {i.viatura_propria ? (
          <div className="flex items-center gap-1.5">
            <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs">
              🚗 {i.viatura_grupo ?? "?"} · {i.viatura_km ?? 0} km
            </Badge>
            {i.isDuplicateGrupo && (
              <AlertTriangle
                className="h-4 w-4 text-amber-600"
                aria-label="Mesmo grupo — pagar apenas ao condutor"
              />
            )}
          </div>
        ) : semCidade ? (
          <span className="flex items-center gap-1 text-xs text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Cidade não reconhecida
          </span>
        ) : (
          <span className="text-sm">{i.cidade_residencia ?? "—"}</span>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums font-medium">{formatEuro(valor)}</TableCell>
      <TableCell>
        <Select value={estado} onValueChange={(v) => onChangeEstado(i, v as BolsaPagamento["estado"])}>
          <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="por_pagar">Por pagar</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <InlineEditCell value={i.pagamento?.metodo_pagamento ?? null} onSave={(v) => onUpdate(i, "metodo_pagamento", v)} placeholder="Método" />
      </TableCell>
      <TableCell>
        <InlineEditCell value={i.pagamento?.notas ?? null} onSave={(v) => onUpdate(i, "notas", v)} placeholder="Notas" />
      </TableCell>
      <TableCell className="text-right">
        {estado === "por_pagar" && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onMarcarPago(i)}>✓ Pago</Button>
        )}
        {estado === "pago" && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onChangeEstado(i, "por_pagar")}>Reverter</Button>
        )}
      </TableCell>
      <TableCell>
        {i.pagamento && (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); if (confirm("Remover esta bolsa?")) onDelete(i); }}
            title="Remover bolsa"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

export function subgruposPorFamilia(inscricoes: InscricaoComBolsa[]): FamiliaSubgrupo[] {
  const map = new Map<string, FamiliaSubgrupo>();
  for (const i of inscricoes) {
    const key = i.familia_id ?? `__solo_${i.pessoa_id}`;
    const nome = i.familia_id ? (i.familia_nome ?? "—") : i.pessoa_nome;
    if (!map.has(key)) {
      map.set(key, { key, nome, isFamilia: !!i.familia_id, inscricoes: [] });
    }
    map.get(key)!.inscricoes.push(i);
  }
  return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
}

export function FamiliaHeaderRow({
  group,
  colSpan,
  onBulkMarcarPagos,
}: {
  group: FamiliaSubgrupo;
  colSpan: number;
  onBulkMarcarPagos: (members: InscricaoComBolsa[]) => void;
}) {
  const membros = group.inscricoes;
  const activos = membros.filter((i) => (i.pagamento?.estado ?? "por_pagar") !== "cancelado");
  const total = activos.reduce((s, i) => s + (i.pagamento?.valor ?? i.valor_calculado), 0);
  const nPorPagar = activos.filter((i) => (i.pagamento?.estado ?? "por_pagar") === "por_pagar").length;

  return (
    <TableRow className="bg-muted/30 hover:bg-muted/30 border-t-2">
      <TableCell colSpan={colSpan} className="py-2">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm">👪 {group.nome}</span>
          <span className="text-xs text-muted-foreground">{membros.length} pessoas</span>
          {nPorPagar > 0 && (
            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">{nPorPagar} por pagar</Badge>
          )}
          <span className="ml-auto text-sm font-semibold tabular-nums">{formatEuro(total)}</span>
          {nPorPagar > 0 && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onBulkMarcarPagos(activos)}>
              ✓ Marcar todos pagos
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

export function FamiliaSubgrupoBlock({
  group,
  colSpan,
  onBulkMarcarPagos,
  onChangeEstado,
  onUpdate,
  onMarcarPago,
  onDelete,
}: {
  group: FamiliaSubgrupo;
  colSpan: number;
  onBulkMarcarPagos: (members: InscricaoComBolsa[]) => void;
  onChangeEstado: (i: InscricaoComBolsa, estado: BolsaPagamento["estado"]) => void;
  onUpdate: (i: InscricaoComBolsa, campo: "metodo_pagamento" | "notas", valor: string) => void;
  onMarcarPago: (i: InscricaoComBolsa) => void;
  onDelete: (i: InscricaoComBolsa) => void;
}) {
  const showHeader = group.isFamilia && group.inscricoes.length > 1;
  return (
    <>
      {showHeader && (
        <FamiliaHeaderRow
          group={group}
          colSpan={colSpan}
          onBulkMarcarPagos={onBulkMarcarPagos}
        />
      )}
      {group.inscricoes.map((i) => (
        <InscricaoRow
          key={i.inscricao_id}
          i={i}
          onChangeEstado={onChangeEstado}
          onUpdate={onUpdate}
          onMarcarPago={onMarcarPago}
          onDelete={onDelete}
          indented={showHeader}
        />
      ))}
    </>
  );
}
