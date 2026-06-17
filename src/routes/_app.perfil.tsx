import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CurriculoSection } from "@/components/curriculo-section";
import { FamilyDetailDialog } from "@/components/family-detail";
import type { Familia } from "@/components/family-detail";
import {
  Mail, Phone, MapPin, Cake, Briefcase, Globe, HeartHandshake, Users, IdCard,
  ShieldCheck, Heart, Pencil, Save, X, Calendar,
} from "lucide-react";

export const Route = createFileRoute("/_app/perfil")({
  component: PerfilPage,
});

type PessoaFull = {
  id: string;
  nome_completo: string;
  email: string | null;
  telefone: string | null;
  nif: string | null;
  cartao_cidadao: string | null;
  morada: string | null;
  data_nascimento: string | null;
  genero: string | null;
  nacionalidade: string | null;
  cidade_residencia: string | null;
  religiao: string | null;
  profissao: string | null;
  notas: string | null;
  familia_id: string | null;
  status: string;
  is_admin: boolean;
  is_voluntario: boolean;
  tipo_user_id: string | null;
};

function calcIdade(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const t = new Date();
  let age = t.getFullYear() - d.getFullYear();
  const m = t.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < d.getDate())) age--;
  return age;
}

function fmtData(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" });
}

function initials(nome: string) {
  const parts = nome.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase() || "?";
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-medium break-words">{value || "—"}</div>
      </div>
    </div>
  );
}

function PerfilPage() {
  const { pessoa: ctxPessoa, session, isAdmin, refresh } = useAuth();
  const qc = useQueryClient();

  const { data: pessoa, isLoading } = useQuery({
    enabled: !!ctxPessoa?.id,
    queryKey: ["meu-perfil", ctxPessoa?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome_completo, email, telefone, nif, cartao_cidadao, morada, data_nascimento, genero, nacionalidade, cidade_residencia, religiao, profissao, notas, familia_id, status, is_admin, is_voluntario, tipo_user_id")
        .eq("id", ctxPessoa!.id)
        .maybeSingle();
      if (error) throw error;
      return data as PessoaFull | null;
    },
  });

  const { data: tipoNome } = useQuery({
    enabled: !!pessoa?.tipo_user_id,
    queryKey: ["meu-perfil-tipo-nome", pessoa?.tipo_user_id],
    queryFn: async () => {
      const { data } = await supabase.from("tipos_user").select("nome").eq("id", pessoa!.tipo_user_id!).maybeSingle();
      return (data?.nome as string) ?? null;
    },
  });
  const isEquipa = isAdmin || (tipoNome ?? "").toLowerCase() === "equipa";

  if (!ctxPessoa) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">O Meu Perfil</h1>
          <p className="text-sm text-muted-foreground">Os teus dados na comunidade Meeru.</p>
        </div>
        <div className="rounded-lg border p-6 text-sm text-muted-foreground">
          Ainda não estás associado a um perfil. Contacta a equipa MEERU para vinculares a tua conta ({session?.user?.email}).
        </div>
      </div>
    );
  }

  if (isLoading || !pessoa) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">O Meu Perfil</h1>
        <p className="text-sm text-muted-foreground">Consulta e atualiza os teus dados, vê o agregado familiar e o histórico de participações.</p>
      </div>

      <PerfilHeader pessoa={pessoa} isAdmin={isAdmin} />

      {isEquipa && <FamiliasAcompanhoSection pessoaId={pessoa.id} />}

      <Tabs defaultValue="dados" className="w-full">
        <TabsList>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="familia">Agregado familiar</TabsTrigger>
          <TabsTrigger value="atividades">Ações e Atividades</TabsTrigger>
          {(calcIdade(pessoa.data_nascimento) ?? 0) >= 18 && (
            <TabsTrigger value="curriculo">Currículo</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="dados" className="mt-4">
          <DadosSection pessoa={pessoa} onSaved={async () => {
            await qc.invalidateQueries({ queryKey: ["meu-perfil", pessoa.id] });
            await refresh();
          }} />
        </TabsContent>

        <TabsContent value="familia" className="mt-4">
          <FamiliaSection pessoa={pessoa} />
        </TabsContent>

        <TabsContent value="atividades" className="mt-4">
          <AtividadesSection pessoaId={pessoa.id} />
        </TabsContent>
        {(calcIdade(pessoa.data_nascimento) ?? 0) >= 18 && (
          <TabsContent value="curriculo" className="mt-4">
            <CurriculoSection pessoaId={pessoa.id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function PerfilHeader({ pessoa, isAdmin }: { pessoa: PessoaFull; isAdmin: boolean }) {
  const { data: tipoUser } = useQuery({
    enabled: !!pessoa.tipo_user_id,
    queryKey: ["meu-perfil-tipo", pessoa.tipo_user_id],
    queryFn: async () => {
      const { data } = await supabase.from("tipos_user").select("nome").eq("id", pessoa.tipo_user_id!).maybeSingle();
      return (data?.nome as string) ?? null;
    },
  });
  const { data: familia } = useQuery({
    enabled: !!pessoa.familia_id,
    queryKey: ["meu-perfil-familia-nome", pessoa.familia_id],
    queryFn: async () => {
      const { data } = await supabase.from("familias").select("nome").eq("id", pessoa.familia_id!).maybeSingle();
      return (data?.nome as string) ?? null;
    },
  });
  const idade = calcIdade(pessoa.data_nascimento);
  return (
    <div className="rounded-lg border bg-gradient-to-br from-muted/50 to-background p-5">
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-semibold shrink-0">
          {initials(pessoa.nome_completo)}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold leading-tight">{pessoa.nome_completo}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {idade !== null && <span>{idade} anos</span>}
            {pessoa.genero && <><span>·</span><span>{pessoa.genero}</span></>}
            {tipoUser && <><span>·</span><span>{tipoUser}</span></>}
            {pessoa.profissao && <><span>·</span><span>{pessoa.profissao}</span></>}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant={pessoa.status === "ativo" ? "default" : "secondary"}>{pessoa.status}</Badge>
            {pessoa.is_voluntario && <Badge className="bg-rose-500/15 text-rose-700 hover:bg-rose-500/20"><Heart className="h-3 w-3 mr-1" />Voluntário</Badge>}
            {isAdmin && <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/20"><ShieldCheck className="h-3 w-3 mr-1" />Admin</Badge>}
            {familia && <Badge variant="outline"><Users className="h-3 w-3 mr-1" />{familia}</Badge>}
          </div>
        </div>
      </div>
    </div>
  );
}

const EDITABLE_FIELDS = [
  "nome_completo", "email", "telefone", "nif", "cartao_cidadao", "morada",
  "data_nascimento", "genero", "nacionalidade", "cidade_residencia", "religiao", "profissao", "notas",
] as const;
type EditableKey = (typeof EDITABLE_FIELDS)[number];

function DadosSection({ pessoa, onSaved }: { pessoa: PessoaFull; onSaved: () => void | Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<PessoaFull>(pessoa);
  useEffect(() => { setForm(pessoa); }, [pessoa]);

  const save = useMutation({
    mutationFn: async () => {
      const patch: Record<string, any> = {};
      for (const k of EDITABLE_FIELDS) {
        const v = (form as any)[k];
        patch[k] = typeof v === "string" ? (v.trim() === "" ? null : v) : v;
      }
      if (!patch.nome_completo) throw new Error("Nome obrigatório");
      const { error } = await supabase.from("pessoas").update(patch as any).eq("id", pessoa.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Perfil atualizado");
      setEditing(false);
      await onSaved();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao guardar"),
  });

  const idade = calcIdade(pessoa.data_nascimento);

  if (!editing) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Editar</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border p-4 space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contactos</h3>
            <InfoRow icon={Mail} label="Email" value={pessoa.email} />
            <InfoRow icon={Phone} label="Telefone" value={pessoa.telefone} />
            <InfoRow icon={MapPin} label="Morada" value={pessoa.morada} />
            <InfoRow icon={MapPin} label="Cidade" value={pessoa.cidade_residencia} />
          </div>
          <div className="rounded-lg border p-4 space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dados pessoais</h3>
            <InfoRow icon={Cake} label="Data de nascimento" value={`${fmtData(pessoa.data_nascimento)}${idade !== null ? ` · ${idade} anos` : ""}`} />
            <InfoRow icon={Globe} label="Nacionalidade" value={pessoa.nacionalidade} />
            <InfoRow icon={HeartHandshake} label="Religião" value={pessoa.religiao} />
            <InfoRow icon={Briefcase} label="Profissão" value={pessoa.profissao} />
          </div>
          <div className="rounded-lg border p-4 space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Identificação</h3>
            <InfoRow icon={IdCard} label="NIF" value={pessoa.nif} />
            <InfoRow icon={IdCard} label="Cartão de Cidadão" value={pessoa.cartao_cidadao} />
          </div>
          {pessoa.notas && (
            <div className="rounded-lg border p-4 space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Notas</h3>
              <p className="text-sm whitespace-pre-wrap">{pessoa.notas}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const field = (k: EditableKey) => (form as any)[k] ?? "";
  const set = (k: EditableKey, v: any) => setForm({ ...form, [k]: v } as PessoaFull);

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => { setForm(pessoa); setEditing(false); }}><X className="h-4 w-4" /> Cancelar</Button>
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="h-4 w-4" /> {save.isPending ? "A guardar…" : "Guardar"}
        </Button>
      </div>
      <div className="rounded-lg border p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2 space-y-1">
          <Label>Nome completo *</Label>
          <Input value={field("nome_completo")} onChange={(e) => set("nome_completo", e.target.value)} />
        </div>
        <div className="space-y-1"><Label>Email</Label><Input type="email" value={field("email")} onChange={(e) => set("email", e.target.value)} /></div>
        <div className="space-y-1"><Label>Telefone</Label><Input value={field("telefone")} onChange={(e) => set("telefone", e.target.value)} /></div>
        <div className="space-y-1"><Label>NIF</Label><Input value={field("nif")} onChange={(e) => set("nif", e.target.value)} /></div>
        <div className="space-y-1"><Label>Cartão de Cidadão</Label><Input value={field("cartao_cidadao")} onChange={(e) => set("cartao_cidadao", e.target.value)} /></div>
        <div className="md:col-span-2 space-y-1"><Label>Morada</Label><Input value={field("morada")} onChange={(e) => set("morada", e.target.value)} /></div>
        <div className="space-y-1"><Label>Data de nascimento</Label><Input type="date" value={field("data_nascimento")} onChange={(e) => set("data_nascimento", e.target.value)} /></div>
        <div className="space-y-1">
          <Label>Género</Label>
          <Select value={form.genero ?? "__null"} onValueChange={(v) => set("genero", v === "__null" ? null : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__null">— não definido —</SelectItem>
              <SelectItem value="Masculino">Masculino</SelectItem>
              <SelectItem value="Feminino">Feminino</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>Nacionalidade</Label><Input value={field("nacionalidade")} onChange={(e) => set("nacionalidade", e.target.value)} /></div>
        <div className="space-y-1"><Label>Cidade de residência</Label><Input value={field("cidade_residencia")} onChange={(e) => set("cidade_residencia", e.target.value)} /></div>
        <div className="space-y-1"><Label>Religião</Label><Input value={field("religiao")} onChange={(e) => set("religiao", e.target.value)} /></div>
        <div className="space-y-1"><Label>Profissão</Label><Input value={field("profissao")} onChange={(e) => set("profissao", e.target.value)} /></div>
        <div className="md:col-span-2 space-y-1"><Label>Notas</Label><Textarea rows={3} value={field("notas")} onChange={(e) => set("notas", e.target.value)} /></div>
      </div>
    </div>
  );
}

function FamiliaSection({ pessoa }: { pessoa: PessoaFull }) {
  const [openMemberId, setOpenMemberId] = useState<string | null>(null);
  const { data: familia } = useQuery({
    enabled: !!pessoa.familia_id,
    queryKey: ["meu-perfil-familia", pessoa.familia_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("familias")
        .select("id, nome, status, notas")
        .eq("id", pessoa.familia_id!)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; nome: string; status: string; notas: string | null } | null;
    },
  });

  const { data: membros, isLoading } = useQuery({
    enabled: !!pessoa.familia_id,
    queryKey: ["meu-perfil-membros", pessoa.familia_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome_completo, data_nascimento, genero, telefone, email, profissao, is_voluntario")
        .eq("familia_id", pessoa.familia_id!)
        .eq("status", "ativo");
      if (error) throw error;
      return data as Array<{
        id: string; nome_completo: string; data_nascimento: string | null; genero: string | null;
        telefone: string | null; email: string | null; profissao: string | null; is_voluntario: boolean;
      }>;
    },
  });

  if (!pessoa.familia_id) {
    return (
      <div className="rounded-lg border p-6 text-sm text-muted-foreground">
        Ainda não estás associado a uma família.
      </div>
    );
  }

  const outros = (membros ?? []).filter((m) => m.id !== pessoa.id);
  const voluntarios = (membros ?? []).filter((m) => m.is_voluntario);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> {familia?.nome ?? "Agregado familiar"}</h3>
            {familia?.notas && <p className="text-sm text-muted-foreground mt-1">{familia.notas}</p>}
          </div>
          <div className="flex items-center gap-2">
            {familia?.status && <Badge variant="outline">{familia.status}</Badge>}
            <Badge variant="outline">{(membros ?? []).length} membro{(membros ?? []).length === 1 ? "" : "s"}</Badge>
          </div>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : outros.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem outros membros registados.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {outros.map((m) => {
              const idadeM = calcIdade(m.data_nascimento);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setOpenMemberId(m.id)}
                  className="text-left rounded-md border p-3 bg-card hover:bg-muted/40 hover:border-primary/40 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                      {initials(m.nome_completo)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{m.nome_completo}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[idadeM !== null ? `${idadeM} anos` : null, m.genero].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                    {m.is_voluntario && <Heart className="h-3.5 w-3.5 text-rose-500 shrink-0" />}
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {m.profissao && <div className="flex items-center gap-1.5"><Briefcase className="h-3 w-3" />{m.profissao}</div>}
                    {m.telefone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{m.telefone}</div>}
                    {m.email && <div className="flex items-center gap-1.5 truncate"><Mail className="h-3 w-3 shrink-0" /><span className="truncate">{m.email}</span></div>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {voluntarios.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Heart className="h-3.5 w-3.5 text-rose-500" /> Voluntários no agregado ({voluntarios.length})
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {voluntarios.map((v) => (
                <Badge key={v.id} variant="outline" className="bg-rose-500/5 border-rose-500/30">{v.nome_completo}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      <MembroDialog memberId={openMemberId} onClose={() => setOpenMemberId(null)} />
    </div>
  );
}

function FamiliasAcompanhoSection({ pessoaId }: { pessoaId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["familias-acompanho", pessoaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("familias")
        .select("id, nome, status, notas")
        .eq("contacto_meeru_id", pessoaId)
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data as Array<{ id: string; nome: string; status: string; notas: string | null }>;
    },
  });

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Famílias que acompanho</h3>
          <p className="text-sm text-muted-foreground">Clica numa família para ver os detalhes e editar.</p>
        </div>
        <Badge variant="outline">{(data ?? []).length}</Badge>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : (data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Ainda não tens nenhuma família atribuída.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data!.map((f) => (
            <Link
              key={f.id}
              to="/familias"
              search={{ familia: f.id } as any}
              className="rounded-md border p-3 bg-card hover:bg-muted/40 hover:border-primary/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{f.nome}</span>
                <Badge variant="outline" className="shrink-0 text-xs">{f.status}</Badge>
              </div>
              {f.notas && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{f.notas}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function MembroDialog({ memberId, onClose }: { memberId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: membro, isLoading } = useQuery({
    enabled: !!memberId,
    queryKey: ["meu-perfil-membro-detalhe", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome_completo, email, telefone, nif, cartao_cidadao, morada, data_nascimento, genero, nacionalidade, cidade_residencia, religiao, profissao, notas, familia_id, status, is_admin, is_voluntario, tipo_user_id")
        .eq("id", memberId!)
        .maybeSingle();
      if (error) throw error;
      return data as PessoaFull | null;
    },
  });

  return (
    <Dialog open={!!memberId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{membro?.nome_completo ?? "Detalhes do membro"}</DialogTitle>
        </DialogHeader>
        {isLoading || !membro ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : (
          <DadosSection
            pessoa={membro}
            onSaved={async () => {
              await qc.invalidateQueries({ queryKey: ["meu-perfil-membro-detalhe", membro.id] });
              await qc.invalidateQueries({ queryKey: ["meu-perfil-membros"] });
            }}
          />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AtividadesSection({ pessoaId }: { pessoaId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["meu-perfil-inscricoes", pessoaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inscricoes")
        .select("id, status, created_at, acao:acoes(id, nome, tipo, data_inicio, data_fim, local, status)")
        .eq("pessoa_id", pessoaId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string; status: string; created_at: string;
        acao: { id: string; nome: string; tipo: string | null; data_inicio: string | null; data_fim: string | null; local: string | null; status: string | null } | null;
      }>;
    },
  });

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  const rows = data ?? [];

  const totais = {
    total: rows.length,
    presentes: rows.filter((r) => r.status === "presente").length,
    confirmadas: rows.filter((r) => r.status === "confirmada").length,
    pendentes: rows.filter((r) => r.status === "pendente").length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Inscrições" value={totais.total} />
        <StatCard label="Presenças" value={totais.presentes} />
        <StatCard label="Confirmadas" value={totais.confirmadas} />
        <StatCard label="Pendentes" value={totais.pendentes} />
      </div>

      <div className="rounded-lg border">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Histórico de participação</h3>
        </div>
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Ainda não participaste em nenhuma ação ou evento.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ação / Evento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.acao?.nome ?? "—"}</TableCell>
                  <TableCell>{r.acao?.tipo ? <Badge variant="outline">{r.acao.tipo}</Badge> : "—"}</TableCell>
                  <TableCell>{fmtData(r.acao?.data_inicio ?? null)}</TableCell>
                  <TableCell className="text-muted-foreground">{r.acao?.local ?? "—"}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "presente" ? "bg-emerald-500/15 text-emerald-700" :
    status === "confirmada" ? "bg-blue-500/15 text-blue-700" :
    status === "ausente" ? "bg-rose-500/15 text-rose-700" :
    status === "cancelada" ? "bg-muted text-muted-foreground" :
    "bg-amber-500/15 text-amber-700";
  return <Badge className={`${cls} hover:${cls}`}>{status}</Badge>;
}