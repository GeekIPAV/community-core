import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RichTextEditor } from "@/components/rich-text-editor";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Mail, Save, Eye } from "lucide-react";
import { RichTextView } from "@/components/rich-text-view";

export const Route = createFileRoute("/_app/_admin/emails")({
  component: EmailsPage,
});

type Template = {
  id: string;
  chave: string;
  nome: string;
  descricao: string | null;
  assunto: string;
  conteudo_html: string;
  variaveis: string[];
  ativo: boolean;
  updated_at: string;
};

function EmailsPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["email_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Template[];
    },
  });

  useEffect(() => {
    if (!selectedId && templates && templates.length > 0) {
      setSelectedId(templates[0].id);
    }
  }, [templates, selectedId]);

  const selected = useMemo(
    () => templates?.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId],
  );

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5" />
        <h1 className="text-2xl font-semibold">Emails</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Define os modelos de email enviados pela plataforma. Usa as variáveis listadas
        em cada template para personalizar o conteúdo.
      </p>

      {isLoading ? (
        <Skeleton className="h-[400px] w-full" />
      ) : (
        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          <Card className="h-fit">
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Templates</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <div className="flex flex-col gap-1">
                {templates?.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={`text-left rounded-md px-3 py-2 text-sm hover:bg-accent transition ${
                      t.id === selectedId ? "bg-accent" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{t.nome}</span>
                      {!t.ativo && (
                        <Badge variant="outline" className="text-[10px]">
                          off
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {t.chave}
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {selected ? (
            <TemplateEditor
              key={selected.id}
              template={selected}
              onSaved={() => qc.invalidateQueries({ queryKey: ["email_templates"] })}
            />
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Seleciona um template à esquerda.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function TemplateEditor({ template, onSaved }: { template: Template; onSaved: () => void }) {
  const [nome, setNome] = useState(template.nome);
  const [descricao, setDescricao] = useState(template.descricao ?? "");
  const [assunto, setAssunto] = useState(template.assunto);
  const [conteudo, setConteudo] = useState(template.conteudo_html);
  const [ativo, setAtivo] = useState(template.ativo);

  const dirty =
    nome !== template.nome ||
    (descricao ?? "") !== (template.descricao ?? "") ||
    assunto !== template.assunto ||
    conteudo !== template.conteudo_html ||
    ativo !== template.ativo;

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("email_templates")
        .update({
          nome,
          descricao: descricao || null,
          assunto,
          conteudo_html: conteudo,
          ativo,
        })
        .eq("id", template.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template guardado");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const previewSubject = renderPreview(assunto);
  const previewBody = renderPreview(conteudo);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">{template.nome}</CardTitle>
            <CardDescription className="text-xs font-mono">{template.chave}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="ativo" className="text-xs">Ativo</Label>
            <Switch id="ativo" checked={ativo} onCheckedChange={setAtivo} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Nome interno</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Descrição</Label>
          <Textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={2}
            placeholder="Quando é que este email é enviado..."
          />
        </div>

        {template.variaveis.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs">Variáveis disponíveis</Label>
            <div className="flex flex-wrap gap-1">
              {template.variaveis.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => navigator.clipboard.writeText(`{{${v}}}`).then(() => toast.success(`{{${v}}} copiado`))}
                  className="rounded-md border bg-muted px-2 py-0.5 text-xs font-mono hover:bg-accent"
                  title="Copiar"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>
        )}

        <Tabs defaultValue="editar">
          <TabsList>
            <TabsTrigger value="editar">Editar</TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="h-3.5 w-3.5 mr-1" /> Pré-visualizar
            </TabsTrigger>
          </TabsList>
          <TabsContent value="editar" className="space-y-4">
            <div className="space-y-2">
              <Label>Assunto</Label>
              <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Conteúdo</Label>
              <RichTextEditor value={conteudo} onChange={setConteudo} />
            </div>
          </TabsContent>
          <TabsContent value="preview" className="space-y-2">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="text-xs text-muted-foreground">Assunto</div>
              <div className="font-medium">{previewSubject}</div>
            </div>
            <div className="rounded-md border bg-background p-4">
              <RichTextView html={previewBody} />
            </div>
            <p className="text-xs text-muted-foreground">
              Variáveis sem valor são mostradas como <code>[variável]</code>.
            </p>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            onClick={() => save.mutate()}
            disabled={!dirty || save.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {save.isPending ? "A guardar..." : "Guardar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const SAMPLE: Record<string, string> = {
  pessoa_nome: "Ana Silva",
  pessoa_email: "ana@exemplo.pt",
  acao_nome: "Workshop de fotografia",
  acao_data: "15 de junho, 18:00",
  acao_local: "Sede Meeru, Lisboa",
};

function renderPreview(tpl: string): string {
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    return SAMPLE[key] ?? `[${key}]`;
  });
}
