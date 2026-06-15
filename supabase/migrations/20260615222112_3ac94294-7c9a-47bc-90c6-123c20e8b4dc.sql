
CREATE TABLE public.security_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector text NOT NULL,
  external_id text,
  title text NOT NULL,
  description text,
  severity text NOT NULL DEFAULT 'info',
  status text NOT NULL DEFAULT 'open',
  resource text,
  url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connector, external_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_findings TO authenticated;
GRANT ALL ON public.security_findings TO service_role;

ALTER TABLE public.security_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "security_findings_admin_all"
  ON public.security_findings
  FOR ALL
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

CREATE TRIGGER security_findings_set_updated_at
  BEFORE UPDATE ON public.security_findings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.security_finding_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id uuid NOT NULL REFERENCES public.security_findings(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text,
  event_type text NOT NULL,
  from_status text,
  to_status text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.security_finding_events TO authenticated;
GRANT ALL ON public.security_finding_events TO service_role;

ALTER TABLE public.security_finding_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "security_finding_events_admin_select"
  ON public.security_finding_events
  FOR SELECT
  TO authenticated
  USING (public.is_current_user_admin());

CREATE POLICY "security_finding_events_admin_insert"
  ON public.security_finding_events
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_current_user_admin());

CREATE INDEX security_findings_connector_idx ON public.security_findings(connector);
CREATE INDEX security_findings_status_idx ON public.security_findings(status);
CREATE INDEX security_finding_events_finding_idx ON public.security_finding_events(finding_id, created_at DESC);

-- Trigger to log status changes automatically
CREATE OR REPLACE FUNCTION public.log_security_finding_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_name text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT nome_completo INTO v_name FROM public.pessoas WHERE auth_user_id = v_actor LIMIT 1;
    INSERT INTO public.security_finding_events (finding_id, actor_id, actor_name, event_type, from_status, to_status)
    VALUES (NEW.id, v_actor, v_name, 'status_change', OLD.status, NEW.status);
  ELSIF TG_OP = 'INSERT' THEN
    SELECT nome_completo INTO v_name FROM public.pessoas WHERE auth_user_id = v_actor LIMIT 1;
    INSERT INTO public.security_finding_events (finding_id, actor_id, actor_name, event_type, to_status)
    VALUES (NEW.id, v_actor, v_name, 'created', NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER security_findings_log_status
  AFTER INSERT OR UPDATE ON public.security_findings
  FOR EACH ROW EXECUTE FUNCTION public.log_security_finding_status_change();
