import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { InlineSelect } from "@/components/inline-edit";
import { cn } from "@/lib/utils";
import type { SmartColumnMeta } from "./types";

export function EditableCell({
  value,
  meta,
  onCommit,
}: {
  value: unknown;
  meta: SmartColumnMeta;
  onCommit: (v: unknown) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value == null ? "" : String(value));
  useEffect(() => setDraft(value == null ? "" : String(value)), [value]);

  const editType = meta.editType ?? "text";

  if (editType === "select" && meta.editSelectOptions) {
    return (
      <div className="-mx-1">
        <InlineSelect
          value={value == null ? null : String(value)}
          options={meta.editSelectOptions}
          onSave={(v) => onCommit(v)}
        />
      </div>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
        className="group/edit flex w-full items-center gap-1.5 rounded border border-dashed border-border/60 px-1.5 py-1 text-left text-sm hover:border-primary/50 hover:bg-muted/40"
        title="Clica para editar"
      >
        <span className="flex-1 truncate">
          {value == null || value === "" ? (
            <span className="text-muted-foreground/60">—</span>
          ) : (
            String(value)
          )}
        </span>
        <Pencil className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover/edit:opacity-100" />
      </button>
    );
  }

  const commit = async () => {
    setEditing(false);
    let next: unknown = draft;
    if (editType === "number") next = draft === "" ? null : Number(draft);
    else if (draft === "") next = null;
    if (next !== (value ?? null)) await onCommit(next);
  };

  return (
    <Input
      autoFocus
      type={editType === "date" ? "date" : editType === "number" ? "number" : "text"}
      value={draft}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        else if (e.key === "Escape") {
          setDraft(value == null ? "" : String(value));
          setEditing(false);
        }
      }}
      className={cn("h-7 px-1.5 text-sm")}
    />
  );
}