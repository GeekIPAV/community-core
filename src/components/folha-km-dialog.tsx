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

export function FolhaKmDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { pessoa, session } = useAuth();
  const qc = useQueryClient();
  const [dados, setDados] = useState<Pessoa>({ nome: "", morada: "", nif: "", iban: "", matricula: "", email: "" });
  const [linhas, setLinhas] = useState<Linha[]>([novaLinha()]);
  const [prefilled, setPrefilled] = useState(false);
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [confirmarPerfil, setConfirmarPerfil] = useState(false);
  const [camposSelecionados, setCamposSelecionados] = useState<Record<string, boolean>>({});
  const [alvoId, setAlvoId] = useState<string | null>(null);
  const [seletorAberto, setSeletorAberto] = useState(false);

  const { data: pessoasLista = [] } = useQuery({
    enabled: open,
    queryKey: ["folha-km-pessoas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pessoas")
        .select("id, nome_completo, email")
        .is("deleted_at", null)
        .order("nome_completo")
        .limit(2000);
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
  }, [open, prefilled, pessoa, session]);

  useEffect(() => {
    if (!open) {
      setPrefilled(false);
      setLinhas([novaLinha()]);
      setAssinatura(null);
      setPerfil(null);
      setConfirmarPerfil(false);
      setAlvoId(null);
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

  const rate = KM_RATE;
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

  const gerarPdf = async (): Promise<{ doc: jsPDF; base64: string; filename: string }> => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const gold: [number, number, number] = [230, 168, 68];

    const logo = await loadImageDataUrl(logoUrl);
    if (logo) {
      try {
        doc.addImage(logo, "PNG", W - 48, 8, 36, 22);
      } catch {
        /* ignora logo inválido */
      }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Folha de KM", W / 2, 18, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("Mapa de Ajudas de Custo e compensação por uso de viatura própria", W / 2, 26, { align: "center" });

    autoTable(doc, {
      startY: 34,
      margin: { left: 12, right: W / 2 + 4 },
      theme: "grid",
      head: [[{ content: "Identificação da Entidade", colSpan: 2, styles: { halign: "center" } }]],
      headStyles: { fillColor: gold, textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 28 } },
      body: [
        ["Nome", ENTIDADE.nome],
        ["Morada", ENTIDADE.morada],
        ["NIF", ENTIDADE.nif],
      ],
    });

    autoTable(doc, {
      startY: 34,
      margin: { left: W / 2 + 4, right: 12 },
      theme: "grid",
      head: [[{ content: "Identificação da Pessoa", colSpan: 2, styles: { halign: "center" } }]],
      headStyles: { fillColor: gold, textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 28 } },
      body: [
        ["Nome", dados.nome],
        ["Morada", dados.morada],
        ["NIF", dados.nif],
        ["IBAN", dados.iban],
        ["Matrícula", dados.matricula],
      ],
    });

    const y1 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

    autoTable(doc, {
      startY: y1,
      margin: { left: 12, right: W / 2 + 4 },
      theme: "grid",
      head: [[{ content: "Valores de Referência", colSpan: 2, styles: { halign: "center" } }]],
      headStyles: { fillColor: gold, textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 28 } },
      body: [["Por KM", formatEuro(rate)]],
    });

    autoTable(doc, {
      startY: y1,
      margin: { left: W / 2 + 4, right: 12 },
      theme: "grid",
      head: [[{ content: "Valores totais", colSpan: 2, styles: { halign: "center" } }]],
      headStyles: { fillColor: gold, textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 40 } },
      body: [[`${totalKm.toLocaleString("pt-PT")} km`, formatEuro(totalValor)]],
    });

    const y2 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

    autoTable(doc, {
      startY: y2,
      margin: { left: 12, right: 12 },
      theme: "grid",
      head: [["Data", "Descrição da deslocação", "Percurso", "Total KM", "Valor (€)"]],
      headStyles: { fillColor: gold, textColor: 255, fontStyle: "bold", halign: "center" },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 26, halign: "center" },
        3: { cellWidth: 24, halign: "center" },
        4: { cellWidth: 28, halign: "right" },
      },
      body: linhasValidas.map((l) => [
        fmtData(l.data),
        l.descricao,
        l.percurso,
        num(l.km).toLocaleString("pt-PT"),
        formatEuro(Math.round(num(l.km) * rate * 100) / 100),
      ]),
      foot: [["", "", "Total", totalKm.toLocaleString("pt-PT"), formatEuro(totalValor)]],
      footStyles: { fillColor: [245, 245, 245], textColor: 20, fontStyle: "bold", halign: "right" },
    });

    const y3 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    doc.setFontSize(8);
    doc.text(doc.splitTextToSize(DECLARACAO, W - 24), 12, y3);

    doc.setFontSize(9);
    const ySig = Math.min(y3 + 30, doc.internal.pageSize.getHeight() - 20);
    doc.text("Assinatura:", 12, ySig);
    doc.text("Diretor Financeiro:", W / 2 - 30, ySig + 10);
    doc.text("Presidente da Direção:", W / 2 - 30, ySig + 20);

    const [assFin, assPres] = await Promise.all([
      loadImageDataUrl(assinaturaFinanceiroUrl),
      loadImageDataUrl(assinaturaPresidenteUrl),
    ]);
    const xAss = W / 2 + 2;
    if (assFin) {
      try {
        doc.addImage(assFin, "JPEG", xAss, ySig + 2, 46, 15);
      } catch {
        /* ignora assinatura inválida */
      }
    }
    if (assinatura) {
      try {
        doc.addImage(assinatura, "PNG", 30, ySig - 14, 46, 15);
      } catch {
        /* ignora assinatura inválida */
      }
    }
    if (assPres) {
      try {
        doc.addImage(assPres, "JPEG", xAss, ySig + 13, 46, 10);
      } catch {
        /* ignora assinatura inválida */
      }
    }

    const dataUri = doc.output("datauristring");
    const base64 = dataUri.split(",")[1] ?? "";
    const slug = dados.nome.toLowerCase().normalize("NFD").replace(/[^\w]+/g, "-").replace(/(^-|-$)/g, "");
    const filename = `folha-km-${slug || "meeru"}-${new Date().toISOString().slice(0, 10)}.pdf`;
    return { doc, base64, filename };
  };

  const submeter = useMutation({
    mutationFn: async () => {
      if (camposPessoaFaltam.length > 0)
        throw new Error(`Preencha todos os campos: ${camposPessoaFaltam.join(", ")}.`);
      if (linhasValidas.length === 0)
        throw new Error("Adicione pelo menos uma linha preenchida (data, descrição, percurso e KM).");
      if (!assinatura) throw new Error("A folha tem de estar assinada antes de poder ser enviada.");



      const { data: folha, error } = await supabase
        .from("folhas_km")
        .insert({
          pessoa_id: alvoId ?? pessoa?.id ?? null,
          auth_user_id: session?.user?.id ?? null,
          nome: dados.nome,
          morada: dados.morada || null,
          nif: dados.nif || null,
          iban: dados.iban || null,
          matricula: dados.matricula || null,
          email: dados.email || null,
          valor_km: rate,
          linhas: linhasValidas.map((l) => ({
            data: l.data,
            descricao: l.descricao,
            percurso: l.percurso,
            km: num(l.km),
            valor: Math.round(num(l.km) * rate * 100) / 100,
          })),
          total_km: totalKm,
          total_valor: totalValor,
        })
        .select("id")
        .single();
      if (error) throw error;

      const { doc, base64, filename } = await gerarPdf();
      doc.save(filename);

      await enviarFolhaKm({
        data: {
          folhaId: folha.id,
          nome: dados.nome,
          emailPessoa: dados.email || session?.user?.email || null,
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
            <p className="text-xs text-muted-foreground">Assinatura guardada no seu perfil.</p>
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
            Gerar e enviar
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
