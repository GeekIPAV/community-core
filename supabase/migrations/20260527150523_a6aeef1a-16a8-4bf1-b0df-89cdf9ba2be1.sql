
-- 1. Harden identity resolution: remove email-based fallback to prevent
--    a newly registered user from being treated as an existing admin
--    pessoa just because emails match.
CREATE OR REPLACE FUNCTION public.current_user_pessoa_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.pessoas
   WHERE auth_user_id = auth.uid()
   LIMIT 1;
$$;

-- 2. Tighten self-link policy: cannot claim an admin record, cannot
--    claim a record already linked to another auth user.
DROP POLICY IF EXISTS pessoas_self_link ON public.pessoas;
CREATE POLICY pessoas_self_link
ON public.pessoas
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

-- 3. Fix mutable search_path on trigger helper.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
