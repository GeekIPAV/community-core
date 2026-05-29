// Helpers to display person icon (by gender + age) and country flag emoji.
import { Baby, PersonStanding, Accessibility, type LucideIcon } from "lucide-react";

function ageFrom(dateISO: string | null | undefined): number | null {
  if (!dateISO) return null;
  const m = dateISO.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const birth = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const mo = now.getUTCMonth() - birth.getUTCMonth();
  if (mo < 0 || (mo === 0 && now.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}

function normGenero(g: string | null | undefined): "M" | "F" | null {
  if (!g) return null;
  const s = g.toLowerCase();
  if (s.startsWith("m")) return "M";
  if (s.startsWith("f")) return "F";
  return null;
}

/** Returns a Lucide icon component representing the person based on gender + age. */
export function personIcon(
  genero: string | null | undefined,
  dataNascimento: string | null | undefined,
): LucideIcon {
  const age = ageFrom(dataNascimento);
  // Gender currently not differentiated visually (no distinct Lucide stick-figure for women).
  void normGenero(genero);
  if (age != null && age < 3) return Baby;
  if (age != null && age >= 65) return Accessibility;
  return PersonStanding;
}

// Map common country names (PT/EN, with/without accents) to ISO 3166-1 alpha-2.
const COUNTRY_TO_ISO: Record<string, string> = {
  portugal: "PT",
  espanha: "ES", spain: "ES",
  franca: "FR", "frança": "FR", france: "FR",
  alemanha: "DE", germany: "DE",
  italia: "IT", "itália": "IT", italy: "IT",
  "reino unido": "GB", "inglaterra": "GB", "uk": "GB",
  "estados unidos": "US", eua: "US", usa: "US", "estados unidos da america": "US",
  brasil: "BR", brazil: "BR",
  angola: "AO", mocambique: "MZ", "moçambique": "MZ",
  "cabo verde": "CV", "sao tome e principe": "ST", "são tomé e príncipe": "ST",
  "guine-bissau": "GW", "guiné-bissau": "GW", guine: "GN", "guiné": "GN",
  senegal: "SN", "costa do marfim": "CI", nigeria: "NG", "nigéria": "NG",
  gana: "GH", ghana: "GH",
  marrocos: "MA", morocco: "MA",
  argelia: "DZ", "argélia": "DZ", algeria: "DZ",
  tunisia: "TN", "tunísia": "TN",
  libia: "LY", "líbia": "LY",
  egito: "EG", "egipto": "EG", egypt: "EG",
  siria: "SY", "síria": "SY", syria: "SY",
  libano: "LB", "líbano": "LB", lebanon: "LB",
  iraque: "IQ", iraq: "IQ",
  ira: "IR", "irã": "IR", "irão": "IR", iran: "IR",
  afeganistao: "AF", "afeganistão": "AF", afghanistan: "AF",
  paquistao: "PK", "paquistão": "PK", pakistan: "PK",
  india: "IN", "índia": "IN",
  bangladesh: "BD",
  nepal: "NP",
  china: "CN", japao: "JP", "japão": "JP", japan: "JP",
  "coreia do sul": "KR", "coreia do norte": "KP",
  vietnam: "VN", "vietname": "VN",
  tailandia: "TH", "tailândia": "TH",
  filipinas: "PH",
  indonesia: "ID", "indonésia": "ID",
  turquia: "TR", turkey: "TR",
  russia: "RU", "rússia": "RU",
  ucrania: "UA", "ucrânia": "UA", ukraine: "UA",
  belarus: "BY", "bielorrussia": "BY", "bielorrússia": "BY",
  polonia: "PL", "polónia": "PL", poland: "PL",
  romenia: "RO", "roménia": "RO", romania: "RO",
  moldavia: "MD", "moldávia": "MD",
  bulgaria: "BG", "bulgária": "BG",
  grecia: "GR", "grécia": "GR", greece: "GR",
  holanda: "NL", "países baixos": "NL", netherlands: "NL",
  belgica: "BE", "bélgica": "BE", belgium: "BE",
  suica: "CH", "suíça": "CH", switzerland: "CH",
  austria: "AT", "áustria": "AT",
  suecia: "SE", "suécia": "SE", sweden: "SE",
  noruega: "NO", norway: "NO",
  dinamarca: "DK", denmark: "DK",
  finlandia: "FI", "finlândia": "FI",
  irlanda: "IE", ireland: "IE",
  canada: "CA", "canadá": "CA",
  mexico: "MX", "méxico": "MX",
  argentina: "AR", chile: "CL", peru: "PE", colombia: "CO", "colômbia": "CO",
  venezuela: "VE", cuba: "CU", "republica dominicana": "DO", "república dominicana": "DO",
  haiti: "HT", "haíti": "HT",
  australia: "AU", "austrália": "AU",
  "nova zelandia": "NZ", "nova zelândia": "NZ",
  sudao: "SD", "sudão": "SD",
  "sudao do sul": "SS", "sudão do sul": "SS",
  etiopia: "ET", "etiópia": "ET",
  eritreia: "ER", somalia: "SO", "somália": "SO",
  iemen: "YE", "iémen": "YE", yemen: "YE",
  jordania: "JO", "jordânia": "JO",
  palestina: "PS", palestine: "PS",
  israel: "IL",
  "emirados arabes unidos": "AE", "emirados árabes unidos": "AE",
  "arabia saudita": "SA", "arábia saudita": "SA",
  catar: "QA", qatar: "QA", kuwait: "KW", bahrain: "BH", "barém": "BH", oma: "OM", oman: "OM",
  quenia: "KE", "quénia": "KE", uganda: "UG", tanzania: "TZ", "tanzânia": "TZ",
  ruanda: "RW", burundi: "BI",
  "africa do sul": "ZA", "áfrica do sul": "ZA",
  zimbabwe: "ZW", zimbabue: "ZW", zambia: "ZM", "zâmbia": "ZM",
  mali: "ML", "burkina faso": "BF", niger: "NE", "níger": "NE",
  "republica centro-africana": "CF", "república centro-africana": "CF",
  camaroes: "CM", "camarões": "CM",
  "republica democratica do congo": "CD", "república democrática do congo": "CD",
  congo: "CG",
  gabao: "GA", "gabão": "GA",
  mauritania: "MR", "mauritânia": "MR",
};

function normalizeCountry(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function isoToEmoji(iso: string): string {
  const base = 0x1f1e6;
  const A = "A".charCodeAt(0);
  const cc = iso.toUpperCase();
  if (cc.length !== 2) return "";
  return String.fromCodePoint(base + (cc.charCodeAt(0) - A), base + (cc.charCodeAt(1) - A));
}

/** Returns the flag emoji for a country name, or "🌍" if unknown. */
export function flagFor(country: string | null | undefined): string {
  if (!country) return "";
  const key = normalizeCountry(country);
  // try exact match
  let iso = COUNTRY_TO_ISO[key] ?? COUNTRY_TO_ISO[country.trim().toLowerCase()];
  // try with original (accented) lowercased
  if (!iso) iso = COUNTRY_TO_ISO[country.toLowerCase()];
  if (!iso) return "🌍";
  return isoToEmoji(iso);
}