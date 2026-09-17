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

// Paleta oficial MEERU
const YELLOW: [number, number, number] = [244, 189, 55];
const INK: [number, number, number] = [31, 41, 55];
const GRAY: [number, number, number] = [107, 114, 128];
const GRAY_LIGHT: [number, number, number] = [156, 163, 175];
const RULE: [number, number, number] = [229, 231, 235];
const TOTAL_BG: [number, number, number] = [245, 245, 244];

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
  periodo?: string | null;
}): Promise<{ doc: jsPDF; base64: string; filename: string }> {
  const { dados, linhas, totalKm, totalValor, valorKm, assinatura, periodo } = params;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 16; // margem

  // ---------- 1. Cabeçalho ----------
  const logo = await loadImageDataUrl(logoUrl);
  if (logo) {
    try {
      doc.addImage(logo, "PNG", W - M - 32, 14, 32, 20);
    } catch {
      /* ignora logo inválido */
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.setTextColor(...YELLOW);
  doc.text("Folha de KM", M, 24);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text("Mapa de Ajudas de Custo e compensação por uso de viatura própria", M, 31);
  const hoje = new Date().toLocaleDateString("pt-PT");
  doc.text(periodo ? `Período: ${periodo} · Emitida em ${hoje}` : `Emitida em ${hoje}`, M, 36);

  // ---------- 2. Entidade / Pessoa ----------
  const colDir = W / 2 + 4;
  let y = 50;

  const bloco = (x: number, rotulo: string, nome: string, detalhes: string[]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...YELLOW);
    doc.text(rotulo.toUpperCase(), x, y);
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    const largura = W / 2 - M - 6;
    const linhasNome = doc.splitTextToSize(nome, largura) as string[];
    doc.text(linhasNome, x, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    let yy = y + 6 + linhasNome.length * 5 + 0.5;
    for (const linha of detalhes) {
      if (!linha) continue;
      const partes = doc.splitTextToSize(linha, largura) as string[];
      doc.text(partes, x, yy);
      yy += partes.length * 4.2;
    }
    return yy;
  };

  const fimEsq = bloco(M, "Entidade", ENTIDADE.nome, [ENTIDADE.morada, `NIF ${ENTIDADE.nif}`]);
  const fimDir = bloco(colDir, "Pessoa", dados.nome || "—", [
    dados.morada,
    [dados.nif && `NIF ${dados.nif}`, dados.iban && `IBAN ${dados.iban}`].filter(Boolean).join(" · "),
    dados.matricula ? `Matrícula ${dados.matricula}` : "",
  ]);

  // ---------- 3. Linha separadora ----------
  y = Math.max(fimEsq, fimDir) + 4;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.1);
  doc.line(M, y, W - M, y);

  // ---------- 4. Tabela de deslocações ----------
  autoTable(doc, {
    startY: y + 8,
    margin: { left: M, right: M },
    theme: "plain",
    head: [["Data", "Descrição da deslocação", "Percurso", "KM", "Valor"]],
    headStyles: {
      fontSize: 7.5,
      fontStyle: "bold",
      textColor: GRAY,
      cellPadding: { top: 0, right: 2, bottom: 2.5, left: 0 },
    },
    styles: {
      fontSize: 9,
      textColor: INK,
      cellPadding: { top: 2.6, right: 2, bottom: 2.6, left: 0 },
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 60 },
      2: { cellWidth: "auto" },
      3: { cellWidth: 18, halign: "right" },
      4: { cellWidth: 24, halign: "right" },
    },
    body: linhas.map((l) => [
      fmtData(l.data),
      l.descricao,
      l.percurso,
      l.km.toLocaleString("pt-PT"),
      formatEuro(l.valor),
    ]),
    didParseCell: (d) => {
      if (d.section === "head") d.cell.text = d.cell.text.map((t) => t.toUpperCase());
    },
    didDrawCell: (d) => {
      if (d.column.index !== 0) return;
      const x1 = M;
      const x2 = W - M;
      const yb = d.cell.y + d.cell.height;
      if (d.section === "head") {
        doc.setDrawColor(...INK);
        doc.setLineWidth(0.3);
        doc.line(x1, yb, x2, yb);
      } else if (d.section === "body") {
        doc.setDrawColor(...RULE);
        doc.setLineWidth(0.1);
        doc.line(x1, yb, x2, yb);
      }
    },
  });

  let cursor = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // ---------- 5. Valor de referência ----------
  cursor += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  const refLabel = "Valor de referência por km: ";
  const refValor = formatEuro(valorKm);
  doc.setFont("helvetica", "bold");
  const wValor = doc.getTextWidth(refValor);
  doc.setFont("helvetica", "normal");
  const wLabel = doc.getTextWidth(refLabel);
  doc.text(refLabel, W - M - wValor - wLabel, cursor);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INK);
  doc.text(refValor, W - M - wValor, cursor);

  // ---------- 6. Barra de total ----------
  cursor += 5;
  const barH = 14;
  const kmTxt = `${totalKm.toLocaleString("pt-PT")} km no total`;
  const totalLabel = "Total a reembolsar";
  const totalTxt = formatEuro(totalValor);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const wKm = doc.getTextWidth(kmTxt);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  const wTotal = doc.getTextWidth(`${totalLabel}  ${totalTxt}`);
  const barW = Math.min(W - 2 * M, wKm + wTotal + 30);
  const barX = W - M - barW;
  doc.setFillColor(...TOTAL_BG);
  doc.roundedRect(barX, cursor, barW, barH, 2, 2, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(kmTxt, barX + 7, cursor + barH / 2 + 1.2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...YELLOW);
  doc.text(`${totalLabel}  ${totalTxt}`, W - M - 7, cursor + barH / 2 + 1.6, { align: "right" });
  cursor += barH;

  // ---------- 7. Declaração ----------
  cursor += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  const decl = doc.splitTextToSize(DECLARACAO, W - 2 * M) as string[];
  doc.text(decl, M, cursor);
  cursor += decl.length * 3.6;

  // ---------- 8. Assinaturas ----------
  const [assFin, assPres] = await Promise.all([
    loadImageDataUrl(assinaturaFinanceiroUrl),
    loadImageDataUrl(assinaturaPresidenteUrl),
  ]);

  const colW = (W - 2 * M - 16) / 3;
  const yLinha = Math.max(cursor + 30, H - 46);
  const colunas: Array<{ img: string | null; fmt: "PNG" | "JPEG"; nome: string; cargo: string }> = [
    { img: assinatura ?? null, fmt: "PNG", nome: dados.nome || "—", cargo: "Colaborador(a)" },
    { img: assFin, fmt: "JPEG", nome: "Henrique Maia", cargo: "Diretor Financeiro" },
    { img: assPres, fmt: "JPEG", nome: "Pedro Amaro Azevedo Santos", cargo: "Presidente da Direção" },
  ];

  colunas.forEach((c, i) => {
    const x = M + i * (colW + 8);
    if (c.img) {
      try {
        doc.addImage(c.img, c.fmt, x + 2, yLinha - 17, Math.min(colW - 4, 40), 15);
      } catch {
        /* ignora assinatura inválida */
      }
    }
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.2);
    doc.line(x, yLinha, x + colW, yLinha);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text(c.nome, x, yLinha + 5, { maxWidth: colW });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.text(c.cargo, x, yLinha + 9.5, { maxWidth: colW });
  });

  // ---------- 9. Rodapé ----------
  const yFoot = H - 16;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.1);
  doc.line(M, yFoot, W - M, yFoot);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GRAY_LIGHT);
  doc.text(`${ENTIDADE.nome} · NIPC: ${ENTIDADE.nif}`, W / 2, yFoot + 5, { align: "center" });

  const dataUri = doc.output("datauristring");
  const base64 = dataUri.split(",")[1] ?? "";
  const slug = dados.nome.toLowerCase().normalize("NFD").replace(/[^\w]+/g, "-").replace(/(^-|-$)/g, "");
  const filename = `folha-km-${slug || "meeru"}-${new Date().toISOString().slice(0, 10)}.pdf`;
  return { doc, base64, filename };
}
