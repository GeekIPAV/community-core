
-- 1) Fix acoes: split anon vs authenticated SELECT policies
DROP POLICY IF EXISTS acoes_select_all ON public.acoes;

CREATE POLICY acoes_select_anon ON public.acoes
  FOR SELECT TO anon
  USING (publico = true AND restrito_a_projetos = false);

CREATE POLICY acoes_select_authenticated ON public.acoes
  FOR SELECT TO authenticated
  USING (true);

-- 2) Realtime: restrict channel subscriptions to user-owned topics.
-- Notification channels follow the convention "notif-<auth.uid()>".
-- Other topics (broadcast/presence) remain open to authenticated users.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users own notification topic" ON realtime.messages;
CREATE POLICY "Authenticated users own notification topic"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    -- Allow non-notification topics; for notif-* require ownership
    (realtime.topic() NOT LIKE 'notif-%')
    OR (realtime.topic() = 'notif-' || (auth.uid())::text)
  );
