import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Copy,
  Code2,
  ChevronDown,
  Plus,
  Search,
  Pencil,
  Trash2,
  Files,
} from "lucide-react";
import { toast } from "sonner";
import { PREVIEWS } from "./previews";
import { LibraryEditorSheet, type LibraryEntry } from "./library-editor-sheet";

const CATEGORIAS_ORDER = [
  "KPIs",
  "Tabelas",
  "Formulários",
  "Navegação",
  "Feedback",
  "Dados",
  "Layout",
  "Outros",
];

export function LibraryTab() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [editing, setEditing] = useState<LibraryEntry | null>(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["component_library"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("component_library" as never)
        .select("*")
        .order("categoria")
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as unknown as LibraryEntry[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("component_library" as never)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Eliminado");
      qc.invalidateQueries({ queryKey: ["component_library"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dup = useMutation({
    mutationFn: async (e: LibraryEntry) => {
      const { id: _id, created_at: _c, updated_at: _u, ...rest } = e;
      const { error } = await supabase
        .from("component_library" as never)
        .insert({ ...rest, titulo: `${e.titulo} (cópia)` } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Duplicado");
      qc.invalidateQueries({ queryKey: ["component_library"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = busca.trim().toLowerCase();
    return data.filter((e) => {
      if (categoria && e.categoria !== categoria) return false;
      if (!q) return true;
      return (
        e.titulo.toLowerCase().includes(q) ||
        (e.descricao ?? "").toLowerCase().includes(q) ||
        (e.prompt_pt ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, busca, categoria]);

  const categorias = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((e) => set.add(e.categoria));
    return CATEGORIAS_ORDER.filter((c) => set.has(c)).concat(
      Array.from(set).filter((c) => !CATEGORIAS_ORDER.includes(c)),
    );
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar componentes ou prompts..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-2" /> Novo componente
        </Button>
      </div>

      {/* Categorias */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCategoria(null)}
          className={`text-xs rounded-full px-3 py-1 border ${
            categoria === null
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card hover:bg-muted"
          }`}
        >
          Todos
        </button>
        {categorias.map((c) => (
          <button
            key={c}
            onClick={() => setCategoria(c)}
            className={`text-xs rounded-full px-3 py-1 border ${
              categoria === c
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card hover:bg-muted"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center py-12 text-center text-muted-foreground text-sm">
          Sem componentes com esses critérios.
        </div>
      )}

      <div className="grid gap-4">
        {filtered.map((entry) => (
          <LibraryCard
            key={entry.id}
            entry={entry}
            onEdit={() => setEditing(entry)}
            onDuplicate={() => dup.mutate(entry)}
            onDelete={() => del.mutate(entry.id)}
          />
        ))}
      </div>

      <LibraryEditorSheet
        open={creating}
        onOpenChange={setCreating}
        entry={null}
      />
      <LibraryEditorSheet
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        entry={editing}
      />
    </div>
  );
}

function LibraryCard({
  entry,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  entry: LibraryEntry;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [lang, setLang] = useState<"pt" | "en">("pt");
  const [showCode, setShowCode] = useState(false);
  const Preview = entry.preview_key ? PREVIEWS[entry.preview_key] : undefined;

  const prompt = lang === "pt" ? entry.prompt_pt : entry.prompt_en ?? entry.prompt_pt;

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-xl">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base">{entry.titulo}</CardTitle>
              <Badge variant="secondary" className="text-[10px]">
                {entry.categoria}
              </Badge>
            </div>
            {entry.descricao && (
              <p className="mt-1 text-xs text-muted-foreground">{entry.descricao}</p>
            )}
            {entry.tokens.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {entry.tokens.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] font-mono rounded bg-muted px-1.5 py-0.5 text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="icon" variant="ghost" onClick={onEdit} title="Editar">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onDuplicate} title="Duplicar">
              <Files className="h-3.5 w-3.5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="icon" variant="ghost" title="Eliminar">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar {entry.titulo}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acção não pode ser revertida.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete}>Eliminar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {/* Preview */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
            Preview
          </div>
          {Preview ? (
            <Preview />
          ) : (
            <div className="rounded-md border border-dashed p-6 text-xs text-muted-foreground text-center">
              Preview indisponível
              {entry.preview_key && (
                <div className="mt-1 font-mono">({entry.preview_key})</div>
              )}
            </div>
          )}
        </div>

        {/* Prompt */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Prompt
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setLang("pt")}
                className={`text-[10px] px-1.5 py-0.5 rounded ${lang === "pt" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                PT
              </button>
              <button
                onClick={() => setLang("en")}
                className={`text-[10px] px-1.5 py-0.5 rounded ${lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                disabled={!entry.prompt_en}
              >
                EN
              </button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => copy(prompt, "Prompt")}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="rounded-md border bg-muted/40 p-3 text-xs whitespace-pre-wrap max-h-56 overflow-y-auto">
            {prompt || <span className="text-muted-foreground">(sem prompt)</span>}
          </div>

          {entry.snippet && (
            <Collapsible open={showCode} onOpenChange={setShowCode} className="mt-3">
              <div className="flex items-center justify-between">
                <CollapsibleTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs">
                    <Code2 className="h-3.5 w-3.5" />
                    Snippet
                    <ChevronDown
                      className={`h-3 w-3 transition-transform ${showCode ? "rotate-180" : ""}`}
                    />
                  </Button>
                </CollapsibleTrigger>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => copy(entry.snippet ?? "", "Snippet")}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <CollapsibleContent>
                <pre className="mt-1 rounded-md border bg-background p-3 text-[11px] font-mono overflow-x-auto max-h-64">
                  <code>{entry.snippet}</code>
                </pre>
              </CollapsibleContent>
            </Collapsible>
          )}

          <div className="mt-3">
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => {
                const full = entry.snippet
                  ? `${prompt}\n\n\`\`\`tsx\n${entry.snippet}\n\`\`\``
                  : prompt;
                copy(full, "Tudo");
              }}
            >
              <Copy className="h-3.5 w-3.5 mr-2" /> Copiar tudo (prompt + snippet)
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}