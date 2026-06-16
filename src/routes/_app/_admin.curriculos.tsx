import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Search, ExternalLink, Plus } from "lucide-react";
import { CurriculoSection } from "@/components/curriculo-section";

export const Route = createFileRoute("/_app/_admin/curriculos")({
  component: CurriculosAdminPage,
});

type Row = {
  id: string;
  pessoa_id: string;
  cv_url: string | null;
  carta_motivacao_url: string | null;
  areas_interesse: string[];
  competencias: string[];
  disponibilidade: string | null;
  updated_at: string;
  pessoa: {
    id: string;
    nome_completo: string;
    email: string | null;
    telefone: string | null;
    data_nascimento: string | null;
    profissao: string | null;
  } | null;
};

function CurriculosAdminPage() {
  const [q, setQ] = useState("");
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [openPessoa, setOpenPessoa] = useState<{ id: string; nome: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQ, setPickerQ] = useState("");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-curriculos"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("curriculos") as any)
        .select(
          "id, pessoa_id, cv_url, carta_motivacao_url, areas_interesse, competencias, disponibilidade, updated_at, pessoa:pessoas!curriculos_pessoa_id_fkey(id, nome_completo, email, telefone, data_nascimento, profissao)"
        )
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data as Row[]) ?? [];
    },
  });

  const { data: adultos } = useQuery({
    queryKey: ["pessoas-adultas"],
    enabled: pickerOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome_completo, email, data_nascimento")
        .eq("status", "ativo")
        .not("data_nascimento", "is", null)
        .order("nome_completo");
      if (error) throw error;
      const hoje = new Date();
      return (data ?? []).filter((p: any) => {
        if (!p.data_nascimento) return false;
        const d = new Date(p.data_nascimento);
        if (isNaN(d.getTime())) return false;
        let age = hoje.getFullYear() - d.getFullYear();
        const m = hoje.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) age--;
        return age >= 18;
      });
    },
  });

  const filteredAdultos = useMemo(() => {
    const term = pickerQ.trim().toLowerCase();
    const list = (adultos ?? []) as Array<{ id: string; nome_completo: string; email: string | null }>;
    if (!term) return list.slice(0, 50);
    return list
      .filter((p) =>
        (p.nome_completo ?? "").toLowerCase().includes(term) ||
        (p.email ?? "").toLowerCase().includes(term)
      )
      .slice(0, 50);
  }, [adultos, pickerQ]);

  const areasUnicas = useMemo(() => {
    const set = new Set<string>();
    (rows ?? []).forEach((r) => r.areas_interesse?.forEach((a) => set.add(a)));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (areaFilter && !r.areas_interesse?.includes(areaFilter)) return false;
      if (!term) return true;
      const fields = [r.pessoa?.nome_completo, r.pessoa?.email, r.pessoa?.profissao, ...(r.competencias ?? []), ...(r.areas_interesse ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return fields.includes(term);
    });
  }, [rows, q, areaFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Currículos</h1>
        <p className="text-sm text-muted-foreground">
          CVs e cartas de motivação dos adultos da comunidade, com áreas de interesse.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pesquisar por nome, email, profissão, competência ou área…"
            className="pl-8"
          />
        </div>
        <Button onClick={() => { setPickerQ(""); setPickerOpen(true); }}>
          <Plus className="h-4 w-4" /> Adicionar / atribuir CV
        </Button>
      </div>

      {areasUnicas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setAreaFilter(null)}
            className={
              "text-xs rounded-full border px-2.5 py-1 " +
              (areaFilter === null ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent")
            }
          >
            Todas as áreas
          </button>
          {areasUnicas.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAreaFilter(a)}
              className={
                "text-xs rounded-full border px-2.5 py-1 " +
                (areaFilter === a ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent")
              }
            >
              {a}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Nenhum currículo encontrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-lg border p-4 space-y-2.5 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{r.pessoa?.nome_completo ?? "—"}</h3>
                  {r.pessoa?.profissao && (
                    <p className="text-xs text-muted-foreground truncate">{r.pessoa.profissao}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  {r.cv_url && <Badge variant="outline" className="gap-1"><FileText className="h-3 w-3" />CV</Badge>}
                  {r.carta_motivacao_url && <Badge variant="outline" className="gap-1"><FileText className="h-3 w-3" />Carta</Badge>}
                </div>
              </div>
              {r.pessoa?.email && (
                <p className="text-xs text-muted-foreground truncate">{r.pessoa.email}</p>
              )}
              {r.areas_interesse?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {r.areas_interesse.slice(0, 4).map((a) => (
                    <Badge key={a} variant="secondary" className="text-[10px]">{a}</Badge>
                  ))}
                  {r.areas_interesse.length > 4 && (
                    <Badge variant="secondary" className="text-[10px]">+{r.areas_interesse.length - 4}</Badge>
                  )}
                </div>
              )}
              {r.disponibilidade && (
                <p className="text-xs"><span className="text-muted-foreground">Disponibilidade:</span> {r.disponibilidade}</p>
              )}
              <div className="pt-1 mt-auto">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => r.pessoa && setOpenPessoa({ id: r.pessoa.id, nome: r.pessoa.nome_completo })}
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!openPessoa} onOpenChange={(o) => !o && setOpenPessoa(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Currículo · {openPessoa?.nome}</DialogTitle>
          </DialogHeader>
          {openPessoa && <CurriculoSection pessoaId={openPessoa.id} onDeleted={() => setOpenPessoa(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Escolher membro (≥ 18 anos)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                value={pickerQ}
                onChange={(e) => setPickerQ(e.target.value)}
                placeholder="Pesquisar por nome ou email…"
                className="pl-8"
              />
            </div>
            <div className="max-h-[50vh] overflow-y-auto rounded-md border divide-y">
              {filteredAdultos.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">Sem resultados.</div>
              ) : (
                filteredAdultos.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPickerOpen(false);
                      setOpenPessoa({ id: p.id, nome: p.nome_completo });
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-accent transition"
                  >
                    <div className="text-sm font-medium">{p.nome_completo}</div>
                    {p.email && <div className="text-xs text-muted-foreground">{p.email}</div>}
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}