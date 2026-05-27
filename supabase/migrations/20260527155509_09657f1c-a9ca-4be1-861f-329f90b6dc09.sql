DROP POLICY IF EXISTS pessoas_self_link ON public.pessoas;

CREATE POLICY pessoas_self_link ON public.pessoas
FOR UPDATE
TO authenticated
USING (
  auth_user_id IS NULL
  AND is_admin = false
  AND (auth.jwt() ->> 'email') IS NOT NULL
  AND lower(email) = lower(auth.jwt() ->> 'email')
)
WITH CHECK (
  auth_user_id = auth.uid()
  AND is_admin = false
  AND lower(email) = lower(auth.jwt() ->> 'email')
);