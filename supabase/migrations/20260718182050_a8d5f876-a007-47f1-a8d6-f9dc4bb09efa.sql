
CREATE TABLE public.component_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  categoria text NOT NULL DEFAULT 'Outros',
  prompt_pt text NOT NULL DEFAULT '',
  prompt_en text,
  snippet text,
  tokens text[] NOT NULL DEFAULT '{}',
  preview_key text,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.component_library TO authenticated;
GRANT ALL ON public.component_library TO service_role;

ALTER TABLE public.component_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados podem ler biblioteca"
  ON public.component_library FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff gere biblioteca"
  ON public.component_library FOR ALL TO authenticated
  USING (public.is_current_user_staff())
  WITH CHECK (public.is_current_user_staff());

CREATE OR REPLACE FUNCTION public.component_library_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER component_library_updated_at
  BEFORE UPDATE ON public.component_library
  FOR EACH ROW EXECUTE FUNCTION public.component_library_touch_updated_at();

INSERT INTO public.component_library (titulo, descricao, categoria, preview_key, tokens, ordem, prompt_pt, prompt_en, snippet) VALUES
('KPI Card', 'Cartão numérico com ícone, valor, label e delta opcional.', 'KPIs', 'kpi-card', ARRAY['--card','--muted-foreground','--primary'], 10,
'Cria um KPI Card: ícone lucide num badge bg-primary/10 (canto superior esquerdo), label uppercase pequeno em text-muted-foreground, valor grande text-3xl font-bold tabular-nums, delta opcional a verde/vermelho. bg-card, border, rounded-lg, p-4. Usar em grid-cols-2 md:grid-cols-4.',
'KPI Card: lucide icon in bg-primary/10 badge (top-left), small uppercase muted-foreground label, large text-3xl font-bold tabular-nums value, optional green/red delta. bg-card, border, rounded-lg, p-4. Use in grid-cols-2 md:grid-cols-4.',
'<div className="rounded-lg border bg-card p-4">
  <div className="flex items-center justify-between">
    <div className="rounded-md bg-primary/10 p-2"><Icon className="h-4 w-4 text-primary" /></div>
    <span className="text-xs text-emerald-600">+12%</span>
  </div>
  <div className="mt-3 text-xs uppercase text-muted-foreground">{label}</div>
  <div className="text-3xl font-bold tabular-nums">{value}</div>
</div>'),

('FrostedCard (Glass)', 'Cartão glassmorphism para overlays e secções destacadas.', 'Layout', 'frosted-card', ARRAY['--card','--border'], 20,
'Card glassmorphism: border/60, bg-card/60 com backdrop-blur-xl, shadow-sm.',
'Glassmorphism Card: border/60, bg-card/60 with backdrop-blur-xl, shadow-sm.',
'<Card className="border-border/60 bg-card/60 backdrop-blur-xl shadow-sm">
  <CardHeader><CardTitle>Título</CardTitle></CardHeader>
  <CardContent>Conteúdo</CardContent>
</Card>'),

('Badge de Estado', 'Badges semânticos: pago, pendente, cancelado, info.', 'Feedback', 'status-badge', ARRAY['--primary','--destructive'], 30,
'Badges semânticos: Pago (bg-emerald-500), Pendente (bg-amber-500), Cancelado (variant destructive), Info (bg-sky-500), Draft (variant outline). Todos com text-white nos coloridos.',
'Semantic badges: Paid (bg-emerald-500), Pending (bg-amber-500), Cancelled (destructive), Info (bg-sky-500), Draft (outline).',
'<Badge className="bg-emerald-500 text-white hover:bg-emerald-600">Pago</Badge>
<Badge className="bg-amber-500 text-white hover:bg-amber-600">Pendente</Badge>
<Badge variant="destructive">Cancelado</Badge>'),

('Empty State', 'Estado vazio centrado com ícone, título, descrição e CTA opcional.', 'Feedback', 'empty-state', ARRAY['--muted-foreground'], 40,
'Empty State centrado: ícone lucide h-12 w-12 em text-muted-foreground/50, título text-lg font-medium, descrição text-sm text-muted-foreground, botão CTA opcional. py-12.',
'Centered empty state: h-12 w-12 muted icon, text-lg title, text-sm muted description, optional CTA. py-12.',
'<div className="flex flex-col items-center py-12 text-center">
  <Icon className="h-12 w-12 text-muted-foreground/50" />
  <h3 className="mt-4 text-lg font-medium">Sem resultados</h3>
  <p className="mt-1 text-sm text-muted-foreground">Adiciona a tua primeira entrada.</p>
  <Button className="mt-4">Adicionar</Button>
</div>'),

('Loading Skeleton', 'Placeholders animados para listas e cartões.', 'Feedback', 'loading-skeleton', ARRAY['--muted'], 50,
'Skeleton (shadcn) para placeholders. Listas: 5x Skeleton h-16 com space-y-2. KPI grids: 4x Skeleton h-24 em grid-cols-4.',
'shadcn Skeleton placeholders. Lists: 5x h-16 space-y-2. KPI grids: 4x h-24 grid-cols-4.',
'<div className="space-y-2">
  {Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-16 w-full" />)}
</div>'),

('Family Group Header', 'Cabeçalho colapsível de família com avatar, badges e contagem de ações.', 'Dados', 'family-group-header', ARRAY['--primary','--muted'], 60,
'Cabeçalho colapsível: chevron rotação em open, círculo com inicial (bg-primary/10 text-primary), nome font-medium, badges de direito (bolsa/KM), contagem "X ações" com popover ao hover. Expande para revelar membros.',
'Collapsible header: rotating chevron, initial circle (bg-primary/10), font-medium name, entitlement badges, "X actions" popover on hover. Expands to reveal members.',
'<Collapsible>
  <CollapsibleTrigger className="flex w-full items-center gap-2 p-2 rounded-md hover:bg-muted">
    <ChevronRight className="h-4 w-4 data-[state=open]:rotate-90 transition-transform" />
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">S</div>
    <span className="flex-1 text-left font-medium">Família Silva</span>
    <Badge variant="outline">Direito a bolsa</Badge>
  </CollapsibleTrigger>
</Collapsible>'),

('SmartTable', 'Tabela avançada com filtros, colunas, saved views, bulk edit, CSV.', 'Tabelas', 'smart-table', ARRAY['--card','--border','--muted'], 70,
'SmartTable (tanstack/react-table): toolbar com search, filtros avançados, dropdown de colunas (visibilidade + reorder), saved views em BD, export CSV, seleção múltipla + bulk edit. Cabeçalhos ordenáveis, resize, edição inline. Row grouping opcional. Estado persistido em localStorage.',
'@tanstack/react-table SmartTable: search toolbar, per-column filters, columns dropdown (visibility+reorder), DB saved views, CSV export, multi-select bulk edit. Sortable headers, resize, inline editing. Optional grouping. localStorage persistence.',
'<SmartTable data={rows} columns={cols} editableColumns={["notas"]} storageKey="pagamentos" />'),

('Inline Edit Cell', 'Célula editável em linha para texto e enums.', 'Formulários', 'inline-edit', ARRAY['--card','--primary'], 80,
'Célula editável inline: mostra valor text-sm; ao clicar vira Input/Select; guarda no blur/Enter, cancela no Escape. Estado a guardar + toast erro. Para enums abre Popover.',
'Inline editable cell: shows text-sm value; click swaps to Input/Select; saves on blur/Enter, cancels on Escape. Saving state + error toast. Enums open Popover.',
'<InlineEditCell value={row.notas} onSave={v => update.mutateAsync({id: row.id, notas: v})} />'),

('Sheet Lateral de Edição', 'Sheet direito para editar/criar entidades sem sair da página.', 'Formulários', 'edit-sheet', ARRAY['--card','--border'], 90,
'Sheet lateral direito (w-full sm:max-w-lg), flex-col: header (título+descrição), form scrollável, footer sticky com Cancelar/Guardar. Fecha ao guardar. Toasts de feedback.',
'Right Sheet (w-full sm:max-w-lg), flex-col: header, scrollable form, sticky footer (Cancel/Save). Closes on save. Feedback toasts.',
'<Sheet open={open} onOpenChange={setOpen}>
  <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
    <SheetHeader><SheetTitle>Editar</SheetTitle></SheetHeader>
    <div className="flex-1 overflow-y-auto py-4 space-y-4">{/* form */}</div>
    <SheetFooter><Button onClick={save}>Guardar</Button></SheetFooter>
  </SheetContent>
</Sheet>'),

('AcoesHoverSummary', 'Badge com popover que fetcha últimas ações da pessoa/família.', 'Dados', 'acoes-hover', ARRAY['--primary'], 100,
'Badge "X ações" que abre Popover ao hover/click com últimas 20-30 inscrições. Fetch via react-query só quando abre (enabled:open). Skeleton loading. Linha: nome + data + status colorido.',
'"X actions" Badge opens Popover on hover/click with last 20-30 inscriptions. Fetches only when open. Skeleton loading. Row: name + date + colored status.',
'<Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger asChild><Badge variant="secondary" className="cursor-pointer">{count} ações</Badge></PopoverTrigger>
  <PopoverContent className="w-80 p-0">{/* lista */}</PopoverContent>
</Popover>'),

('Command Palette (⌘K)', 'Palette global para navegação e ações rápidas.', 'Navegação', 'command-palette', ARRAY['--card','--primary'], 110,
'CommandDialog (cmdk via shadcn) aberto com Ctrl/Cmd+K. Groups: Navegação, Ações Rápidas, Pesquisa. Cada item: ícone lucide + label + shortcut opcional. Fecha ao selecionar.',
'CommandDialog opened with Ctrl/Cmd+K. Groups: Navigation, Quick Actions, Search. Item: lucide icon + label + optional shortcut. Closes on select.',
'<CommandDialog open={open} onOpenChange={setOpen}>
  <CommandInput placeholder="Escrever comando..." />
  <CommandList>
    <CommandGroup heading="Navegação">
      <CommandItem onSelect={()=>navigate({to:"/dashboard"})}><Home />Dashboard</CommandItem>
    </CommandGroup>
  </CommandList>
</CommandDialog>'),

('Sidebar com Grupos', 'Sidebar shadcn com grupos colapsáveis e mini variant.', 'Navegação', 'sidebar-groups', ARRAY['--sidebar','--sidebar-primary'], 120,
'Sidebar collapsible="icon": grupos (GESTÃO, ADMIN) colapsáveis, items com ícone + label, active state bg-sidebar-primary/10 text-sidebar-primary. Trigger no header (sempre visível). Colapsa para w-14.',
'Sidebar collapsible="icon": collapsible groups, icon+label items, active bg-sidebar-primary/10. Trigger in header. Collapses to w-14.',
'<Sidebar collapsible="icon">
  <SidebarContent>
    <SidebarGroup>
      <SidebarGroupLabel>Gestão</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive}>
            <Link to="/casos"><Folder />Casos</Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  </SidebarContent>
</Sidebar>'),

('Tabs com Ícones', 'Tabs shadcn com ícone lucide antes do label.', 'Navegação', 'tabs-icons', ARRAY['--primary','--muted'], 130,
'Tabs shadcn com TabsList grid-cols-N max-w-Ml. TabsTrigger com ícone h-3.5 w-3.5 mr-1.5 + label.',
'shadcn Tabs with grid-cols-N TabsList. TabsTrigger with h-3.5 icon + label.',
'<Tabs defaultValue="a">
  <TabsList className="grid grid-cols-3 max-w-md">
    <TabsTrigger value="a"><Palette className="h-3.5 w-3.5 mr-1.5" />Cores</TabsTrigger>
  </TabsList>
</Tabs>'),

('Dialog Adicionar (Famílias)', 'Dialog com tabs internas e famílias expansíveis com toggles.', 'Formulários', 'add-dialog-family', ARRAY['--primary','--muted'], 140,
'Dialog max-w-4xl com Tabs internas (Pessoas, Famílias). Família: checkbox, chevron expand, círculo inicial, nome, badges direito, contagem ações. Expande para membros (checkbox + idade + género). Toggles "+ KM" e "+ Bolsa" imediatos.',
'Dialog max-w-4xl with internal Tabs. Family row: checkbox, expand chevron, initial circle, name, badges, action count. Expands to members (checkbox+age+gender). Immediate "+ KM"/"+ Bolsa" toggles.',
'<Dialog><DialogContent className="max-w-4xl">
  <Tabs>
    <TabsList><TabsTrigger value="p">Pessoas</TabsTrigger><TabsTrigger value="f">Famílias</TabsTrigger></TabsList>
  </Tabs>
</DialogContent></Dialog>'),

('Confirm Delete + Toast', 'AlertDialog de confirmação + toast sonner.', 'Feedback', 'confirm-delete', ARRAY['--destructive'], 150,
'AlertDialog: título "Tens a certeza?", descrição, botões Cancelar / Apagar (destructive). Sucesso: toast.success; erro: toast.error. Invalida queries.',
'AlertDialog: "Are you sure?" title, description, Cancel/Delete (destructive). Success/error toasts. Invalidates queries.',
'<AlertDialog>
  <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 /></Button></AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader><AlertDialogTitle>Apagar?</AlertDialogTitle></AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction onClick={()=>del.mutate()}>Apagar</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>');
