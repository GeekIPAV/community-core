import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown } from "lucide-react";

export function InlineText({
  value,
  onSave,
  type = "text",
}: {
  value: string | null;
  onSave: (v: string | null) => Promise<void> | void;
  type?: "text" | "date";
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? "");
  useEffect(() => { setVal(value ?? ""); }, [value]);
  if (!editing) {
    return (
      <span
        className="block min-h-[1.5rem] cursor-text rounded px-1 -mx-1 text-muted-foreground hover:bg-muted/50"
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      >
        {value ? value : <span className="opacity-50">—</span>}
      </span>
    );
  }
  const commit = async () => {
    setEditing(false);
    const next = val.trim() === "" ? null : val;
    if (next !== (value ?? null)) await onSave(next);
  };
  return (
    <Input
      autoFocus
      type={type}
      value={val}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") { setVal(value ?? ""); setEditing(false); }
      }}
      className="h-7 px-1.5 text-sm"
    />
  );
}

export function InlineSelect({
  value,
  options,
  onSave,
  placeholder = "—",
  allowClear = true,
}: {
  value: string | null;
  options: { value: string; label: string }[];
  onSave: (v: string | null) => Promise<void> | void;
  placeholder?: string;
  allowClear?: boolean;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Select
        value={value ?? "__null"}
        onValueChange={async (v) => {
          const next = v === "__null" ? null : v;
          if (next !== (value ?? null)) await onSave(next);
        }}
      >
        <SelectTrigger className="h-7 w-full border-transparent bg-transparent px-1.5 text-sm shadow-none hover:border-border hover:bg-muted/50 [&>svg]:opacity-50">
          <SelectValue>
            {current ? (
              <span>{current.label}</span>
            ) : (
              <span className="text-muted-foreground opacity-60">{placeholder}</span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {allowClear && <SelectItem value="__null">— {placeholder} —</SelectItem>}
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function InlineMultiSelect({
  values,
  options,
  onSave,
  placeholder = "—",
}: {
  values: string[];
  options: { value: string; label: string }[];
  onSave: (next: string[]) => Promise<void> | void;
  placeholder?: string;
}) {
  const [local, setLocal] = useState<string[]>(values);
  useEffect(() => { setLocal(values); }, [values.join(",")]);
  const labels = local.map((v) => options.find((o) => o.value === v)?.label).filter(Boolean) as string[];
  const toggle = async (v: string) => {
    const next = local.includes(v) ? local.filter((x) => x !== v) : [...local, v];
    setLocal(next);
    if (next.join(",") !== values.join(",")) await onSave(next);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-sm hover:bg-muted/50"
        >
          <span
            className={`min-w-0 flex-1 truncate ${labels.length ? "text-foreground" : "text-muted-foreground"}`}
            title={labels.join(", ")}
          >
            {labels.length === 0
              ? placeholder
              : labels.length <= 2
                ? labels.join(", ")
                : `${labels[0]} +${labels.length - 1}`}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-1" onClick={(e) => e.stopPropagation()}>
        <div className="max-h-64 overflow-auto">
          {options.length === 0 && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">Sem opções</div>
          )}
          {options.map((o) => {
            const checked = local.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <Checkbox checked={checked} />
                <span>{o.label}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}