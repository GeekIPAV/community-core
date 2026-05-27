import { useState } from "react";
import { format } from "date-fns";
import { Check, ChevronsUpDown, Filter, Plus, Trash2, X, CalendarIcon } from "lucide-react";
import type { Table, Column } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type FilterVariant = "text" | "number" | "date" | "select";

export type ColumnFilterMeta = {
  filterVariant?: FilterVariant;
  /** Options for select variant */
  filterOptions?: string[];
  /** Pretty label for the column (defaults to column.id) */
  label?: string;
};

export type FilterRule = {
  id: string;
  columnId: string;
  operator: string;
  value: any;
};

/** Per-variant operators with PT-PT labels */
const OPERATORS: Record<FilterVariant, { value: string; label: string }[]> = {
  text: [
    { value: "contains", label: "Contém" },
    { value: "equals", label: "É exatamente" },
    { value: "notEquals", label: "Não é" },
    { value: "empty", label: "Está vazio" },
    { value: "notEmpty", label: "Não está vazio" },
  ],
  number: [
    { value: "eq", label: "Igual a" },
    { value: "gt", label: "Maior que" },
    { value: "lt", label: "Menor que" },
    { value: "gte", label: "Maior ou igual" },
    { value: "lte", label: "Menor ou igual" },
  ],
  date: [
    { value: "eq", label: "É exatamente" },
    { value: "before", label: "Antes de" },
    { value: "after", label: "Depois de" },
    { value: "between", label: "Entre" },
  ],
  select: [
    { value: "equals", label: "É exatamente" },
    { value: "notEquals", label: "Não é" },
    { value: "in", label: "É um de" },
  ],
};

/** Single global filterFn that interprets the rules array. Pass as `filterFn: advancedFilterFn` on each filterable column, or use as table-level globalFilter. */
export function advancedFilterFn(row: any, columnId: string, filterValue: any): boolean {
  if (!filterValue) return true;
  const rules: FilterRule[] = Array.isArray(filterValue) ? filterValue : [];
  const cellRules = rules.filter((r) => r.columnId === columnId);
  if (cellRules.length === 0) return true;
  const raw = row.getValue(columnId);
  return cellRules.every((rule) => evalRule(raw, rule));
}

function evalRule(raw: any, rule: FilterRule): boolean {
  const op = rule.operator;
  const val = rule.value;

  if (op === "empty") return raw === null || raw === undefined || raw === "";
  if (op === "notEmpty") return !(raw === null || raw === undefined || raw === "");
  if (val === undefined || val === null || val === "") return true;

  const s = String(raw ?? "").toLowerCase();

  switch (op) {
    case "contains":
      return s.includes(String(val).toLowerCase());
    case "equals":
      return s === String(val).toLowerCase();
    case "notEquals":
      return s !== String(val).toLowerCase();
    case "in":
      return Array.isArray(val) && val.map(String).map((x) => x.toLowerCase()).includes(s);
    case "eq": {
      if (raw instanceof Date || isDateLike(raw)) return sameDay(toDate(raw), toDate(val));
      return Number(raw) === Number(val);
    }
    case "gt":
      if (isDateLike(raw)) return toDate(raw)! > toDate(val)!;
      return Number(raw) > Number(val);
    case "lt":
      if (isDateLike(raw)) return toDate(raw)! < toDate(val)!;
      return Number(raw) < Number(val);
    case "gte":
      return Number(raw) >= Number(val);
    case "lte":
      return Number(raw) <= Number(val);
    case "before": {
      const a = toDate(raw); const b = toDate(val);
      return !!(a && b && a < b);
    }
    case "after": {
      const a = toDate(raw); const b = toDate(val);
      return !!(a && b && a > b);
    }
    case "between": {
      const a = toDate(raw);
      const from = toDate(val?.from); const to = toDate(val?.to);
      return !!(a && from && to && a >= from && a <= to);
    }
    default:
      return true;
  }
}

function isDateLike(v: any): boolean {
  if (v === null || v === undefined) return false;
  if (v instanceof Date) return true;
  if (typeof v !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}/.test(v);
}
function toDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
function sameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function uid() { return Math.random().toString(36).slice(2, 10); }

function getMeta(col: Column<any, any>): ColumnFilterMeta {
  return (col.columnDef.meta as ColumnFilterMeta) ?? {};
}
function variantOf(col: Column<any, any>): FilterVariant {
  return getMeta(col).filterVariant ?? "text";
}
function labelOf(col: Column<any, any>): string {
  return getMeta(col).label ?? String(col.columnDef.header ?? col.id);
}

export function AdvancedTableFilters<T>({ table }: { table: Table<T> }) {
  const [open, setOpen] = useState(false);

  const filterableColumns = table.getAllLeafColumns().filter((c) => c.getCanFilter() && getMeta(c).filterVariant);

  // Aggregate all existing rules across columns into a single list (each column holds its rules under its filter value).
  const allRules: FilterRule[] = filterableColumns.flatMap((c) => {
    const v = c.getFilterValue();
    return Array.isArray(v) ? (v as FilterRule[]) : [];
  });

  const setRules = (rules: FilterRule[]) => {
    const byCol = new Map<string, FilterRule[]>();
    for (const r of rules) {
      const arr = byCol.get(r.columnId) ?? [];
      arr.push(r);
      byCol.set(r.columnId, arr);
    }
    const next = filterableColumns
      .map((col) => ({ id: col.id, value: byCol.get(col.id) }))
      .filter((f) => f.value && f.value.length > 0);
    table.setColumnFilters(next as any);
  };

  const addRule = () => {
    const first = filterableColumns[0];
    if (!first) return;
    const variant = variantOf(first);
    const rule: FilterRule = {
      id: uid(),
      columnId: first.id,
      operator: OPERATORS[variant][0].value,
      value: "",
    };
    setRules([...allRules, rule]);
  };
  const updateRule = (id: string, patch: Partial<FilterRule>) => {
    setRules(allRules.map((r) => {
      if (r.id !== id) return r;
      const merged = { ...r, ...patch };
      if (patch.columnId && patch.columnId !== r.columnId) {
        const col = filterableColumns.find((c) => c.id === patch.columnId);
        const variant = col ? variantOf(col) : "text";
        merged.operator = OPERATORS[variant][0].value;
        merged.value = "";
      }
      return merged;
    }));
  };
  const removeRule = (id: string) => setRules(allRules.filter((r) => r.id !== id));
  const clearAll = () => setRules([]);

  const activeCount = allRules.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          Filtros avançados
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">{activeCount}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(640px,90vw)] p-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Regras (todas têm de bater certo)</p>
            {activeCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 px-2 text-xs">
                <X className="mr-1 h-3.5 w-3.5" /> Limpar
              </Button>
            )}
          </div>

          {allRules.length === 0 ? (
            <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
              Sem regras. Clica em "Adicionar regra".
            </p>
          ) : (
            <div className="space-y-2">
              {allRules.map((rule) => {
                const col = filterableColumns.find((c) => c.id === rule.columnId);
                const variant = col ? variantOf(col) : "text";
                return (
                  <div key={rule.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
                    <ChoiceButton
                      value={rule.columnId}
                      options={filterableColumns.map((c) => ({ value: c.id, label: labelOf(c) }))}
                      onChange={(v) => updateRule(rule.id, { columnId: v })}
                      className="w-[160px]"
                    />
                    <ChoiceButton
                      value={rule.operator}
                      options={OPERATORS[variant]}
                      onChange={(v) => updateRule(rule.id, { operator: v, value: v === "between" ? { from: null, to: null } : "" })}
                      className="w-[140px]"
                    />
                    <div className="flex-1 min-w-[180px]">
                      <RuleValueInput
                        variant={variant}
                        operator={rule.operator}
                        value={rule.value}
                        onChange={(v) => updateRule(rule.id, { value: v })}
                        options={col ? getMeta(col).filterOptions : undefined}
                      />
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeRule(rule.id)} className="h-8 w-8">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          <Button variant="outline" size="sm" onClick={addRule} className="w-full">
            <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar regra
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ChoiceButton({
  value,
  options,
  onChange,
  placeholder = "Escolhe…",
  className,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const selected = options.find((option) => option.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("h-8 w-full justify-between gap-2 px-3 font-normal", !selected && "text-muted-foreground", className)}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto">
        {options.map((option) => (
          <DropdownMenuItem key={option.value} onSelect={() => onChange(option.value)} className="gap-2">
            <Check className={cn("h-4 w-4", option.value === value ? "opacity-100" : "opacity-0")} />
            <span className="truncate">{option.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RuleValueInput({
  variant, operator, value, onChange, options,
}: {
  variant: FilterVariant;
  operator: string;
  value: any;
  onChange: (v: any) => void;
  options?: string[];
}) {
  if (operator === "empty" || operator === "notEmpty") {
    return <div className="text-xs text-muted-foreground">—</div>;
  }

  if (variant === "date") {
    if (operator === "between") {
      const range = (value ?? {}) as { from?: string; to?: string };
      return (
        <div className="flex gap-1">
          <DateButton value={range.from} onChange={(v) => onChange({ ...range, from: v })} placeholder="De" />
          <DateButton value={range.to} onChange={(v) => onChange({ ...range, to: v })} placeholder="Até" />
        </div>
      );
    }
    return <DateButton value={value} onChange={onChange} />;
  }

  if (variant === "select" && options && options.length > 0) {
    if (operator === "in") {
      const arr: string[] = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-wrap gap-1">
          {options.map((o) => {
            const checked = arr.includes(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() => onChange(checked ? arr.filter((x) => x !== o) : [...arr, o])}
                className={cn(
                  "rounded-md border px-2 py-1 text-xs",
                  checked ? "border-primary bg-primary/10" : "hover:bg-muted",
                )}
              >
                {o}
              </button>
            );
          })}
        </div>
      );
    }
    const safeOptions = options.filter((o) => o !== "" && o !== null && o !== undefined);
    return (
      <ChoiceButton
        value={value ? String(value) : ""}
        options={safeOptions.map((o) => ({ value: o, label: o }))}
        onChange={onChange}
        placeholder="Escolhe…"
      />
    );
  }

  if (variant === "number") {
    return (
      <Input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        className="h-8"
      />
    );
  }

  return (
    <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="h-8" placeholder="Valor" />
  );
}

function DateButton({ value, onChange, placeholder = "Escolhe data" }: { value?: string; onChange: (v: string) => void; placeholder?: string }) {
  const d = value ? new Date(value) : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-8 justify-start font-normal", !d && "text-muted-foreground")}>
          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
          {d ? format(d, "yyyy-MM-dd") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={d}
          onSelect={(date) => date && onChange(format(date, "yyyy-MM-dd"))}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}