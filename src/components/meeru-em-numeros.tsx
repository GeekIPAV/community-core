import { Users, Home, Globe2, HeartHandshake, Activity, Calendar, FolderKanban, Flag } from "lucide-react";

type Props = {
  data: {
    familias_total: number;
    membros_familias_total: number;
    projetos_total: number;
    participantes_projetos_total: number;
    eventos_total: number;
    participantes_eventos_total: number;
    nacionalidades_total: number;
    nacionalidades_detalhe: { nome: string; count: number }[];
    voluntarios_total: number;
    atividades_total: number;
  };
};

const COLORS = {
  darkGreen: "#1a4a3a",
  midGreen: "#2d7a5f",
  lightGreen: "#7aaa9a",
  cream: "#f0eeeb",
  gold: "#e8a020",
};

const font = { fontFamily: "'Cabin', system-ui, sans-serif" };

function Block({
  bg,
  fg = "#ffffff",
  className = "",
  children,
}: {
  bg: string;
  fg?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`relative flex flex-col justify-between p-6 md:p-8 ${className}`}
      style={{ backgroundColor: bg, color: fg, ...font }}
    >
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[11px] md:text-xs font-semibold uppercase tracking-[0.2em] opacity-90"
      style={font}
    >
      {children}
    </div>
  );
}

function BigNumber({ children, size = "5xl" }: { children: React.ReactNode; size?: "5xl" | "6xl" | "7xl" }) {
  const cls = size === "7xl" ? "text-6xl md:text-7xl" : size === "6xl" ? "text-5xl md:text-6xl" : "text-4xl md:text-5xl";
  return (
    <div className={`${cls} font-bold leading-none tracking-tight`} style={font}>
      {children}
    </div>
  );
}

function Sub({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 text-sm md:text-base font-medium opacity-90" style={font}>
      {children}
    </div>
  );
}

export function MeeruEmNumeros({ data }: Props) {
  const top3 = (data.nacionalidades_detalhe ?? []).slice(0, 3);

  return (
    <section className="space-y-6">
      <h2
        className="text-2xl md:text-4xl font-bold uppercase tracking-widest"
        style={{ ...font, color: COLORS.darkGreen }}
      >
        A MEERU em Números
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 auto-rows-[minmax(160px,auto)] gap-2">
        {/* Pessoas apoiadas — grande */}
        <Block bg={COLORS.darkGreen} className="col-span-2 md:col-span-2 md:row-span-2">
          <HeartHandshake className="h-8 w-8 opacity-70" />
          <div>
            <BigNumber size="7xl">{data.membros_familias_total ?? 0}</BigNumber>
            <div className="mt-4">
              <Label>Pessoas apoiadas</Label>
            </div>
          </div>
        </Block>

        {/* Famílias */}
        <Block bg={COLORS.midGreen}>
          <Home className="h-6 w-6 opacity-70" />
          <div>
            <BigNumber>{data.familias_total ?? 0}</BigNumber>
            <div className="mt-3">
              <Label>Famílias acompanhadas</Label>
            </div>
          </div>
        </Block>

        {/* Nacionalidades */}
        <Block bg={COLORS.lightGreen} fg={COLORS.darkGreen}>
          <Globe2 className="h-6 w-6 opacity-80" />
          <div>
            <BigNumber>{data.nacionalidades_total ?? 0}</BigNumber>
            <div className="mt-3">
              <Label>Nacionalidades representadas</Label>
            </div>
          </div>
        </Block>

        {/* Voluntários */}
        <Block bg={COLORS.gold} fg={COLORS.darkGreen}>
          <Users className="h-6 w-6 opacity-80" />
          <div>
            <BigNumber>{data.voluntarios_total ?? 0}</BigNumber>
            <div className="mt-3">
              <Label>Voluntários</Label>
            </div>
          </div>
        </Block>

        {/* Atividades */}
        <Block bg={COLORS.darkGreen}>
          <Activity className="h-6 w-6 opacity-70" />
          <div>
            <BigNumber>{data.atividades_total ?? 0}</BigNumber>
            <div className="mt-3">
              <Label>Atividades registadas</Label>
            </div>
          </div>
        </Block>

        {/* Eventos */}
        <Block bg={COLORS.midGreen}>
          <Calendar className="h-6 w-6 opacity-70" />
          <div>
            <BigNumber>{data.eventos_total ?? 0}</BigNumber>
            <Sub>{data.participantes_eventos_total ?? 0} participações</Sub>
            <div className="mt-3">
              <Label>Eventos realizados</Label>
            </div>
          </div>
        </Block>

        {/* Projetos */}
        <Block bg={COLORS.lightGreen} fg={COLORS.darkGreen}>
          <FolderKanban className="h-6 w-6 opacity-80" />
          <div>
            <BigNumber>{data.projetos_total ?? 0}</BigNumber>
            <Sub>{data.participantes_projetos_total ?? 0} participações</Sub>
            <div className="mt-3">
              <Label>Projetos ativos</Label>
            </div>
          </div>
        </Block>

        {/* Top 3 nacionalidades — largo */}
        <Block bg={COLORS.cream} fg={COLORS.darkGreen} className="col-span-2 md:col-span-4">
          <div className="flex items-center justify-between">
            <Label>Top 3 nacionalidades</Label>
            <Flag className="h-6 w-6 opacity-70" />
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
            {top3.length === 0 ? (
              <div className="text-sm opacity-70" style={font}>Sem dados</div>
            ) : (
              top3.map((n, i) => (
                <div key={n.nome} className="flex items-baseline gap-3">
                  <div className="text-3xl md:text-4xl font-bold opacity-40" style={font}>
                    {i + 1}
                  </div>
                  <div>
                    <div className="text-xl md:text-2xl font-bold" style={font}>{n.nome}</div>
                    <div className="text-xs uppercase tracking-widest opacity-70" style={font}>
                      {n.count} pessoa{n.count === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Block>
      </div>
    </section>
  );
}