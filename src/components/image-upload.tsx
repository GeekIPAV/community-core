import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, Move } from "lucide-react";
import { toast } from "sonner";

type Props = {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  bucket?: string;
  folder?: string;
  position?: string | null;
  onPositionChange?: (position: string) => void;
};

export function ImageUpload({ value, onChange, bucket = "acoes-imagens", folder = "", position, onPositionChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const parsePos = (p: string | null | undefined) => {
    const m = (p ?? "50% 50%").match(/(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/);
    return { x: m ? Number(m[1]) : 50, y: m ? Number(m[2]) : 50 };
  };
  const { x: posX, y: posY } = parsePos(position);

  const clamp = (n: number) => Math.max(0, Math.min(100, n));

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onPositionChange) return;
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateFromEvent(e);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    updateFromEvent(e);
  };
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };
  const updateFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!previewRef.current || !onPositionChange) return;
    const rect = previewRef.current.getBoundingClientRect();
    const x = clamp(((e.clientX - rect.left) / rect.width) * 100);
    const y = clamp(((e.clientY - rect.top) / rect.height) * 100);
    onPositionChange(`${x.toFixed(1)}% ${y.toFixed(1)}%`);
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Seleciona um ficheiro de imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem é demasiado grande (máx. 5 MB).");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${folder ? folder + "/" : ""}${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(data.publicUrl);
      if (onPositionChange) onPositionChange("50% 50%");
      toast.success("Imagem carregada");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {value ? (
        <>
          <div
            ref={previewRef}
            className={`relative h-40 w-full overflow-hidden rounded-md border bg-muted ${onPositionChange ? "cursor-move touch-none select-none" : ""}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              backgroundImage: `url("${value}")`,
              backgroundSize: "cover",
              backgroundPosition: `${posX}% ${posY}%`,
              backgroundRepeat: "no-repeat",
            }}
          >
            {onPositionChange && (
              <div className="pointer-events-none absolute inset-0 flex items-end justify-start p-2">
                <span className="inline-flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  <Move className="h-3 w-3" /> Arrasta para ajustar
                </span>
              </div>
            )}
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute right-2 top-2 h-7 w-7"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onChange(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {onPositionChange && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Posição: {posX.toFixed(0)}% / {posY.toFixed(0)}%</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onPositionChange("50% 50%")}
              >
                Centrar
              </Button>
            </div>
          )}
        </>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-32 w-full items-center justify-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground hover:bg-accent"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "A carregar…" : "Carregar imagem"}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}