export type DatedAcao = { data_inicio: string | null; data_fim: string | null };

export function actionCalendarDays(acao: DatedAcao): Date[] {
  const start = new Date(acao.data_inicio ?? acao.data_fim ?? "");
  if (Number.isNaN(start.getTime())) return [];
  const end = new Date(acao.data_fim ?? acao.data_inicio ?? "");
  start.setHours(0, 0, 0, 0);
  if (Number.isNaN(end.getTime()) || end < start) end.setTime(start.getTime());
  end.setHours(0, 0, 0, 0);
  const days: Date[] = [];
  for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) days.push(new Date(date));
  return days;
}

export function groupActionsByDay<T extends DatedAcao>(acoes: T[]) {
  const map = new Map<string, T[]>();
  for (const acao of acoes) {
    for (const date of actionCalendarDays(acao)) {
      const key = date.toDateString();
      map.set(key, [...(map.get(key) ?? []), acao]);
    }
  }
  return map;
}

const escapeIcs = (text: string) => text.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
const timestamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

// RFC 5545 folds at 75 UTF-8 octets, including the continuation space.
function foldLine(line: string) {
  const encoder = new TextEncoder();
  let current = "";
  let bytes = 0;
  const lines: string[] = [];
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 75) {
      lines.push(current);
      current = " ";
      bytes = 1;
    }
    current += char;
    bytes += size;
  }
  lines.push(current);
  return lines.join("\r\n");
}

export function actionIcs(acao: DatedAcao & { id: string; nome: string; local: string | null }, url: string, emittedAt = new Date()) {
  const start = new Date(acao.data_inicio ?? acao.data_fim ?? "");
  if (Number.isNaN(start.getTime())) throw new Error("Esta ação não tem uma data válida.");
  const end = acao.data_fim ? new Date(acao.data_fim) : null;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MEERU//Ações da comunidade//PT", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${acao.id}@appmeeru.lovable.app`, `DTSTAMP:${timestamp(emittedAt)}`, `DTSTART:${timestamp(start)}`,
    ...(end && !Number.isNaN(end.getTime()) && end > start ? [`DTEND:${timestamp(end)}`] : []),
    `SUMMARY:${escapeIcs(acao.nome)}`, ...(acao.local ? [`LOCATION:${escapeIcs(acao.local)}`] : []),
    `URL:${url}`, `DESCRIPTION:${escapeIcs(url)}`, "END:VEVENT", "END:VCALENDAR"];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}