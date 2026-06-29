import { useMemo, useState } from "react";
import type { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import type { SmartColumnMeta } from "./types";

function metaOf(col: any): SmartColumnMeta {
  return (col.columnDef?.meta ?? {}) as SmartColumnMeta;
}
function labelOf(col: any): string {
  const m = metaOf(col);
  if (m.label) return m.label;
  const h = col.columnDef?.header;
  if (typeof h === "string") return h;
  return String(col.id);
}

export function BulkEditDialog<T>({
  open,
  onOpenChange,
  table,
  editableColumns,
  selectedIds,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  table: Table<T>;
  editableColumns: string[];
  selectedIds: string[];
  onConfirm: (patch: Record<string, unknown>) => Promise<void> | void;
}) {
  const cols = useMemo(
    () =>
      editableColumns
        .map((id) => table.getColumn(id))
        .filter((c): c is NonNullable<typeof c> => !!c),
    [editableColumns, table],
  );

  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);

  const toggle = (id: string, v: boolean) => {
    setEnabled((p) => ({ ...p, [id]: v }));
    if (!v) setValues((p) => { const n = { ...p }; delete n[id]; return n; });
  };

  const onSubmit = async () => {
    const patch: Record<string, unknown> = {};
    for (const c of cols) if (enabled[c.id]) patch[c.id] = values[c.id] ?? null;
    if (Object.keys(patch).length === 0) {
      toast.error("Escolhe pelo menos um campo para alterar");
      return;
    }
    setBusy(true);
    try {
      await onConfirm(patch);
      onOpenChange(false);
      setEnabled({});
      setValues({});
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar {selectedIds.length} linhas em massa</DialogTitle>
          <DialogDescription>
            Marca os campos a alterar. Só os campos marcados serão atualizados.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {cols.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Esta tabela não tem campos editáveis em massa.
            </p>
          )}
          {cols.map((c) => {
            const m = metaOf(c);
            const t = m.editType ?? "text";
            const on = !!enabled[c.id];
            return (
              <div key={c.id} className="flex items-start gap-3 rounded-md border p-2">
                <Checkbox checked={on} onCheckedChange={(v) => toggle(c.id, !!v)} className="mt-2" />
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">{labelOf(c)}</Label>
                  {t === "select" && m.editSelectOptions ? (
                    <Select
                      disabled={!on}
                      value={(values[c.id] as string) ?? ""}
                      onValueChange={(v) => setValues((p) => ({ ...p, [c.id]: v }))}
                    >
                      <SelectTrigger className="h-9"><SelectValue placeholder="Escolhe…" /></SelectTrigger>
                      <SelectContent>
                        {m.editSelectOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      disabled={!on}
                      type={t === "number" ? "number" : t === "date" ? "date" : "text"}
                      value={(values[c.id] as string) ?? ""}
                      onChange={(e) =>
                        setValues((p) => ({
                          ...p,
                          [c.id]: t === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value,
                        }))
                      }
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={busy || cols.length === 0}>
            {busy ? "A aplicar…" : `Aplicar a ${selectedIds.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}