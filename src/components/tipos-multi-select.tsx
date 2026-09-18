import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Seletor de tipos de perfil cumulativos.
 * Uma pessoa pode ter vários tipos ao mesmo tempo e acumula as permissões de todos.
 */
export function TiposMultiSelect({
  values,
  options,
  onChange,
  placeholder = "sem tipos",
  className = "",
}: {
  values: string[];
  options: { value: string; label: string }[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const labels = values
    .map((v) => options.find((o) => o.value === v)?.label)
    .filter(Boolean) as string[];
  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={`flex min-h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1.5 text-left text-sm shadow-sm hover:bg-muted/50 ${className}`}
        >
          <span className={labels.length ? "truncate" : "text-muted-foreground truncate"}>
            {labels.length ? labels.join(", ") : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-56 p-1" onClick={(e) => e.stopPropagation()}>
        <div className="max-h-64 overflow-auto">
          {options.length === 0 && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">Sem opções</div>
          )}
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <Checkbox checked={values.includes(o.value)} />
              <span>{o.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
