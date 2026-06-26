import type { Relatorio, Secao } from "./types";

function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "  • ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-PT");
}

export function relatorioToTexto(relatorio: Relatorio, secoes: Secao[]): string {
  const linhas: string[] = [];
  linhas.push("════════════════════════════════════════");
  linhas.push(relatorio.titulo);
  linhas.push(`${relatorio.financiador} · ${relatorio.tipo} · ${fmtDate(relatorio.periodo_inicio)} → ${fmtDate(relatorio.periodo_fim)}`);
  linhas.push(`Gerado em ${new Date().toLocaleDateString("pt-PT")} pela equipa MEERU`);
  linhas.push("════════════════════════════════════════");
  linhas.push("");

  for (const s of secoes) {
    if (s.tipo === "separador") {
      linhas.push("────────────────────────────");
      if (s.titulo) linhas.push(s.titulo.toUpperCase());
      linhas.push("────────────────────────────");
      linhas.push("");
      continue;
    }

    if (s.titulo) {
      linhas.push(s.titulo.toUpperCase());
      linhas.push("─────────────────────────────────");
    }

    if (s.tipo === "citacao") {
      const txt = (s.config?.texto ?? "").trim();
      const aut = (s.config?.autor ?? "").trim();
      if (txt) linhas.push(`"${txt}"`);
      if (aut) linhas.push(`— ${aut}`);
    } else if (s.tipo === "texto") {
      const t = stripHtml(s.conteudo_texto);
      if (t) linhas.push(t);
    } else {
      // Para tipos com dados vivos, descrevemos a configuração + narrativa
      if (s.tipo === "indicadores") linhas.push("[Indicadores — ver tabela na versão Word]");
      if (s.tipo === "atividades") linhas.push("[Atividades — ver tabela na versão Word]");
      if (s.tipo === "participantes") linhas.push("[Participantes — ver tabela na versão Word]");
      if (s.tipo === "casos") linhas.push("[Casos de apoio — ver tabela na versão Word]");
      const t = stripHtml(s.conteudo_texto);
      if (t) { linhas.push(""); linhas.push(t); }
    }
    linhas.push("");
  }

  return linhas.join("\n").trim() + "\n";
}