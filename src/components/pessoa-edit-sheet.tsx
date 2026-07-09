import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type Pessoa = {
  id: string;
  nome_completo: string;
  email: string | null;
  telefone: string | null;
  nif: string | null;
  cartao_cidadao: string | null;
  morada: string | null;
  data_nascimento: string | null;
  familia_id: string | null;
  status: string;
  notas: string | null;
  tipo_user_id: string | null;
  genero: string | null;
  nacionalidade: string | null;
  cidade_residencia: string | null;
  religiao: string | null;
  profissao: string | null;
};

const STATUS_OPTS = ["ativo", "suspeito_duplicado", "fundido", "arquivado"];
const GENERO_OPTS = ["Masculino", "Feminino"];

export function PessoaEditSheet({
  pessoaId,
  open,
  onOpenChange,
}: {
  pessoaId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Pessoa | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["pessoa-edit-sheet", pessoaId],
    enabled: !!pessoaId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pessoas")
        .select("id, nome_completo, email, telefone, nif, cartao_cidadao, morada, data_nascimento, familia_id, status, notas, tipo_user_id, genero, nacionalidade, cidade_residencia, religiao, profissao")
        .eq("id", pessoaId!)
        .maybeSingle();
      if (error) throw error;
      return data as Pessoa | null;
    },
  });

  useEffect(() => {
    if (data) setForm({ ...data });
  }, [data]);

  const { data: familias } = useQuery({
    queryKey: ["familias-lookup-sheet"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("familias").select("id, nome").order("nome");
      if (error) throw error;
      return data as { id: string; nome: string }[];
    },
  });

  const { data: tipos } = useQuery({
    queryKey: ["tipos-user-lookup-sheet"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("tipos_user").select("id, nome").order("nome");
      if (error) throw error;
      return data as { id: string; nome: string }[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const { error } = await supabase
        .from("pessoas")
        .update({
          nome_completo: form.nome_completo,
          email: form.email || null,
          telefone: form.telefone || null,
          nif: form.nif || null,
          cartao_cidadao: form.cartao_cidadao || null,
          morada: form.morada || null,
          data_nascimento: form.data_nascimento || null,
          familia_id: form.familia_id || null,
          status: form.status as any,
          notas: form.notas || null,
          tipo_user_id: form.tipo_user_id || null,
          genero: form.genero || null,
          nacionalidade: form.nacionalidade || null,
          cidade_residencia: form.cidade_residencia || null,
          religiao: form.religiao || null,
          profissao: form.profissao || null,
        })
        .eq("id", form.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pessoa atualizada");
      qc.invalidateQueries({ queryKey: ["pessoa-edit-sheet", pessoaId] });
      qc.invalidateQueries({ queryKey: ["participantes"] });
      qc.invalidateQueries({ queryKey: ["inscricoes"] });
      qc.invalidateQueries({ queryKey: ["pessoas"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6">
          <SheetTitle>Editar pessoa</SheetTitle>
          <SheetDescription>Edição rápida do perfil.</SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1 px-6">
          {isLoading || !form ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 py-4">
              <Field label="Nome *" className="col-span-2">
                <Input value={form.nome_completo} onChange={(e) => setForm({ ...form, nome_completo: e.target.value })} />
              </Field>
              <Field label="Email">
                <Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field label="Telefone">
                <Input value={form.telefone ?? ""} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
              </Field>
              <Field label="NIF">
                <Input value={form.nif ?? ""} onChange={(e) => setForm({ ...form, nif: e.target.value })} />
              </Field>
              <Field label="Cartão de Cidadão">
                <Input value={form.cartao_cidadao ?? ""} onChange={(e) => setForm({ ...form, cartao_cidadao: e.target.value })} />
              </Field>
              <Field label="Morada" className="col-span-2">
                <Input value={form.morada ?? ""} onChange={(e) => setForm({ ...form, morada: e.target.value })} />
              </Field>
              <Field label="Data de nascimento">
                <Input type="date" value={form.data_nascimento ?? ""} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} />
              </Field>
              <Field label="Género">
                <Select value={form.genero ?? "__null"} onValueChange={(v) => setForm({ ...form, genero: v === "__null" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__null">— não definido —</SelectItem>
                    {GENERO_OPTS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Nacionalidade">
                <Input value={form.nacionalidade ?? ""} onChange={(e) => setForm({ ...form, nacionalidade: e.target.value })} />
              </Field>
              <Field label="Cidade de residência">
                <Input value={form.cidade_residencia ?? ""} onChange={(e) => setForm({ ...form, cidade_residencia: e.target.value })} />
              </Field>
              <Field label="Religião">
                <Input value={form.religiao ?? ""} onChange={(e) => setForm({ ...form, religiao: e.target.value })} />
              </Field>
              <Field label="Profissão">
                <Input value={form.profissao ?? ""} onChange={(e) => setForm({ ...form, profissao: e.target.value })} />
              </Field>
              <Field label="Família" className="col-span-2">
                <Select value={form.familia_id ?? "__null"} onValueChange={(v) => setForm({ ...form, familia_id: v === "__null" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__null">— sem família —</SelectItem>
                    {familias?.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tipo de utilizador" className="col-span-2">
                <Select value={form.tipo_user_id ?? "__null"} onValueChange={(v) => setForm({ ...form, tipo_user_id: v === "__null" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__null">— sem tipo —</SelectItem>
                    {tipos?.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Estado" className="col-span-2">
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Notas" className="col-span-2">
                <Textarea value={form.notas ?? ""} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
              </Field>
            </div>
          )}
        </ScrollArea>
        <SheetFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={!form?.nome_completo.trim() || save.isPending}>
            {save.isPending ? "A guardar…" : "Guardar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}