
-- ============ TABLES ============
CREATE TABLE public.sidebar_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  icon text,
  position integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  visible_to text[] NOT NULL DEFAULT ARRAY['admin','staff','user']::text[],
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sidebar_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.sidebar_groups(id) ON DELETE CASCADE,
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  url text NOT NULL,
  icon text NOT NULL DEFAULT 'Circle',
  position integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  visible_to text[] NOT NULL DEFAULT ARRAY['admin','staff']::text[],
  badge_query text,
  sub_group text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sidebar_items_group ON public.sidebar_items(group_id);

GRANT SELECT ON public.sidebar_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sidebar_groups TO authenticated;
GRANT ALL ON public.sidebar_groups TO service_role;
GRANT SELECT ON public.sidebar_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sidebar_items TO authenticated;
GRANT ALL ON public.sidebar_items TO service_role;

ALTER TABLE public.sidebar_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sidebar_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sg_read_all_authenticated" ON public.sidebar_groups
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "sg_admin_write" ON public.sidebar_groups
  FOR ALL TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

CREATE POLICY "si_read_all_authenticated" ON public.sidebar_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "si_admin_write" ON public.sidebar_items
  FOR ALL TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

CREATE TRIGGER tg_sg_updated BEFORE UPDATE ON public.sidebar_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_si_updated BEFORE UPDATE ON public.sidebar_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ count_duplicates RPC ============
CREATE OR REPLACE FUNCTION public.count_duplicates()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.pessoas WHERE status = 'suspeito_duplicado';
$$;
GRANT EXECUTE ON FUNCTION public.count_duplicates() TO authenticated;

-- ============ SEED ============
INSERT INTO public.sidebar_groups (key, label, position, is_visible, visible_to, is_system) VALUES
  ('community',     'Comunidade',                1, true, ARRAY['admin','staff','user'],         true),
  ('participantes', 'Gestão de Participantes',   2, true, ARRAY['admin','staff'],                true),
  ('acoes',         'Ações & Atividades',        3, true, ARRAY['admin','staff'],                true),
  ('servicos',      'Serviços & Pagamentos',     4, true, ARRAY['admin','staff'],                true),
  ('admin',         'Administração',             5, true, ARRAY['admin'],                        true);

INSERT INTO public.sidebar_items (group_id, key, label, url, icon, position, visible_to, badge_query, sub_group, is_system)
SELECT g.id, x.key, x.label, x.url, x.icon, x.position, x.visible_to, x.badge_query, x.sub_group, true
FROM public.sidebar_groups g
JOIN (VALUES
  -- community
  ('community','portal','Portal Público','/','Globe',1, ARRAY['admin','staff','user']::text[], NULL::text, NULL::text),
  ('community','resultados','Resultados','/resultados','BarChart3',2, ARRAY['admin','staff','user'], NULL, NULL),
  ('community','perfil','O Meu Perfil','/perfil','User',3, ARRAY['admin','staff','user'], NULL, NULL),
  ('community','meus-servicos','Os Meus Serviços','/meus-servicos','Wallet',4, ARRAY['user','staff','admin'], NULL, NULL),
  -- participantes
  ('participantes','participantes','Participantes','/participantes','Users',1, ARRAY['admin','staff'], NULL, NULL),
  ('participantes','familias','Famílias','/familias','Users2',2, ARRAY['admin','staff'], NULL, NULL),
  ('participantes','projetos','Projetos','/projetos','Briefcase',3, ARRAY['admin','staff'], NULL, NULL),
  ('participantes','duplicados','Duplicados','/duplicados','AlertTriangle',4, ARRAY['admin','staff'], 'count_duplicates', NULL),
  -- acoes
  ('acoes','acoes','Ações','/acoes','CalendarDays',1, ARRAY['admin','staff'], NULL, NULL),
  ('acoes','atividades','Atividades','/atividades','Activity',2, ARRAY['admin','staff'], NULL, NULL),
  -- servicos (collapsible sub-menu)
  ('servicos','servicos-painel','Painel','/servicos','Wallet',1, ARRAY['admin','staff'], NULL, 'Serviços & Pagamentos'),
  ('servicos','servicos-calendario','Calendário','/servicos','CalendarDays',2, ARRAY['admin','staff'], NULL, 'Serviços & Pagamentos'),
  -- admin
  ('admin','dashboard','Painel','/dashboard','LayoutDashboard',1, ARRAY['admin','staff'], NULL, NULL),
  ('admin','bolsas','Bolsa de Transporte','/bolsas-transporte','Bus',2, ARRAY['admin','staff'], NULL, NULL),
  ('admin','localizacoes','Localizações','/localizacoes','MapPin',3, ARRAY['admin','staff'], NULL, NULL),
  ('admin','curriculos','Currículos','/curriculos','FileText',4, ARRAY['admin','staff'], NULL, NULL),
  ('admin','emails','Emails','/emails','Mail',5, ARRAY['admin','staff'], NULL, NULL),
  ('admin','menu','Gestão do Menu','/menu','Settings2',6, ARRAY['admin'], NULL, NULL),
  ('admin','tipos-user','Tipos de Utilizador','/tipos-user','UserCog',7, ARRAY['admin'], NULL, NULL),
  ('admin','eliminados','Eliminados','/eliminados','Trash2',8, ARRAY['admin'], NULL, NULL),
  ('admin','security','Segurança','/security','ShieldAlert',9, ARRAY['admin'], NULL, NULL)
) AS x(group_key,key,label,url,icon,position,visible_to,badge_query,sub_group)
ON g.key = x.group_key;
