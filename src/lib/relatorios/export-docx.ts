import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  PageBreak,
} from "docx";
import { saveAs } from "file-saver";
import type { Relatorio, Secao } from "./types";

function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

function paraText(text: string, opts?: { bold?: boolean; size?: number }) {
  return new Paragraph({
    children: [new TextRun({ text, bold: opts?.bold, size: opts?.size })],
    spacing: { after: 120 },
  });
}

function heading(text: string, level: typeof HeadingLevel[keyof typeof HeadingLevel]) {
  return new Paragraph({ heading: level, children: [new TextRun({ text, bold: true })] });
}

function tableSimple(headers: string[], rows: string[][]) {
  const headerRow = new TableRow({
    children: headers.map((h) =>
      new TableCell({
        shading: { fill: "EFEFEF", type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
      }),
    ),
  });
  const dataRows = rows.map((r) =>
    new TableRow({
      children: r.map((c) =>
        new TableCell({
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: c ?? "" })] })],
        }),
      ),
    }),
  );
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    rows: [headerRow, ...dataRows],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "EEEEEE" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "EEEEEE" },
    },
  });
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-PT");
}

type SnapshotKpi = { id: string; nome: string; unidade: string; meta: number; valor: number; narrativa?: string | null };
type SnapshotAtividade = { data: string; nome: string; local: string; participantes: number };
type SnapshotBreakdown = { nome: string; count: number; pct: number };
type SnapshotCaso = { area: string; abertos: number; concluidos: number; em_curso: number };

export type ExportSnapshot = {
  porSecao: Record<string, {
    kpis?: SnapshotKpi[];
    atividades?: { resumo: { acoes: number; participacoes: number; unicos: number }; lista: SnapshotAtividade[] };
    participantes?: { stats: { pessoas: number; familias: number; novas: number }; breakdown: SnapshotBreakdown[]; breakdown_label: string };
    casos?: { stats: { abertos: number; concluidos: number; em_curso: number }; lista: SnapshotCaso[] };
  }>;
};

export async function exportRelatorioDocx(
  relatorio: Relatorio,
  secoes: Secao[],
  snapshot: ExportSnapshot,
) {
  const children: any[] = [];

  // Letterhead
  children.push(new Paragraph({
    alignment: AlignmentType.RIGHT,
    children: [new TextRun({ text: "MEERU · Associação", bold: true, size: 22 })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.RIGHT,
    children: [new TextRun({ text: new Date().toLocaleDateString("pt-PT"), size: 18, color: "888888" })],
    spacing: { after: 240 },
  }));

  // Title page
  children.push(new Paragraph({
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: relatorio.titulo, bold: true })],
    spacing: { before: 480, after: 240 },
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: relatorio.financiador, size: 26 })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: `${relatorio.tipo} · ${fmtDate(relatorio.periodo_inicio)} → ${fmtDate(relatorio.periodo_fim)}`, size: 22, color: "666666" })],
    spacing: { after: 480 },
  }));

  for (const s of secoes) {
    if (s.tipo === "separador") {
      children.push(new Paragraph({ children: [new PageBreak()] }));
      if (s.titulo) children.push(heading(s.titulo, HeadingLevel.HEADING_1));
      continue;
    }

    if (s.titulo) children.push(heading(s.titulo, HeadingLevel.HEADING_2));

    if (s.tipo === "texto") {
      const text = stripHtml(s.conteudo_texto);
      if (text) {
        for (const para of text.split(/\n+/)) {
          if (para.trim()) children.push(paraText(para.trim()));
        }
      }
    } else if (s.tipo === "citacao") {
      const txt = (s.config?.texto ?? "").trim();
      const aut = (s.config?.autor ?? "").trim();
      if (txt) {
        children.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: `"${txt}"`, italics: true, size: 26 })],
          spacing: { before: 240, after: 120 },
        }));
      }
      if (aut) {
        children.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: `— ${aut}`, color: "888888" })],
          spacing: { after: 240 },
        }));
      }
    } else if (s.tipo === "indicadores") {
      const kpis = snapshot.porSecao[s.id]?.kpis ?? [];
      if (kpis.length > 0) {
        children.push(tableSimple(
          ["Indicador", "Valor", "Meta", "Progresso"],
          kpis.map((k) => [
            k.nome,
            `${k.valor} ${k.unidade}`,
            `${k.meta} ${k.unidade}`,
            k.meta > 0 ? `${Math.round((k.valor / k.meta) * 100)}%` : "—",
          ]),
        ));
      } else {
        children.push(paraText("Sem indicadores configurados.", { size: 20 }));
      }
      const t = stripHtml(s.conteudo_texto);
      if (t) { children.push(new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: t })] })); }
    } else if (s.tipo === "atividades") {
      const a = snapshot.porSecao[s.id]?.atividades;
      if (a) {
        children.push(paraText(`${a.resumo.acoes} ações · ${a.resumo.participacoes} participações · ${a.resumo.unicos} participantes únicos`));
        if (a.lista.length > 0) {
          children.push(tableSimple(
            ["Data", "Nome da ação", "Local", "Participantes"],
            a.lista.map((x) => [fmtDate(x.data), x.nome, x.local ?? "", String(x.participantes)]),
          ));
        }
      }
      const t = stripHtml(s.conteudo_texto);
      if (t) children.push(paraText(t));
    } else if (s.tipo === "participantes") {
      const p = snapshot.porSecao[s.id]?.participantes;
      if (p) {
        children.push(paraText(`${p.stats.pessoas} pessoas · ${p.stats.familias} famílias · ${p.stats.novas} novas entradas`));
        if (p.breakdown.length > 0) {
          children.push(tableSimple(
            [p.breakdown_label, "Nº de pessoas", "%"],
            p.breakdown.map((b) => [b.nome, String(b.count), `${b.pct}%`]),
          ));
        }
      }
      const t = stripHtml(s.conteudo_texto);
      if (t) children.push(paraText(t));
    } else if (s.tipo === "casos") {
      const c = snapshot.porSecao[s.id]?.casos;
      if (c) {
        children.push(paraText(`${c.stats.abertos} casos abertos · ${c.stats.concluidos} concluídos · ${c.stats.em_curso} em curso`));
        if (c.lista.length > 0) {
          children.push(tableSimple(
            ["Área", "Abertos", "Concluídos", "Em curso"],
            c.lista.map((x) => [x.area, String(x.abertos), String(x.concluidos), String(x.em_curso)]),
          ));
        }
      }
      const t = stripHtml(s.conteudo_texto);
      if (t) children.push(paraText(t));
    }
  }

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 22 } } },
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^\w]+/g, "-").replace(/(^-|-$)/g, "");
  const filename = `${slug(relatorio.financiador)}-${slug(relatorio.tipo)}-${relatorio.periodo_inicio}.docx`;
  saveAs(blob, filename);
}