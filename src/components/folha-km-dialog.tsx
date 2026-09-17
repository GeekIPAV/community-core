import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { enviarFolhaKm } from "@/lib/folha-km.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Send, Loader2, Download, Check, ChevronsUpDown, Save } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { KM_RATE, formatEuro } from "@/lib/bolsa-transporte";
import { SignaturePad } from "@/components/signature-pad";
import { DECLARACAO, gerarPdfFolhaKm } from "@/lib/gerar-pdf-folha-km";

type Linha = { id: string; data: string; descricao: string; percurso: string; km: string };

type Pessoa = { nome: string; morada: string; nif: string; iban: string; matricula: string; email: string };

type Perfil = Pessoa & { assinatura: string | null };

const novaLinha = (): Linha => ({
  id: Math.random().toString(36).slice(2),
  data: new Date().toISOString().slice(0, 10),
  descricao: "",
  percurso: "",
  km: "",
});

const num = (s: string) => {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export function FolhaKmDialog({
  open,
  onOpenChange,
  folhaId,
  familiaId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  folhaId?: string;
  familiaId?: string;
}) {
  const { pessoa, session } = useAuth();
  const qc = useQueryClient();
  const modoEdicao = !!folhaId;
  const [dados, setDados] = useState<Pessoa>({ nome: "", morada: "", nif: "", iban: "", matricula: "", email: "" });
  const [linhas, setLinhas] = useState<Linha[]>([novaLinha()]);
  const [prefilled, setPrefilled] = useState(false);
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [confirmarPerfil, setConfirmarPerfil] = useState(false);
  const [camposSelecionados, setCamposSelecionados] = useState<Record<string, boolean>>({});
  const [alvoId, setAlvoId] = useState<string | null>(null);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [periodo, setPeriodo] = useState<string | null>(null);
  const [rate, setRate] = useState(KM_RATE);

  const { data: pessoasLista = [] } = useQuery({
    enabled: open,
    queryKey: ["folha-km-pessoas", familiaId ?? "todas"],
    queryFn: async () => {
      let q = supabase
        .from("pessoas")
        .select("id, nome_completo, email")
        .is("deleted_at", null)
        .order("nome_completo")
        .limit(2000);
      if (familiaId) q = q.eq("familia_id", familiaId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const carregarPessoa = async (id: string) => {
    const { data: p } = await supabase
      .from("pessoas")
      .select("nome_completo, email, nif, morada, iban, matricula, assinatura")
      .eq("id", id)
      .maybeSingle();
    if (!p) return;
    const perfilDb: Perfil = {
      nome: p.nome_completo ?? "",
      morada: p.morada ?? "",
      nif: p.nif ?? "",
      iban: p.iban ?? "",
      matricula: p.matricula ?? "",
      email: p.email ?? "",
      assinatura: p.assinatura ?? null,
    };
    setAlvoId(id);
    setPerfil(perfilDb);
    setAssinatura(perfilDb.assinatura);
    setDados({
      nome: perfilDb.nome,
      morada: perfilDb.morada,
      nif: perfilDb.nif,
      iban: perfilDb.iban,
      matricula: perfilDb.matricula,
      email: perfilDb.email,
    });
  };


  // Pré-preenchimento: exclusivamente os dados do perfil da pessoa
  useEffect(() => {
    if (!open || prefilled) return;
    setPrefilled(true);
    (async () => {
      // Modo edição: carregar a folha existente
      if (folhaId) {
        const { data: f } = await supabase.from("folhas_km").select("*").eq("id", folhaId).maybeSingle();
        if (f) {
          setDados({
            nome: f.nome ?? "",
            morada: f.morada ?? "",
            nif: f.nif ?? "",
            iban: f.iban ?? "",
            matricula: f.matricula ?? "",
            email: f.email ?? "",
          });
          const guardadas = Array.isArray(f.linhas) ? (f.linhas as unknown as Array<Record<string, unknown>>) : [];
          setLinhas(
            guardadas.length
              ? guardadas.map((l) => ({
                  id: Math.random().toString(36).slice(2),
                  data: String(l.data ?? ""),
                  descricao: String(l.descricao ?? ""),
                  percurso: String(l.percurso ?? ""),
                  km: String(l.km ?? ""),
                }))
              : [novaLinha()]
          );
          setPeriodo(f.periodo ?? null);
          if (f.valor_km != null && Number(f.valor_km) > 0) setRate(Number(f.valor_km));
          if (f.pessoa_id) {
            setAlvoId(f.pessoa_id);
            const { data: p } = await supabase
              .from("pessoas")
              .select("nome_completo, email, nif, morada, iban, matricula, assinatura")
              .eq("id", f.pessoa_id)
              .maybeSingle();
            if (p) {
              setPerfil({
                nome: p.nome_completo ?? "",
                morada: p.morada ?? "",
                nif: p.nif ?? "",
                iban: p.iban ?? "",
                matricula: p.matricula ?? "",
                email: p.email ?? "",
                assinatura: p.assinatura ?? null,
              });
              if (p.assinatura) setAssinatura(p.assinatura);
            }
          } else if (familiaId) {
            const { data: membros } = await supabase
              .from("pessoas")
              .select("id")
              .eq("familia_id", familiaId)
              .is("deleted_at", null);
            if (membros && membros.length === 1) await carregarPessoa(membros[0].id);
          }
        }
        return;
      }

      const authEmail = session?.user?.email ?? "";
      let perfilDb: Perfil | null = null;
      if (pessoa?.id) {
        const { data: p } = await supabase
          .from("pessoas")
          .select("nome_completo, email, nif, morada, iban, matricula, assinatura")
          .eq("id", pessoa.id)
          .maybeSingle();
        if (p) {
          perfilDb = {
            nome: p.nome_completo ?? "",
            morada: p.morada ?? "",
            nif: p.nif ?? "",
            iban: p.iban ?? "",
            matricula: p.matricula ?? "",
            email: p.email ?? "",
            assinatura: p.assinatura ?? null,
          };
          setPerfil(perfilDb);
          if (p.assinatura) setAssinatura(p.assinatura);
        }
        setAlvoId(pessoa.id);
      }
      setDados({
        nome: perfilDb?.nome || pessoa?.nome_completo || "",
        morada: perfilDb?.morada || "",
        nif: perfilDb?.nif || "",
        iban: perfilDb?.iban || "",
        matricula: perfilDb?.matricula || "",
        email: perfilDb?.email || authEmail || "",
      });
    })();
  }, [open, prefilled, pessoa, session, folhaId, familiaId]);

  useEffect(() => {
    if (!open) {
      setPrefilled(false);
      setLinhas([novaLinha()]);
      setAssinatura(null);
      setPerfil(null);
      setConfirmarPerfil(false);
      setAlvoId(null);
      setPeriodo(null);
      setRate(KM_RATE);
    }
  }, [open]);

  const perfilTemAssinatura = !!perfil?.assinatura;

  // Campos em falta no perfil que estão preenchidos no formulário
  const camposEmFalta = useMemo(() => {
    if (!alvoId) return [] as Array<{ coluna: string; label: string; valor: string }>;
    const alvos: Array<{ coluna: keyof Perfil; label: string; valor: string }> = [
      { coluna: "morada", label: "Morada", valor: dados.morada },
      { coluna: "nif", label: "NIF", valor: dados.nif },
      { coluna: "iban", label: "IBAN", valor: dados.iban },
      { coluna: "matricula", label: "Matrícula", valor: dados.matricula },
    ];
    const lista = alvos
      .filter((a) => a.valor.trim() && !(perfil?.[a.coluna] as string | undefined)?.trim())
      .map((a) => ({ coluna: a.coluna as string, label: a.label, valor: a.valor.trim() }));
    if (!perfil?.assinatura && assinatura) {
      lista.push({ coluna: "assinatura", label: "Assinatura", valor: assinatura });
    }
    return lista;
  }, [dados, perfil, assinatura, alvoId]);

  const atualizarPerfil = async () => {
    if (!alvoId) return;
    const patch: Record<string, string> = {};
    for (const c of camposEmFalta) {
      if (camposSelecionados[c.coluna]) patch[c.coluna] = c.valor;
    }
    if (Object.keys(patch).length === 0) return;
    const { error } = await supabase.from("pessoas").update(patch as never).eq("id", alvoId);
    if (error) {
      toast.error("Não foi possível atualizar o perfil.");
      return;
    }
    setPerfil((p) => ({ ...(p ?? { nome: "", morada: "", nif: "", iban: "", matricula: "", email: "", assinatura: null }), ...patch } as Perfil));
    toast.success("Perfil atualizado com estes dados.");
  };

  const linhaCompleta = (l: Linha) =>
    !!l.data.trim() && !!l.descricao.trim() && !!l.percurso.trim() && num(l.km) > 0;
  const linhasValidas = useMemo(() => linhas.filter(linhaCompleta), [linhas]);
  const totalKm = useMemo(() => linhasValidas.reduce((s, l) => s + num(l.km), 0), [linhasValidas]);
  const totalValor = useMemo(() => Math.round(totalKm * rate * 100) / 100, [totalKm, rate]);

  const camposPessoaObrigatorios: Array<{ chave: keyof Pessoa; label: string }> = [
    { chave: "nome", label: "Nome" },
    { chave: "morada", label: "Morada" },
    { chave: "nif", label: "NIF" },
    { chave: "iban", label: "IBAN" },
    { chave: "matricula", label: "Matrícula" },
    { chave: "email", label: "Email" },
  ];
  const camposPessoaFaltam = useMemo(
    () => camposPessoaObrigatorios.filter((c) => !dados[c.chave].trim()).map((c) => c.label),
    [dados]
  );
  const formularioValido =
    camposPessoaFaltam.length === 0 && linhasValidas.length > 0 && !!assinatura;

  const gerarPdf = async (): Promise<{ doc: jsPDF; base64: string; filename: string }> =>
    gerarPdfFolhaKm({
      dados,
      linhas: linhasValidas.map((l) => ({
        data: l.data,
        descricao: l.descricao,
        percurso: l.percurso,
        km: num(l.km),
        valor: Math.round(num(l.km) * rate * 100) / 100,
      })),
      totalKm,
      totalValor,
      valorKm: rate,
      assinatura,
      periodo,
    });

  const payloadLinhas = () =>
    linhasValidas.map((l) => ({
      data: l.data,
      descricao: l.descricao,
      percurso: l.percurso,
      km: num(l.km),
      valor: Math.round(num(l.km) * rate * 100) / 100,
    }));

  const payloadFolha = () => ({
    pessoa_id: modoEdicao ? alvoId : (alvoId ?? pessoa?.id ?? null),
    nome: dados.nome,
    morada: dados.morada || null,
    nif: dados.nif || null,
    iban: dados.iban || null,
    matricula: dados.matricula || null,
    email: dados.email || null,
    valor_km: rate,
    linhas: payloadLinhas(),
    total_km: totalKm,
    total_valor: totalValor,
  });

  const guardar = useMutation({
    mutationFn: async () => {
      if (!folhaId) return;
      if (camposPessoaFaltam.length > 0)
        throw new Error(`Preencha todos os campos: ${camposPessoaFaltam.join(", ")}.`);
      if (linhasValidas.length === 0)
        throw new Error("Adicione pelo menos uma linha preenchida (data, descrição, percurso e KM).");
      const { error } = await supabase
        .from("folhas_km")
        .update({ ...payloadFolha(), updated_at: new Date().toISOString() })
        .eq("id", folhaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Folha de KM guardada.");
      qc.invalidateQueries({ queryKey: ["folhas-km"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submeter = useMutation({
    mutationFn: async () => {
      if (camposPessoaFaltam.length > 0)
        throw new Error(`Preencha todos os campos: ${camposPessoaFaltam.join(", ")}.`);
      if (linhasValidas.length === 0)
        throw new Error("Adicione pelo menos uma linha preenchida (data, descrição, percurso e KM).");
      if (!assinatura) throw new Error("A folha tem de estar assinada antes de poder ser enviada.");

      let id = folhaId;
      if (folhaId) {
        const { error } = await supabase
          .from("folhas_km")
          .update({ ...payloadFolha(), updated_at: new Date().toISOString() })
          .eq("id", folhaId);
        if (error) throw error;
      } else {
        const { data: folha, error } = await supabase
          .from("folhas_km")
          .insert({ ...payloadFolha(), auth_user_id: session?.user?.id ?? null })
          .select("id")
          .single();
        if (error) throw error;
        id = folha.id;
      }

      const { doc, base64, filename } = await gerarPdf();
      doc.save(filename);

      await enviarFolhaKm({
        data: {
          folhaId: id!,
          nome: dados.nome,
          emailPessoa: dados.email || session?.user?.email || null,
          periodo,
          totalKm,
          totalValor,
          ficheiroNome: filename,
          ficheiroBase64: base64,
        },
      });
    },
    onSuccess: () => {
      toast.success("Folha de KM gerada e enviada para finance@meeru.org e para o seu email.");
      qc.invalidateQueries({ queryKey: ["folhas-km"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Folha de KM</DialogTitle>
          <DialogDescription>
            Mapa de Ajudas de Custo e compensação por uso de viatura própria. O valor é calculado automaticamente
            (valor por km × total de km).
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">Identificação da Pessoa</p>
            <Popover open={seletorAberto} onOpenChange={setSeletorAberto}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="justify-between gap-2">
                  {alvoId && alvoId !== pessoa?.id ? dados.nome || "Outra pessoa" : "Selecionar outra pessoa"}
                  <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <Command>
                  <CommandInput placeholder="Procurar pessoa…" />
                  <CommandList>
                    <CommandEmpty>Sem resultados.</CommandEmpty>
                    <CommandGroup>
                      {pessoasLista.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={`${p.nome_completo ?? ""} ${p.email ?? ""}`}
                          onSelect={async () => {
                            setSeletorAberto(false);
                            await carregarPessoa(p.id);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", alvoId === p.id ? "opacity-100" : "opacity-0")} />
                          <span className="truncate">
                            {p.nome_completo}
                            {p.email ? <span className="text-muted-foreground"> · {p.email}</span> : null}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Nome *</Label>
              <Input value={dados.nome} onChange={(e) => setDados({ ...dados, nome: e.target.value })} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Morada *</Label>
              <Input value={dados.morada} onChange={(e) => setDados({ ...dados, morada: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">NIF *</Label>
              <Input value={dados.nif} onChange={(e) => setDados({ ...dados, nif: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">IBAN *</Label>
              <Input value={dados.iban} onChange={(e) => setDados({ ...dados, iban: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Matrícula *</Label>
              <Input
                value={dados.matricula}
                onChange={(e) => setDados({ ...dados, matricula: e.target.value.toUpperCase() })}
                placeholder="AA-00-AA"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email *</Label>
              <Input value={dados.email} onChange={(e) => setDados({ ...dados, email: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="rounded-md border bg-muted/40 p-3">
          <p className="text-sm font-semibold">Valores totais</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">{formatEuro(totalValor)}</p>
          <p className="text-xs text-muted-foreground">{totalKm.toLocaleString("pt-PT")} km no total</p>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">Data</TableHead>
                <TableHead>Descrição da deslocação</TableHead>
                <TableHead>Percurso</TableHead>
                <TableHead className="w-24">Total KM</TableHead>
                <TableHead className="w-28 text-right">Valor</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l, i) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <Input
                      type="date"
                      className="h-8"
                      value={l.data}
                      onChange={(e) =>
                        setLinhas(linhas.map((x, j) => (j === i ? { ...x, data: e.target.value } : x)))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8"
                      value={l.descricao}
                      placeholder="Motivo da deslocação"
                      onChange={(e) =>
                        setLinhas(linhas.map((x, j) => (j === i ? { ...x, descricao: e.target.value } : x)))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8"
                      value={l.percurso}
                      placeholder="Ex: Lisboa - Porto - Santarém"
                      onChange={(e) =>
                        setLinhas(linhas.map((x, j) => (j === i ? { ...x, percurso: e.target.value } : x)))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8 text-right"
                      inputMode="decimal"
                      value={l.km}
                      onChange={(e) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, km: e.target.value } : x)))}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatEuro(Math.round(num(l.km) * rate * 100) / 100)}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={linhas.length === 1}
                      onClick={() => setLinhas(linhas.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Button variant="outline" size="sm" className="w-fit" onClick={() => setLinhas([...linhas, novaLinha()])}>
          <Plus className="mr-2 h-4 w-4" /> Adicionar linha
        </Button>

        <p className="text-[11px] leading-relaxed text-muted-foreground">{DECLARACAO}</p>

        {perfilTemAssinatura ? (
          <div className="space-y-1">
            <Label className="text-xs">Assinatura</Label>
            <img src={assinatura ?? ""} alt="Assinatura" className="h-16 rounded border bg-white object-contain" />
            <p className="text-xs text-muted-foreground">
              Assinatura guardada no perfil{dados.nome ? ` de ${dados.nome}` : ""} — não é preciso assinar de novo.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label className="text-xs">Assinatura *</Label>
            <SignaturePad value={assinatura} onChange={setAssinatura} />
            {!assinatura && (
              <p className="text-xs text-destructive">A assinatura é obrigatória para gerar e enviar a folha.</p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            variant="outline"
            onClick={async () => {
              const { doc, filename } = await gerarPdf();
              doc.save(filename);
            }}
          >
            <Download className="mr-2 h-4 w-4" /> Pré-visualizar PDF
          </Button>
          {!formularioValido && (
            <p className="text-xs text-destructive">
              Preencha todos os campos, adicione pelo menos uma linha completa (data, descrição, percurso e KM) e
              assine a folha.
            </p>
          )}
          {modoEdicao && (
            <Button
              variant="secondary"
              onClick={() => guardar.mutate()}
              disabled={guardar.isPending || camposPessoaFaltam.length > 0 || linhasValidas.length === 0}
            >
              {guardar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Guardar alterações
            </Button>
          )}
          <Button
            onClick={() => {
              if (camposEmFalta.length > 0) {
                setCamposSelecionados(
                  Object.fromEntries(camposEmFalta.map((c) => [c.coluna, true]))
                );
                setConfirmarPerfil(true);
              } else submeter.mutate();
            }}
            disabled={submeter.isPending || !formularioValido}
          >
            {submeter.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {modoEdicao ? "Guardar e enviar" : "Gerar e enviar"}
          </Button>
        </DialogFooter>

        <Dialog open={confirmarPerfil} onOpenChange={setConfirmarPerfil}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Atualizar o seu perfil?</DialogTitle>
              <DialogDescription>
                Escolha quais destes dados, ainda não guardados no seu perfil, quer guardar para aparecerem
                automaticamente da próxima vez.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {camposEmFalta.map((c) => (
                <label
                  key={c.coluna}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
                >
                  <Checkbox
                    checked={!!camposSelecionados[c.coluna]}
                    onCheckedChange={(v) =>
                      setCamposSelecionados((s) => ({ ...s, [c.coluna]: v === true }))
                    }
                  />
                  <span>{c.label}</span>
                  <span className="ml-auto max-w-[45%] truncate text-xs text-muted-foreground">
                    {c.coluna === "assinatura" ? "Desenho" : c.valor}
                  </span>
                </label>
              ))}
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmarPerfil(false);
                  submeter.mutate();
                }}
              >
                Não, só enviar
              </Button>
              <Button
                disabled={camposEmFalta.every((c) => !camposSelecionados[c.coluna])}
                onClick={async () => {
                  setConfirmarPerfil(false);
                  await atualizarPerfil();
                  submeter.mutate();
                }}
              >
                Guardar selecionados e enviar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
