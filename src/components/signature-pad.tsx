import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, Upload, Pencil } from "lucide-react";
import { toast } from "sonner";

const MAX_W = 800;
const MAX_H = 300;

async function ficheiroParaDataUrl(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler o ficheiro"));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Imagem inválida"));
    i.src = dataUrl;
  });
  const escala = Math.min(1, MAX_W / img.width, MAX_H / img.height);
  const w = Math.max(1, Math.round(img.width * escala));
  const h = Math.max(1, Math.round(img.height * escala));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/png");
}

export function SignaturePad({
  value,
  onChange,
  height = 140,
}: {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const drawing = useRef(false);
  const [vazio, setVazio] = useState(!value);
  const [modo, setModo] = useState<"ver" | "desenhar">(value ? "ver" : "desenhar");

  useEffect(() => {
    setModo(value ? "ver" : "desenhar");
    setVazio(!value);
  }, [value]);

  useEffect(() => {
    if (modo !== "desenhar") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111111";
  }, [height, modo]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    setVazio(false);
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL("image/png"));
  };

  const limpar = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setVazio(true);
    setModo("desenhar");
    onChange(null);
  };

  const carregar = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Escolha um ficheiro de imagem (PNG ou JPG).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem é demasiado grande (máximo 5 MB).");
      return;
    }
    try {
      const dataUrl = await ficheiroParaDataUrl(file);
      onChange(dataUrl);
      setVazio(false);
      setModo("ver");
      toast.success("Assinatura carregada.");
    } catch {
      toast.error("Não foi possível carregar a imagem.");
    }
  };

  const botaoCarregar = (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          void carregar(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
        <Upload className="mr-2 h-4 w-4" /> Carregar imagem
      </Button>
    </>
  );

  if (modo === "ver" && value) {
    return (
      <div className="space-y-2">
        <img src={value} alt="Assinatura" className="max-h-28 rounded-md border bg-white object-contain p-2" />
        <div className="flex flex-wrap gap-2">
          {botaoCarregar}
          <Button type="button" variant="outline" size="sm" onClick={() => setModo("desenhar")}>
            <Pencil className="mr-2 h-4 w-4" /> Desenhar nova
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={limpar}>
            <Eraser className="mr-2 h-4 w-4" /> Remover
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative rounded-md border bg-background">
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height }}
          className="touch-none rounded-md"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
        {vazio && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            Assine aqui com o rato ou com o dedo, ou carregue uma imagem
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {botaoCarregar}
        <Button type="button" variant="outline" size="sm" onClick={limpar}>
          <Eraser className="mr-2 h-4 w-4" /> Limpar assinatura
        </Button>
      </div>
    </div>
  );
}
