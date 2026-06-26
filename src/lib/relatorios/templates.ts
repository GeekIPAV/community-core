import type { SecaoTipo, SecaoConfig } from "./types";

export type TemplateSecao = {
  tipo: SecaoTipo;
  titulo?: string;
  conteudo_texto?: string;
  config?: SecaoConfig;
};

export type ReportTemplate = {
  id: string;
  nome: string;
  financiador: string;
  descricao: string;
  secoes: TemplateSecao[];
};

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: "gulbenkian-intercalar",
    nome: "Gulbenkian IGI — Intercalar",
    financiador: "Gulbenkian IGI",
    descricao: "Estrutura típica de relatório intercalar da Fundação Gulbenkian (IGI).",
    secoes: [
      { tipo: "separador", titulo: "IDENTIFICAÇÃO DO PROJETO" },
      { tipo: "texto", titulo: "Identificação" },
      { tipo: "separador", titulo: "EXECUÇÃO" },
      { tipo: "atividades", titulo: "Atividades realizadas", config: { mostrar_participantes: true } },
      { tipo: "participantes", titulo: "Participantes alcançados", config: { breakdown_por: "nacionalidade" } },
      { tipo: "indicadores", titulo: "Indicadores", config: { mostrar_meta: true, mostrar_progresso: true } },
      { tipo: "separador", titulo: "NARRATIVA" },
      { tipo: "texto", titulo: "Progresso e desafios" },
      { tipo: "texto", titulo: "Próximos passos" },
    ],
  },
  {
    id: "bpi-final",
    nome: "BPI Solidário — Final",
    financiador: "BPI Solidário",
    descricao: "Relatório final de execução para o BPI Solidário.",
    secoes: [
      { tipo: "texto", titulo: "Resumo executivo" },
      { tipo: "participantes", titulo: "Participantes", config: { breakdown_por: "projeto" } },
      { tipo: "atividades", titulo: "Atividades", config: { mostrar_participantes: true } },
      { tipo: "indicadores", titulo: "Indicadores", config: { mostrar_meta: true, mostrar_progresso: true } },
      { tipo: "casos", titulo: "Casos de apoio" },
      { tipo: "texto", titulo: "Impacto e resultados" },
      { tipo: "citacao", titulo: "Testemunho", config: { texto: "", autor: "" } },
      { tipo: "texto", titulo: "Conclusões e sustentabilidade" },
    ],
  },
  {
    id: "generico",
    nome: "Relatório genérico",
    financiador: "",
    descricao: "Estrutura base reutilizável para qualquer financiador.",
    secoes: [
      { tipo: "texto", titulo: "Contexto e objetivos" },
      { tipo: "atividades", titulo: "Atividades", config: { mostrar_participantes: true } },
      { tipo: "participantes", titulo: "Participantes", config: { breakdown_por: "nacionalidade" } },
      { tipo: "indicadores", titulo: "Indicadores", config: { mostrar_meta: true, mostrar_progresso: true } },
      { tipo: "texto", titulo: "Resultados e impacto" },
      { tipo: "texto", titulo: "Dificuldades e aprendizagens" },
    ],
  },
];