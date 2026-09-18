import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, X } from "lucide-react";
import { toast } from "sonner";

export type VoluntarioLookup = { id: string; nome_completo: string; papel: string };

/**
 * Pessoas que podem acompanhar: voluntários E membros da equipa.
 * Considera tipos cumulativos (pessoas.tipo_user_id + pessoa_tipos).
 */
export async function fetchVoluntarios(): Promise<VoluntarioLookup[]> {
  const { data: tipos, error: tErr } = await supabase.from("tipos_user").select("id, nome");
  if (tErr) throw tErr;

  const papelPorTipo = new Map<string, string>();
  for (const t of (tipos ?? []) as { id: string; nome: string | null }[]) {
    const n = (t.nome ?? "").trim().toLowerCase();
    if (n.startsWith("volunt")) papelPorTipo.set(t.id, "Voluntário/a");
    else if (n === "equipa") papelPorTipo.set(t.id, "Equipa");
  }
  if (papelPorTipo.size === 0) return [];
  const tipoIds = Array.from(papelPorTipo.keys());

  const [diretos, extra] = await Promise.all([
    supabase
      .from("pessoas")
      .select("id, nome_completo, tipo_user_id")
      .eq("status", "ativo")
      .is("deleted_at", null)
      .in("tipo_user_id", tipoIds),
    supabase.from("pessoa_tipos").select("pessoa_id, tipo_user_id").in("tipo_user_id", tipoIds),
  ]);
  if (diretos.error) throw diretos.error;
  if (extra.error) throw extra.error;

  const papeis = new Map<string, Set<string>>();
  const nomes = new Map<string, string>();
  const addPapel = (pessoaId: string, tipoId: string | null) => {
    const papel = tipoId ? papelPorTipo.get(tipoId) : undefined;
    if (!papel) return;
    const atual = papeis.get(pessoaId) ?? new Set<string>();
    atual.add(papel);
    papeis.set(pessoaId, atual);
  };

  for (const p of (diretos.data ?? []) as { id: string; nome_completo: string; tipo_user_id: string | null }[]) {
    nomes.set(p.id, p.nome_completo);
    addPapel(p.id, p.tipo_user_id);
  }

  const extras = (extra.data ?? []) as { pessoa_id: string; tipo_user_id: string }[];
  const emFalta = Array.from(new Set(extras.map((r) => r.pessoa_id))).filter((id) => !nomes.has(id));
  if (emFalta.length > 0) {
    const { data: outros, error: oErr } = await supabase
      .from("pessoas")
      .select("id, nome_completo")
      .eq("status", "ativo")
      .is("deleted_at", null)
      .in("id", emFalta);
    if (oErr) throw oErr;
    for (const p of (outros ?? []) as { id: string; nome_completo: string }[]) nomes.set(p.id, p.nome_completo);
  }
  for (const r of extras) if (nomes.has(r.pessoa_id)) addPapel(r.pessoa_id, r.tipo_user_id);

  return Array.from(nomes.entries())
    .filter(([id]) => (papeis.get(id)?.size ?? 0) > 0)
    .map(([id, nome_completo]) => ({
      id,
      nome_completo,
      papel: Array.from(papeis.get(id) ?? []).sort().join(" · "),
    }))
    .sort((a, b) => a.nome_completo.localeCompare(b.nome_completo, "pt"));
}

export function useVoluntariosLookup(enabled = true) {
  return useQuery({
    queryKey: ["voluntarios-lookup"],
    enabled,
    queryFn: fetchVoluntarios,
  });
}

type AtividadeCatalogo = { id: string; nome: string; categoria: string | null };
type FamiliaOpcao = { id: string; nome: string };

export function RegistarAtividadeDialog({
  open,
  onOpenChange,
  familiaIds,
  atividadeIdFixa,
  escolherFamilias = false,
  titulo = "Registar atividade",
  descricaoDialogo,
  onRegistado,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Famílias fixas (ex.: ficha da família ou da pessoa). */
  familiaIds?: string[];
  /** Atividade do catálogo já definida (ex.: a partir da página de Atividades). */
  atividadeIdFixa?: string;
  /** Mostra o seletor de múltiplas famílias. */
  escolherFamilias?: boolean;
  titulo?: string;
  descricaoDialogo?: string;
  onRegistado?: () => void;
}) {
  const qc = useQueryClient();
  const [atividadeId, setAtividadeId] = useState<string>(atividadeIdFixa ?? "");
  const [dataVal, setDataVal] = useState("");
  const [descricao, setDescricao] = useState("");
  const [voluntariosSel, setVoluntariosSel] = useState<string[]>([]);
  const [familiasSel, setFamiliasSel] = useState<FamiliaOpcao[]>([]);
  const [pesquisa, setPesquisa] = useState("");
  const [pesquisaVol, setPesquisaVol] = useState("");
  const [novaNome, setNovaNome] = useState("");
  const [novaCategoria, setNovaCategoria] = useState("");
  const [novaOpen, setNovaOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setAtividadeId(atividadeIdFixa ?? "");
      setDataVal("");
      setDescricao("");
      setVoluntariosSel([]);
      setFamiliasSel([]);
      setPesquisa("");
      setPesquisaVol("");
      setNovaOpen(false);
      setNovaNome("");
      setNovaCategoria("");
    }
  }, [open, atividadeIdFixa]);

  const { data: voluntarios } = useVoluntariosLookup(open);

  const { data: catalogo } = useQuery({
    queryKey: ["atividades-catalogo"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atividades_catalogo")
        .select("id, nome, categoria")
        .eq("ativo", true)
        .order("categoria")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as AtividadeCatalogo[];
    },
  });

  // Procura de famílias (por nome da família ou por nome de uma pessoa)
  const termo = pesquisa.trim();
  const { data: resultados } = useQuery({
    queryKey: ["registar-atividade-familias", termo],
    enabled: open && escolherFamilias && termo.length >= 2,
    queryFn: async () => {
      const [fam, pes] = await Promise.all([
        supabase.from("familias").select("id, nome").ilike("nome", `%${termo}%`).is("deleted_at", null).order("nome").limit(20),
        supabase
          .from("pessoas")
          .select("id, nome_completo, familia_id, familias!pessoas_familia_id_fkey(id, nome)")
          .ilike("nome_completo", `%${termo}%`)
          .not("familia_id", "is", null)
          .is("deleted_at", null)
          .order("nome_completo")
          .limit(20),
      ]);
      if (fam.error) throw fam.error;
      if (pes.error) throw pes.error;
      const mapa = new Map<string, { id: string; nome: string; via?: string }>();
      for (const f of (fam.data ?? []) as any[]) mapa.set(f.id, { id: f.id, nome: f.nome });
      for (const p of (pes.data ?? []) as any[]) {
        const f = p.familias;
        if (f && !mapa.has(f.id)) mapa.set(f.id, { id: f.id, nome: f.nome, via: p.nome_completo });
      }
      return Array.from(mapa.values());
    },
  });

  const alvos = useMemo(
    () => (escolherFamilias ? familiasSel.map((f) => f.id) : (familiaIds ?? [])),
    [escolherFamilias, familiasSel, familiaIds],
  );

  const criarAtividade = useMutation({
    mutationFn: async () => {
      const nome = novaNome.trim();
      if (!nome) throw new Error("Nome obrigatório");
      const { data, error } = await supabase
        .from("atividades_catalogo")
        .insert({ nome, categoria: novaCategoria.trim() || null })
        .select("id")
        .single();
      if (error) throw error;
      return (data as any).id as string;
    },
    onSuccess: (id) => {
      toast.success("Atividade criada");
      qc.invalidateQueries({ queryKey: ["atividades-catalogo"] });
      qc.invalidateQueries({ queryKey: ["atividades-catalogo-admin"] });
      setNovaOpen(false);
      setNovaNome("");
      setNovaCategoria("");
      setAtividadeId(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const registar = useMutation({
    mutationFn: async () => {
      if (!atividadeId) throw new Error("Escolha uma atividade");
      if (alvos.length === 0) throw new Error("Escolha pelo menos uma família");
      const { data: inseridos, error } = await supabase
        .from("familia_atividades")
        .insert(
          alvos.map((familia_id) => ({
            familia_id,
            atividade_id: atividadeId,
            data: dataVal || null,
            descricao: descricao.trim() || null,
          })),
        )
        .select("id");
      if (error) throw error;
      if (voluntariosSel.length > 0) {
        const linhas = ((inseridos ?? []) as any[]).flatMap((r) =>
          voluntariosSel.map((pid) => ({ familia_atividade_id: r.id as string, pessoa_id: pid })),
        );
        const { error: e2 } = await supabase.from("familia_atividade_voluntarios").insert(linhas);
        if (e2) throw e2;
      }
      return alvos.length;
    },
    onSuccess: (n) => {
      toast.success(n === 1 ? "Atividade registada" : `Atividade registada em ${n} famílias`);
      qc.invalidateQueries({ queryKey: ["familia-atividades"] });
      qc.invalidateQueries({ queryKey: ["familia-atividades-admin"] });
      qc.invalidateQueries({ queryKey: ["pessoa-atividades-voluntario"] });
      onRegistado?.();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const categorias = Array.from(new Set((catalogo ?? []).map((c) => c.categoria || "(Sem categoria)")));
  const volFiltrados = (voluntarios ?? []).filter((v) =>
    v.nome_completo.toLowerCase().includes(pesquisaVol.trim().toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {descricaoDialogo ?? "Escolha uma atividade do catálogo. Se não encontrar, pode criar uma nova."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {escolherFamilias && (
            <div className="space-y-2">
              <Label>Famílias</Label>
              {familiasSel.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {familiasSel.map((f) => (
                    <Badge key={f.id} variant="secondary" className="gap-1">
                      {f.nome}
                      <button type="button" onClick={() => setFamiliasSel((s) => s.filter((x) => x.id !== f.id))}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Procurar por família ou por pessoa…"
                  value={pesquisa}
                  onChange={(e) => setPesquisa(e.target.value)}
                />
              </div>
              {termo.length >= 2 && (
                <ScrollArea className="max-h-44 rounded-md border">
                  <div className="p-1">
                    {(resultados ?? []).length === 0 && (
                      <div className="px-2 py-3 text-sm text-muted-foreground">Sem resultados.</div>
                    )}
                    {(resultados ?? []).map((r) => {
                      const jaTem = familiasSel.some((f) => f.id === r.id);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          disabled={jaTem}
                          className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50"
                          onClick={() => setFamiliasSel((s) => [...s, { id: r.id, nome: r.nome }])}
                        >
                          <span className="font-medium">{r.nome}</span>
                          {r.via && <span className="text-xs text-muted-foreground">via {r.via}</span>}
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          {!atividadeIdFixa && (
            <div className="space-y-2">
              <Label>Atividade (por área)</Label>
              <div className="flex gap-2">
                <Select value={atividadeId} onValueChange={setAtividadeId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Escolher…" /></SelectTrigger>
                  <SelectContent className="max-h-[60vh]">
                    {categorias.map((cat) => (
                      <div key={cat} className="border-b py-1 last:border-b-0">
                        <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{cat}</div>
                        {(catalogo ?? [])
                          .filter((c) => (c.categoria || "(Sem categoria)") === cat)
                          .map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={() => setNovaOpen((v) => !v)}>Nova</Button>
              </div>
              {novaOpen && (
                <div className="space-y-2 rounded-md border p-3">
                  <Input placeholder="Nome da nova atividade" value={novaNome} onChange={(e) => setNovaNome(e.target.value)} />
                  <Input placeholder="Categoria (opcional)" value={novaCategoria} onChange={(e) => setNovaCategoria(e.target.value)} />
                  <Button size="sm" onClick={() => criarAtividade.mutate()} disabled={criarAtividade.isPending}>Criar atividade</Button>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={dataVal} onChange={(e) => setDataVal(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Notas sobre a atividade…" />
          </div>

          <div className="space-y-2">
            <Label>Voluntários e equipa que acompanharam</Label>
            <Input placeholder="Procurar voluntário ou equipa…" value={pesquisaVol} onChange={(e) => setPesquisaVol(e.target.value)} />
            <ScrollArea className="h-40 rounded-md border">
              <div className="space-y-1 p-2">
                {volFiltrados.length === 0 && <div className="px-1 py-2 text-sm text-muted-foreground">Sem voluntários.</div>}
                {volFiltrados.map((v) => (
                  <label key={v.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
                    <Checkbox
                      checked={voluntariosSel.includes(v.id)}
                      onCheckedChange={(c) =>
                        setVoluntariosSel((s) => (c ? [...s, v.id] : s.filter((x) => x !== v.id)))
                      }
                    />
                    <span>
                      {v.nome_completo}
                      {v.papel ? <span className="ml-1 text-xs text-muted-foreground">· {v.papel}</span> : null}
                    </span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => registar.mutate()} disabled={registar.isPending || alvos.length === 0 || !atividadeId}>
            {registar.isPending ? "A guardar…" : "Registar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
