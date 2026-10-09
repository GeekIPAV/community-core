import { describe, expect, it } from "vitest";
import { actionCalendarDays, actionIcs, groupActionsByDay } from "./acao-calendar";

describe("calendário público", () => {
  it("inclui todos os dias entre início e fim, incluindo mudança de mês", () => {
    const days = actionCalendarDays({ data_inicio: "2026-08-31T10:00:00", data_fim: "2026-09-04T18:00:00" });
    expect(days.map((d) => [d.getMonth() + 1, d.getDate()])).toEqual([[8, 31], [9, 1], [9, 2], [9, 3], [9, 4]]);
  });
  it("partilha a mesma ação no primeiro, intermédio e último dia", () => {
    const acao = { data_inicio: "2026-10-24T10:00:00", data_fim: "2026-10-26T18:00:00" };
    const grouped = groupActionsByDay([acao]);
    expect(grouped.size).toBe(3);
    for (const day of [24, 25, 26]) expect(grouped.get(new Date(2026, 9, day).toDateString())).toEqual([acao]);
  });
  it("sem fim aparece só na data de início; sem datas não entra na agenda", () => {
    expect(actionCalendarDays({ data_inicio: "2026-10-09T10:00:00", data_fim: null })).toHaveLength(1);
    expect(actionCalendarDays({ data_inicio: null, data_fim: null })).toEqual([]);
  });
  it("ICS preserva título, datas, local e link sem permitir injeção de propriedades", () => {
    const ics = actionIcs({ id: "abc", nome: "Encontro, família; Porto\nOutro", local: "Porto", data_inicio: "2026-10-09T10:00:00Z", data_fim: "2026-10-11T18:00:00Z" }, "https://appmeeru.lovable.app/acao/abc", new Date("2026-10-09T07:00:00Z"));
    expect(ics).toContain("SUMMARY:Encontro\\, família\\; Porto\\nOutro\r\n");
    expect(ics).toContain("DTSTART:20261009T100000Z\r\nDTEND:20261011T180000Z");
    expect(ics).toContain("LOCATION:Porto\r\nURL:https://appmeeru.lovable.app/acao/abc");
  });
  it("não inventa uma data de fim e dobra linhas longas em 75 bytes", () => {
    const ics = actionIcs({ id: "abc", nome: "Ação ".repeat(40), local: null, data_inicio: "2026-10-09T10:00:00Z", data_fim: null }, "https://appmeeru.lovable.app/acao/abc");
    expect(ics).not.toContain("DTEND");
    expect(ics.split("\r\n").every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
    expect(ics.replace(/\r\n /g, "")).toContain(`SUMMARY:${"Ação ".repeat(40)}`);
  });
});