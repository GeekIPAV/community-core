import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";


// ── Contexto Relacional ────────────────────────────────────────────────────
const LINGUAS_OPTS = [
  "Português", "Árabe", "Inglês", "Francês", "Tigrínia",
  "Wolof", "Sorani", "Russo", "Ucraniano", "Outro",
];
const REDES_OPTS = [
  "Família alargada presente",
  "Amigos da comunidade",
  "Vizinhos de referência",
  "Comunidade religiosa",
  "Sem redes identificadas",
];
const REDES_EXCL = "Sem redes identificadas";
const FREQ_OPTS = [
  "Muito frequente (semanal)",
  "Frequente (mensal)",
  "Ocasional",
  "Inativa",
];

type Contexto = {
  familia_id: string;
  territorio: string | null;
  linguas: string[];
  tradicao_cultural: string | null;
  redes_suporte: string[];
  frequencia_participacao: string | null;
  notas_relacionais: string | null;
};

function useContextoQuery(familiaId: string) {
  return useQuery({
    queryKey: ["familia-contexto", familiaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("familia_contexto")
        .select("*")
        .eq("familia_id", familiaId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Contexto | null;
    },
  });
}

export function ContextoTabLabel({ familiaId }: { familiaId: string }) {
  const { data } = useContextoQuery(familiaId);
  const hasData = !!data && (
    !!data.territorio ||
    (data.linguas?.length ?? 0) > 0 ||
    !!data.tradicao_cultural ||
    (data.redes_suporte?.length ?? 0) > 0 ||
    !!data.frequencia_participacao ||
    !!data.notas_relacionais
  );
  return (
    <span className="inline-flex items-center gap-1.5">
      Contexto
      {hasData && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />}
    </span>
  );
}

export function ContextoRelacionalTab({ familiaId }: { familiaId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useContextoQuery(familiaId);

  const empty: Contexto = {
    familia_id: familiaId,
    territorio: "",
    linguas: [],
    tradicao_cultural: "",
    redes_suporte: [],
    frequencia_participacao: null,
    notas_relacionais: "",
  };
  const [local, setLocal] = useState<Contexto>(empty);

  useEffect(() => {
    if (data) setLocal(data);
    else setLocal(empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, familiaId]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["familia-contexto", familiaId] });

  const saveField = async (patch: Partial<Contexto>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    const payload = { ...next, familia_id: familiaId };
    const { error } = await supabase
      .from("familia_contexto")
      .upsert(payload, { onConflict: "familia_id" });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Contexto guardado");
      invalidate();
    }
  };

  const saveAll = async () => {
    const { error } = await supabase
      .from("familia_contexto")
      .upsert({ ...local, familia_id: familiaId }, { onConflict: "familia_id" });
    if (error) toast.error(error.message);
    else { toast.success("Contexto relacional guardado"); invalidate(); }
  };

  const toggleLingua = (l: string) => {
    const has = local.linguas.includes(l);
    saveField({ linguas: has ? local.linguas.filter((x) => x !== l) : [...local.linguas, l] });
  };

  const toggleRede = (r: string) => {
    const isExcl = r === REDES_EXCL;
    if (isExcl) {
      const has = local.redes_suporte.includes(REDES_EXCL);
      saveField({ redes_suporte: has ? [] : [REDES_EXCL] });
      return;
    }
    if (local.redes_suporte.includes(REDES_EXCL)) return;
    const has = local.redes_suporte.includes(r);
    saveField({ redes_suporte: has ? local.redes_suporte.filter((x) => x !== r) : [...local.redes_suporte, r] });
  };

  if (isLoading) {
    return <div className="space-y-2 p-1"><div className="h-32 animate-pulse rounded bg-muted" /></div>;
  }

  const hExcl = local.redes_suporte.includes(REDES_EXCL);

  return (
    <div className="space-y-4 p-1">
      {/* Localização e Línguas */}
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-0">Localização e Línguas</h3>
      <div className="space-y-2">
        <Label>Território / bairro</Label>
        <Input
          value={local.territorio ?? ""}
          onChange={(e) => setLocal({ ...local, territorio: e.target.value })}
          onBlur={() => saveField({ territorio: local.territorio?.trim() || null })}
          placeholder="Ex: Bonfim, Campanhã..."
        />
      </div>
      <div className="space-y-2">
        <Label>Línguas faladas</Label>
        <div className="flex flex-wrap gap-1.5">
          {LINGUAS_OPTS.map((l) => {
            const on = local.linguas.includes(l);
            return (
              <button
                key={l}
                type="button"
                onClick={() => toggleLingua(l)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
              >
                {l}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cultura e Identidade */}
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-6">Cultura e Identidade</h3>
      <div className="space-y-1">
        <Label>Tradição cultural / religiosa</Label>
        <Textarea
          rows={2}
          value={local.tradicao_cultural ?? ""}
          onChange={(e) => setLocal({ ...local, tradicao_cultural: e.target.value })}
          onBlur={() => saveField({ tradicao_cultural: local.tradicao_cultural?.trim() || null })}
        />
        <p className="text-xs text-muted-foreground italic mt-1">
          Campo opcional e confidencial — preencher apenas com o consentimento explícito da família
        </p>
      </div>

      {/* Redes de Suporte */}
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-6">Redes de Suporte</h3>
      <div className="space-y-2">
        <Label>Redes de suporte identificadas</Label>
        <div className="space-y-1.5">
          {REDES_OPTS.map((r) => {
            const checked = local.redes_suporte.includes(r);
            const disabled = hExcl && r !== REDES_EXCL;
            return (
              <label key={r} className={`flex items-center gap-2 text-sm ${disabled ? "opacity-50" : ""}`}>
                <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => toggleRede(r)} />
                <span>{r}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Participação */}
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-6">Participação</h3>
      <div className="space-y-2">
        <Label>Frequência de participação</Label>
        <Select
          value={local.frequencia_participacao ?? "__none"}
          onValueChange={(v) => saveField({ frequencia_participacao: v === "__none" ? null : v })}
        >
          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">—</SelectItem>
            {FREQ_OPTS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Notas relacionais */}
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-6">Notas relacionais</h3>
      <div className="space-y-1">
        <Label>Notas relacionais</Label>
        <Textarea
          rows={4}
          value={local.notas_relacionais ?? ""}
          onChange={(e) => setLocal({ ...local, notas_relacionais: e.target.value })}
          onBlur={() => saveField({ notas_relacionais: local.notas_relacionais?.trim() || null })}
          placeholder="Observações sobre dinâmicas relacionais, contexto de integração, notas de acompanhamento..."
        />
        <p className="text-xs text-muted-foreground italic mt-1">
          Contexto qualitativo para uso interno da mediadora — não partilhado externamente
        </p>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={saveAll}>Guardar contexto</Button>
      </div>
    </div>
  );
}
