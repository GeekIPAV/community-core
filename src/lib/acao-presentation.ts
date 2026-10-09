import { BookOpen, CookingPot, HandHeart, Music, Palette, Sparkles, Users, type LucideIcon } from "lucide-react";

export type AcaoTipo = { id?: string; nome: string; icone?: string | null };

const icons: Record<string, LucideIcon> = { BookOpen, CookingPot, Utensils: CookingPot, HandHeart, Music, Palette, Sparkles, Users };

export function acaoPresentation(tipo?: AcaoTipo | null) {
  const name = (tipo?.nome ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (tipo?.icone && icons[tipo.icone]) return { Icon: icons[tipo.icone], tone: "acao-chip-sage" };
  if (/culin|cozinha|gastron|aliment/.test(name)) return { Icon: CookingPot, tone: "acao-chip-gold" };
  if (/forma|oficina|curso|workshop/.test(name)) return { Icon: BookOpen, tone: "acao-chip-ink" };
  if (/encontro|conviv|comunidade|passeio/.test(name)) return { Icon: Users, tone: "acao-chip-sage" };
  if (/arte|criativ|cultura/.test(name)) return { Icon: Palette, tone: "acao-chip-gold" };
  if (/music|concerto/.test(name)) return { Icon: Music, tone: "acao-chip-ink" };
  if (/volunt|solidar/.test(name)) return { Icon: HandHeart, tone: "acao-chip-sage" };
  const hash = Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return { Icon: Sparkles, tone: ["acao-chip-gold", "acao-chip-sage", "acao-chip-ink"][hash % 3] };
}

const month = (date: Date) => date.toLocaleDateString("pt-PT", { month: "short" }).replace(/\./g, "").toUpperCase();
const day = (date: Date) => String(date.getDate()).padStart(2, "0");

export function acaoDateLabel(start?: string | null, end?: string | null) {
  if (!start && !end) return { kind: "undated" as const, text: "Data a definir" };
  const first = new Date(start ?? end ?? "");
  if (Number.isNaN(first.getTime())) return { kind: "undated" as const, text: "Data a definir" };
  const last = end ? new Date(end) : first;
  if (!Number.isNaN(last.getTime()) && first.toDateString() !== last.toDateString()) {
    return { kind: "range" as const, text: `${day(first)} ${month(first)} – ${day(last)} ${month(last)}` };
  }
  return { kind: "single" as const, day: day(first), month: month(first), text: `${day(first)} ${month(first)}` };
}