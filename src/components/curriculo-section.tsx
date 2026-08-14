import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Upload, Loader2, X, Save, Plus, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";

export type Lingua = { lingua: string; nivel: string };

type Curriculo = {
  id: string;
  pessoa_id: string;
  cv_url: string | null;
  cv_nome_ficheiro: string | null;
  carta_motivacao_url: string | null;
  carta_motivacao_nome_ficheiro: string | null;
  carta_motivacao_texto: string | null;
  areas_interesse: string[];
  competencias: string[];
  disponibilidade: string | null;
  notas: string | null;
  carta_conducao: boolean | null;
  carta_conducao_categorias: string[] | null;
  linguas: Lingua[] | null;
};

type Area = { id: string; nome: string; categoria: string | null };

const CATEGORIAS_CARTA = ["AM", "A1", "A2", "A", "B1", "B", "BE", "C1", "C", "CE", "D1", "D", "DE"];
export const NIVEIS_LINGUA = ["Nativo", "C2", "C1", "B2", "B1", "A2", "A1"];

const ALLOWED = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function isAllowed(file: File) {
  return ALLOWED.includes(file.type) || /\.(pdf|docx?|DOCX?)$/.test(file.name);
}

export function CurriculoSection({ pessoaId, onDeleted }: { pessoaId: string; onDeleted?: () => void }) {
  const qc = useQueryClient();

  const { data: curriculo, isLoading } = useQuery({
    queryKey: ["curriculo", pessoaId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("curriculos") as any)
        .select("*")
        .eq("pessoa_id", pessoaId)
        .maybeSingle();
      if (error) throw error;
      return (data as Curriculo | null) ?? null;
    },
  });

  const { data: areas } = useQuery({
    queryKey: ["areas-interesse-catalogo"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("areas_interesse_catalogo") as any)
        .select("id, nome, categoria")
        .eq("ativo", true)
        .order("categoria")
        .order("nome");
      if (error) throw error;
      return (data as Area[]) ?? [];
    },
  });

  const [areasSel, setAreasSel] = useState<string[]>([]);
  const [competencias, setCompetencias] = useState<string[]>([]);
  const [novaCompetencia, setNovaCompetencia] = useState("");
  const [disponibilidade, setDisponibilidade] = useState("");
  const [notas, setNotas] = useState("");
  const [cartaConducao, setCartaConducao] = useState(false);
  const [cartaCategorias, setCartaCategorias] = useState<string[]>([]);
  const [linguas, setLinguas] = useState<Lingua[]>([]);
  const [novaLingua, setNovaLingua] = useState("");
  const [novoNivel, setNovoNivel] = useState("B1");

  useEffect(() => {
    setAreasSel(curriculo?.areas_interesse ?? []);
    setCompetencias(curriculo?.competencias ?? []);
    setDisponibilidade(curriculo?.disponibilidade ?? "");
    setNotas(curriculo?.notas ?? "");
    setCartaConducao(curriculo?.carta_conducao ?? false);
    setCartaCategorias(curriculo?.carta_conducao_categorias ?? []);
    setLinguas(Array.isArray(curriculo?.linguas) ? (curriculo!.linguas as Lingua[]) : []);
  }, [curriculo?.id, curriculo?.pessoa_id]);

  const ensureRow = async (): Promise<Curriculo> => {
    if (curriculo) return curriculo;
    const { data, error } = await (supabase.from("curriculos") as any)
      .insert({ pessoa_id: pessoaId })
      .select("*")
      .single();
    if (error) throw error;
    return data as Curriculo;
  };

  const uploadFile = useMutation({
    mutationFn: async (args: { file: File; field: "cv" | "carta" }) => {
      if (!isAllowed(args.file)) throw new Error("Apenas PDF ou DOCX.");
      if (args.file.size > 10 * 1024 * 1024) throw new Error("Máx. 10 MB.");
      const row = await ensureRow();
      const safe = args.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${pessoaId}/${args.field}-${crypto.randomUUID()}-${safe}`;
      const up = await supabase.storage.from("curriculos").upload(path, args.file, {
        upsert: false,
        contentType: args.file.type || "application/octet-stream",
      });
      if (up.error) throw up.error;
      const patch =
        args.field === "cv"
          ? { cv_url: path, cv_nome_ficheiro: args.file.name }
          : { carta_motivacao_url: path, carta_motivacao_nome_ficheiro: args.file.name };
      const { error } = await (supabase.from("curriculos") as any)
        .update(patch)
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Ficheiro carregado");
      await qc.invalidateQueries({ queryKey: ["curriculo", pessoaId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao carregar"),
  });

  const removeFile = useMutation({
    mutationFn: async (field: "cv" | "carta") => {
      if (!curriculo) return;
      const path = field === "cv" ? curriculo.cv_url : curriculo.carta_motivacao_url;
      if (path) await supabase.storage.from("curriculos").remove([path]);
      const patch =
        field === "cv"
          ? { cv_url: null, cv_nome_ficheiro: null }
          : { carta_motivacao_url: null, carta_motivacao_nome_ficheiro: null };
      const { error } = await (supabase.from("curriculos") as any)
        .update(patch)
        .eq("id", curriculo.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Ficheiro removido");
      await qc.invalidateQueries({ queryKey: ["curriculo", pessoaId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const saveMeta = useMutation({
    mutationFn: async () => {
      const row = await ensureRow();
      const { error } = await (supabase.from("curriculos") as any)
        .update({
          areas_interesse: areasSel,
          competencias,
          disponibilidade: disponibilidade.trim() || null,
          notas: notas.trim() || null,
          carta_conducao: cartaConducao,
          carta_conducao_categorias: cartaConducao ? cartaCategorias : [],
          linguas,
        })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Currículo guardado");
      await qc.invalidateQueries({ queryKey: ["curriculo", pessoaId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const deleteCurriculo = useMutation({
    mutationFn: async () => {
      if (!curriculo) return;
      const paths = [curriculo.cv_url, curriculo.carta_motivacao_url].filter(Boolean) as string[];
      if (paths.length > 0) {
        const { error: storageError } = await supabase.storage.from("curriculos").remove(paths);
        if (storageError) throw storageError;
      }
      const { error } = await (supabase.from("curriculos") as any).delete().eq("id", curriculo.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Currículo apagado");
      await qc.invalidateQueries({ queryKey: ["curriculo", pessoaId] });
      await qc.invalidateQueries({ queryKey: ["admin-curriculos"] });
      onDeleted?.();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao apagar currículo"),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const grouped = (areas ?? []).reduce<Record<string, Area[]>>((acc, a) => {
    const k = a.categoria || "Outros";
    (acc[k] ||= []).push(a);
    return acc;
  }, {});

  const toggleArea = (nome: string) =>
    setAreasSel((prev) => (prev.includes(nome) ? prev.filter((n) => n !== nome) : [...prev, nome]));

  const addCompetencia = () => {
    const v = novaCompetencia.trim();
    if (!v) return;
    if (!competencias.includes(v)) setCompetencias([...competencias, v]);
    setNovaCompetencia("");
  };

  const addLingua = () => {
    const v = novaLingua.trim();
    if (!v) return;
    if (linguas.some((l) => l.lingua.toLowerCase() === v.toLowerCase())) {
      setLinguas(linguas.map((l) => (l.lingua.toLowerCase() === v.toLowerCase() ? { ...l, nivel: novoNivel } : l)));
    } else {
      setLinguas([...linguas, { lingua: v, nivel: novoNivel }]);
    }
    setNovaLingua("");
  };

  const toggleCategoria = (c: string) =>
    setCartaCategorias((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FileBox
          title="CV (PDF ou DOCX)"
          path={curriculo?.cv_url ?? null}
          fileName={curriculo?.cv_nome_ficheiro ?? null}
          uploading={uploadFile.isPending}
          onPick={(f) => uploadFile.mutate({ file: f, field: "cv" })}
          onRemove={() => removeFile.mutate("cv")}
        />
        <FileBox
          title="Carta de motivação (PDF ou DOCX)"
          path={curriculo?.carta_motivacao_url ?? null}
          fileName={curriculo?.carta_motivacao_nome_ficheiro ?? null}
          uploading={uploadFile.isPending}
          onPick={(f) => uploadFile.mutate({ file: f, field: "carta" })}
          onRemove={() => removeFile.mutate("carta")}
        />
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Áreas de interesse</h3>
          <p className="text-xs text-muted-foreground">Seleciona as áreas em que procuras oportunidades.</p>
        </div>
        <div className="space-y-3">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <div className="text-xs font-medium text-muted-foreground mb-1.5">{cat}</div>
              <div className="flex flex-wrap gap-1.5">
                {items.map((a) => {
                  const on = areasSel.includes(a.nome);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleArea(a.nome)}
                      className={
                        "text-xs rounded-full border px-2.5 py-1 transition " +
                        (on
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-accent")
                      }
                    >
                      {a.nome}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="text-sm font-semibold">Competências</h3>
        <div className="flex gap-2">
          <Input
            value={novaCompetencia}
            onChange={(e) => setNovaCompetencia(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCompetencia(); } }}
            placeholder="Ex.: Inglês fluente, Excel avançado…"
          />
          <Button type="button" variant="outline" onClick={addCompetencia}>
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </div>
        {competencias.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {competencias.map((c) => (
              <Badge key={c} variant="secondary" className="gap-1">
                {c}
                <button
                  type="button"
                  className="hover:text-destructive"
                  onClick={() => setCompetencias(competencias.filter((x) => x !== c))}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Disponibilidade</Label>
          <Input
          <Input
            value={disponibilidade}
            onChange={(e) => setDisponibilidade(e.target.value)}
            placeholder="Ex.: Tempo inteiro, fins de semana…"
          />
        </div>
        <div className="md:col-span-2 space-y-1.5">
          <Label>Notas</Label>
          <Textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        {curriculo && (
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("Tens a certeza que queres apagar este currículo? Esta ação não pode ser desfeita.")) {
                deleteCurriculo.mutate();
              }
            }}
            disabled={deleteCurriculo.isPending}
          >
            <Trash2 className="h-4 w-4" /> {deleteCurriculo.isPending ? "A apagar…" : "Apagar currículo"}
          </Button>
        )}
        <Button onClick={() => saveMeta.mutate()} disabled={saveMeta.isPending}>
          <Save className="h-4 w-4" /> {saveMeta.isPending ? "A guardar…" : "Guardar"}
        </Button>
      </div>
    </div>
  );
}

function FileBox({
  title,
  path,
  fileName,
  uploading,
  onPick,
  onRemove,
}: {
  title: string;
  path: string | null;
  fileName: string | null;
  uploading: boolean;
  onPick: (f: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    if (!path) return;
    setDownloading(true);
    try {
      const { data, error } = await supabase.storage.from("curriculos").createSignedUrl(path, 60);
      if (error) throw error;
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao abrir");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {path ? (
        <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 p-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm truncate">{fileName ?? "ficheiro"}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button type="button" size="icon" variant="ghost" onClick={download} disabled={downloading}>
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            </Button>
            <Button type="button" size="icon" variant="ghost" onClick={onRemove}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-24 w-full items-center justify-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground hover:bg-accent"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "A carregar…" : "Carregar PDF/DOCX"}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
    </div>
  );
}