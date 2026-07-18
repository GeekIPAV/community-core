import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { PREVIEW_KEYS } from "./previews";

export type LibraryEntry = {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: string;
  prompt_pt: string;
  prompt_en: string | null;
  snippet: string | null;
  tokens: string[];
  preview_key: string | null;
  ordem?: number | null;
  created_at?: string;
  updated_at?: string;
};

const CATEGORIAS = [
  "KPIs",
  "Tabelas",
  "Formulários",
  "Navegação",
  "Feedback",
  "Dados",
  "Layout",
  "Outros",
];

const EMPTY: Omit<LibraryEntry, "id"> = {
  titulo: "",
  descricao: "",
  categoria: "Outros",
  prompt_pt: "",
  prompt_en: "",
  snippet: "",
  tokens: [],
  preview_key: null,
  ordem: 0,
};

export function LibraryEditorSheet({
  open,
  onOpenChange,
  entry,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entry: LibraryEntry | null;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Omit<LibraryEntry, "id">>(EMPTY);
  const [tokensStr, setTokensStr] = useState("");

  useEffect(() => {
    if (entry) {
      const { id: _id, created_at: _c, updated_at: _u, ...rest } = entry;
      setForm(rest);
      setTokensStr(entry.tokens.join(", "));
    } else {
      setForm(EMPTY);
      setTokensStr("");
    }
  }, [entry, open]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        tokens: tokensStr
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      if (entry) {
        const { error } = await supabase
          .from("component_library" as never)
          .update(payload as never)
          .eq("id", entry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("component_library" as never)
          .insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(entry ? "Actualizado" : "Criado");
      qc.invalidateQueries({ queryKey: ["component_library"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="p-6 border-b">
          <SheetTitle>{entry ? "Editar componente" : "Novo componente"}</SheetTitle>
          <SheetDescription>
            Guarda o prompt, snippet e preview para reutilizar noutras apps.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Título</Label>
              <Input
                value={form.titulo}
                onChange={(e) => set("titulo", e.target.value)}
                placeholder="Ex: KPI Card"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Categoria</Label>
              <Select
                value={form.categoria}
                onValueChange={(v) => set("categoria", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Preview key</Label>
              <Select
                value={form.preview_key ?? "__none__"}
                onValueChange={(v) => set("preview_key", v === "__none__" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— sem preview —</SelectItem>
                  {PREVIEW_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Descrição</Label>
            <Textarea
              rows={2}
              value={form.descricao ?? ""}
              onChange={(e) => set("descricao", e.target.value)}
              placeholder="Quando/como usar"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Prompt (PT)</Label>
            <Textarea
              rows={6}
              value={form.prompt_pt}
              onChange={(e) => set("prompt_pt", e.target.value)}
              className="font-mono text-xs"
              placeholder="Cria um cartão KPI com..."
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Prompt (EN)</Label>
            <Textarea
              rows={6}
              value={form.prompt_en ?? ""}
              onChange={(e) => set("prompt_en", e.target.value)}
              className="font-mono text-xs"
              placeholder="Create a KPI card with..."
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Snippet (TSX)</Label>
            <Textarea
              rows={10}
              value={form.snippet ?? ""}
              onChange={(e) => set("snippet", e.target.value)}
              className="font-mono text-xs"
              placeholder="<Card>...</Card>"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Tokens (separados por vírgula)</Label>
            <Input
              value={tokensStr}
              onChange={(e) => setTokensStr(e.target.value)}
              placeholder="primary, card, radius"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Ordem</Label>
            <Input
              type="number"
              value={form.ordem ?? 0}
              onChange={(e) => set("ordem", Number(e.target.value))}
            />
          </div>
        </div>

        <div className="border-t p-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !form.titulo.trim()}
          >
            {save.isPending ? "A guardar..." : "Guardar"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}