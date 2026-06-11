
-- 1. Add tracking columns to acoes
ALTER TABLE public.acoes
  ADD COLUMN IF NOT EXISTS google_event_id text,
  ADD COLUMN IF NOT EXISTS google_sync_origin text;

CREATE UNIQUE INDEX IF NOT EXISTS acoes_google_event_id_key
  ON public.acoes (google_event_id)
  WHERE google_event_id IS NOT NULL;

-- 2. Sync state table (single row keyed by id='primary')
CREATE TABLE IF NOT EXISTS public.google_calendar_sync_state (
  id text PRIMARY KEY,
  sync_token text,
  channel_id text,
  channel_resource_id text,
  channel_expires_at timestamptz,
  last_synced_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_calendar_sync_state TO authenticated;
GRANT ALL ON public.google_calendar_sync_state TO service_role;

ALTER TABLE public.google_calendar_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage google calendar sync state"
  ON public.google_calendar_sync_state
  FOR ALL
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

CREATE TRIGGER google_calendar_sync_state_updated_at
  BEFORE UPDATE ON public.google_calendar_sync_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
