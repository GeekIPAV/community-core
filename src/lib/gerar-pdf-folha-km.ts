import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatEuro } from "@/lib/bolsa-transporte";
import logoUrl from "@/assets/meeru-logo.png";
import assinaturaFinanceiroUrl from "@/assets/assinatura-financeiro.jpg";
import assinaturaPresidenteUrl from "@/assets/assinatura-presidente.jpg";

export const ENTIDADE = {
  nome: "Associação para o Desenvolvimento MEERU | Abrir Caminho",
  morada: "Praça Francisco Sá Carneiro, n.º 271, Galerias Esq.",
  nif: "515346683",
};

export const DECLARACAO =
  "A descriminação no presente mapa, referentes a Ajudas de Custo e/ou compensação por uso de viatura própria (quilómetros percorridos), é da minha inteira responsabilidade, tendo sido devidamente conferido antes de apresentado à Entidade Patronal, do qual com a minha assinatura o dou como devidamente quitado.";

export type DadosPessoaPdf = {
  nome: string;
  morada: string;
  nif: string;
  iban: string;
  matricula: string;
  email?: string;
};

export type LinhaPdf = {
  data: string;
  descricao: string;
  percurso: string;
  km: number;
  valor: number;
};

const fmtData = (d: string) => (d ? new Date(d).toLocaleDateString("pt-PT") : "");

export async function loadImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function gerarPdfFolhaKm(params: {
  dados: DadosPessoaPdf;
  linhas: LinhaPdf[];
  totalKm: number;
  totalValor: number;
  valorKm: number;
  assinatura?: string | null;
}): Promise<{ doc: jsPDF; base64: string; filename: string }> {
  const { dados, linhas, totalKm, totalValor, valorKm, assinatura } = params;
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
    body: [["Por KM", formatEuro(valorKm)]],
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
    body: linhas.map((l) => [
      fmtData(l.data),
      l.descricao,
      l.percurso,
      l.km.toLocaleString("pt-PT"),
      formatEuro(l.valor),
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
}
