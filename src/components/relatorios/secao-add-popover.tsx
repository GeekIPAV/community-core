import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Plus, Type, BarChart3, CalendarDays, Users, FolderOpen, Quote, Minus,
} from "lucide-react";
import type { SecaoTipo } from "@/lib/relatorios/types";

const ITENS: { tipo: SecaoTipo; label: string; icon: any }[] = [
  { tipo: "texto", label: "Texto", icon: Type },
  { tipo: "indicadores", label: "Indicadores", icon: BarChart3 },
  { tipo: "atividades", label: "Atividades", icon: CalendarDays },
  { tipo: "participantes", label: "Participantes", icon: Users },
  { tipo: "casos", label: "Casos", icon: FolderOpen },
  { tipo: "citacao", label: "Citação", icon: Quote },
  { tipo: "separador", label: "Separador", icon: Minus },
];

export function SecaoAddPopover({ onAdd, compact = false }: {
  onAdd: (tipo: SecaoTipo) => void;
  compact?: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={
            compact
              ? "h-7 text-xs text-muted-foreground hover:text-foreground"
              : "h-9 text-sm text-muted-foreground hover:text-foreground"
          }
        >
          <Plus className="me-1 h-3.5 w-3.5" />
          Adicionar secção
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="center">
        <div className="grid grid-cols-2 gap-1">
          {ITENS.map(({ tipo, label, icon: Icon }) => (
            <Button
              key={tipo}
              variant="ghost"
              className="h-auto py-2 justify-start gap-2 text-sm"
              onClick={() => onAdd(tipo)}
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              {label}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}