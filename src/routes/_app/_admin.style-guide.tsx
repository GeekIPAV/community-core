import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Palette, Type, Ruler, Component, RotateCcw, Save, Copy } from "lucide-react";
import {
  EDITABLE_TOKENS,
  applyTokens,
  type DesignTokens,
} from "@/lib/theme-provider";

export const Route = createFileRoute("/_app/_admin/style-guide")({
  component: StyleGuidePage,
});

const DEFAULTS: DesignTokens = {
  background: "#FBFAF7",
  foreground: "#1F1F1F",
  card: "#FFFFFF",
  muted: "#F7F6F3",
  border: "#E6E4DF",
  primary: "#F4BD37",
  "primary-foreground": "#1F1F1F",
  secondary: "#F1F1EF",
  accent: "#EFEDE7",
  destructive: "#E03E3E",
  ring: "#F4BD37",
  sidebar: "#F7F6F3",
  "sidebar-primary": "#F4BD37",
  radius: "0.5rem",
  "font-sans": "Inter",
};

function StyleGuidePage() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<DesignTokens>({});

  const { data: saved, isLoading } = useQuery({
    queryKey: ["design_tokens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("design_tokens" as never)
        .select("tokens")
        .maybeSingle();
      if (error) throw error;
      return ((data as { tokens?: DesignTokens } | null)?.tokens ?? {}) as DesignTokens;
    },
  });

  useEffect(() => {
    if (saved) setDraft({ ...DEFAULTS, ...saved });
  }, [saved]);

  // Apply draft live for preview
  useEffect(() => {
    if (Object.keys(draft).length) applyTokens(draft);
  }, [draft]);

  const save = useMutation({
    mutationFn: async () => {
      const cleaned: DesignTokens = {};
      for (const [k, v] of Object.entries(draft)) {
        if (v && v !== (DEFAULTS as Record<string, string | undefined>)[k]) {
          (cleaned as Record<string, string>)[k] = v;
        }
      }
      const { error } = await supabase
        .from("design_tokens" as never)
        .update({ tokens: cleaned } as never)
        .eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tokens guardados — aplicados a todo o site");
      qc.invalidateQueries({ queryKey: ["design_tokens"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reset = () => {
    setDraft({ ...DEFAULTS });
    applyTokens(DEFAULTS);
  };

  const set = (key: string, value: string) => setDraft((d) => ({ ...d, [key]: value }));

  if (isLoading) {
    return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;
  }

  const groups = Array.from(new Set(EDITABLE_TOKENS.map((t) => t.group)));

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:px-8">
        {/* Header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
              <Palette className="h-3.5 w-3.5" />
              Design System
            </div>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">Style Guide</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Tokens e componentes que governam todo o app. Alterações aqui aplicam-se globalmente.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="h-4 w-4 mr-2" /> Repor defaults
            </Button>
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {save.isPending ? "A guardar..." : "Guardar e aplicar"}
            </Button>
          </div>
        </header>

        <Tabs defaultValue="colors" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 max-w-xl">
            <TabsTrigger value="colors"><Palette className="h-3.5 w-3.5 mr-1.5" /> Cores</TabsTrigger>
            <TabsTrigger value="typography"><Type className="h-3.5 w-3.5 mr-1.5" /> Tipografia</TabsTrigger>
            <TabsTrigger value="spacing"><Ruler className="h-3.5 w-3.5 mr-1.5" /> Espaçamento</TabsTrigger>
            <TabsTrigger value="components"><Component className="h-3.5 w-3.5 mr-1.5" /> Componentes</TabsTrigger>
          </TabsList>

          {/* ===== COLORS ===== */}
          <TabsContent value="colors" className="space-y-6">
            {groups.map((g) => (
              <FrostedCard key={g}>
                <CardHeader>
                  <CardTitle className="text-base">{g}</CardTitle>
                  <CardDescription>Editáveis em tempo real</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {EDITABLE_TOKENS.filter((t) => t.group === g).map((t) => (
                      <ColorSwatch
                        key={t.key}
                        token={t.key}
                        label={t.label}
                        value={draft[t.key] ?? DEFAULTS[t.key] ?? "#000000"}
                        onChange={(v) => set(t.key, v)}
                      />
                    ))}
                  </div>
                </CardContent>
              </FrostedCard>
            ))}

            <FrostedCard>
              <CardHeader>
                <CardTitle className="text-base">Raio das bordas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Input
                    className="max-w-[160px]"
                    value={draft.radius ?? DEFAULTS.radius ?? ""}
                    onChange={(e) => set("radius", e.target.value)}
                    placeholder="0.5rem"
                  />
                  <div className="flex gap-3">
                    {["0rem", "0.25rem", "0.5rem", "0.75rem", "1rem"].map((r) => (
                      <button
                        key={r}
                        onClick={() => set("radius", r)}
                        className="h-10 w-10 border-2 border-foreground/20 bg-muted hover:border-primary transition"
                        style={{ borderRadius: r }}
                        title={r}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </FrostedCard>
          </TabsContent>

          {/* ===== TYPOGRAPHY ===== */}
          <TabsContent value="typography" className="space-y-6">
            <FrostedCard>
              <CardHeader>
                <CardTitle className="text-base">Família tipográfica</CardTitle>
                <CardDescription>Carregada via Google Fonts em runtime</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-end gap-3">
                  <div className="flex-1 max-w-xs">
                    <Label className="text-xs">Font family</Label>
                    <Input
                      value={draft["font-sans"] ?? DEFAULTS["font-sans"] ?? ""}
                      onChange={(e) => set("font-sans", e.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {["Inter", "Manrope", "DM Sans", "Outfit", "Geist"].map((f) => (
                      <Button
                        key={f}
                        variant="outline"
                        size="sm"
                        onClick={() => set("font-sans", f)}
                      >
                        {f}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </FrostedCard>

            <FrostedCard>
              <CardHeader>
                <CardTitle className="text-base">Escala</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border">
                {[
                  { tag: "H1", cls: "text-5xl font-bold tracking-tight", meta: "48px / 700 / -0.015em" },
                  { tag: "H2", cls: "text-4xl font-semibold tracking-tight", meta: "36px / 600" },
                  { tag: "H3", cls: "text-2xl font-semibold", meta: "24px / 600" },
                  { tag: "H4", cls: "text-xl font-semibold", meta: "20px / 600" },
                  { tag: "H5", cls: "text-lg font-medium", meta: "18px / 500" },
                  { tag: "H6", cls: "text-base font-medium", meta: "16px / 500" },
                  { tag: "Body", cls: "text-sm", meta: "14px / 400 / 1.5" },
                  { tag: "Caption", cls: "text-xs text-muted-foreground", meta: "12px / 400" },
                  { tag: "Micro", cls: "text-[10px] font-mono uppercase tracking-wider text-muted-foreground", meta: "10px / mono / uppercase" },
                ].map((row) => (
                  <div key={row.tag} className="flex items-baseline justify-between gap-4 py-4">
                    <div className={row.cls}>{row.tag === "Body" || row.tag === "Caption" ? "The quick brown fox jumps over the lazy dog" : row.tag}</div>
                    <div className="text-xs font-mono text-muted-foreground shrink-0">{row.meta}</div>
                  </div>
                ))}
              </CardContent>
            </FrostedCard>
          </TabsContent>

          {/* ===== SPACING ===== */}
          <TabsContent value="spacing" className="space-y-6">
            <FrostedCard>
              <CardHeader>
                <CardTitle className="text-base">Tokens de espaçamento</CardTitle>
                <CardDescription>Base 4px — Tailwind scale</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { token: "1", px: 4 },
                    { token: "2", px: 8 },
                    { token: "4", px: 16 },
                    { token: "6", px: 24 },
                    { token: "8", px: 32 },
                    { token: "12", px: 48 },
                    { token: "16", px: 64 },
                    { token: "24", px: 96 },
                  ].map((s) => (
                    <div key={s.token} className="flex items-center gap-4">
                      <div className="w-16 text-xs font-mono text-muted-foreground">p-{s.token}</div>
                      <div className="w-16 text-xs text-muted-foreground">{s.px}px</div>
                      <div className="flex-1 rounded-md bg-muted/50 p-px">
                        <div
                          className="rounded bg-primary/20 border border-primary/40"
                          style={{ height: s.px }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </FrostedCard>

            <FrostedCard>
              <CardHeader>
                <CardTitle className="text-base">Grelha</CardTitle>
                <CardDescription>Container max-w-6xl · gap-6 · 12 colunas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-12 gap-2">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="h-12 rounded bg-primary/15 border border-primary/30 flex items-center justify-center text-[10px] font-mono text-muted-foreground">
                      {i + 1}
                    </div>
                  ))}
                </div>
              </CardContent>
            </FrostedCard>
          </TabsContent>

          {/* ===== COMPONENTS ===== */}
          <TabsContent value="components" className="space-y-6">
            <FrostedCard>
              <CardHeader>
                <CardTitle className="text-base">Buttons</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
                <Button disabled>Disabled</Button>
              </CardContent>
            </FrostedCard>

            <FrostedCard>
              <CardHeader>
                <CardTitle className="text-base">Inputs</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Default</Label>
                  <Input placeholder="Escreve algo..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Com valor</Label>
                  <Input defaultValue="Olá Meeru" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-destructive">Erro</Label>
                  <Input defaultValue="inválido" aria-invalid className="border-destructive focus-visible:ring-destructive" />
                  <p className="text-xs text-destructive">Este campo é obrigatório</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Disabled</Label>
                  <Input disabled placeholder="Bloqueado" />
                </div>
              </CardContent>
            </FrostedCard>

            <FrostedCard>
              <CardHeader>
                <CardTitle className="text-base">Cards</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardHeader><CardTitle className="text-sm">Standard</CardTitle></CardHeader>
                  <CardContent className="text-xs text-muted-foreground">Elevation suave</CardContent>
                </Card>
                <Card className="transition hover:shadow-lg hover:-translate-y-0.5">
                  <CardHeader><CardTitle className="text-sm">Hover lift</CardTitle></CardHeader>
                  <CardContent className="text-xs text-muted-foreground">Passa o rato →</CardContent>
                </Card>
                <div className="rounded-lg border border-white/40 bg-white/30 backdrop-blur-xl p-4">
                  <div className="text-sm font-semibold">Frosted</div>
                  <div className="text-xs text-muted-foreground">Glass surface</div>
                </div>
              </CardContent>
            </FrostedCard>

            <FrostedCard>
              <CardHeader>
                <CardTitle className="text-base">Badges</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Danger</Badge>
                <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">Success</Badge>
                <Badge className="bg-amber-500 text-white hover:bg-amber-600">Warning</Badge>
                <Badge className="bg-sky-500 text-white hover:bg-sky-600">Info</Badge>
              </CardContent>
            </FrostedCard>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function FrostedCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-xl shadow-sm">
      {children}
    </Card>
  );
}

function ColorSwatch({
  token,
  label,
  value,
  onChange,
}: {
  token: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const hex = normalizeHex(value);
  return (
    <div className="group relative rounded-lg border bg-card/80 p-3 transition hover:shadow-md">
      <div className="flex items-center gap-3">
        <label className="relative h-12 w-12 shrink-0 rounded-md border shadow-inner overflow-hidden cursor-pointer">
          <div className="absolute inset-0" style={{ background: value }} />
          <input
            type="color"
            value={hex}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{label}</div>
          <div className="text-[10px] font-mono text-muted-foreground truncate">
            --{token}
          </div>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(value);
            toast.success(`${value} copiado`);
          }}
          className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-foreground"
          title="Copiar"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
      <Input
        className="mt-2 h-8 text-xs font-mono"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function normalizeHex(v: string): string {
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  if (/^#[0-9a-f]{3}$/i.test(v)) {
    return "#" + v.slice(1).split("").map((c) => c + c).join("");
  }
  return "#000000";
}
