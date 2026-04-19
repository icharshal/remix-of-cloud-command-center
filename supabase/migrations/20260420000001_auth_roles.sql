-- ============================================================
-- Auth & Roles setup
-- Adds a user_roles table so we can grant viewer/operator/admin
-- per user. Tied to auth.users via UUID.
-- ============================================================

CREATE TYPE public.app_role AS ENUM ('viewer', 'operator', 'admin');

CREATE TABLE public.user_roles (
  id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        public.app_role NOT NULL DEFAULT 'viewer',
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can read their own role
CREATE POLICY "Users can read own role"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Only admins can insert/update/delete roles
CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- -------------------------------------------------------
-- Helper functions (used inside RLS policies)
-- -------------------------------------------------------

-- Returns the current user's role, or NULL if not found
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Returns true if current user has at least the given role level
-- viewer < operator < admin
CREATE OR REPLACE FUNCTION public.has_role(minimum_role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role public.app_role;
BEGIN
  SELECT role INTO user_role
  FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF user_role IS NULL THEN
    RETURN false;
  END IF;

  RETURN CASE minimum_role
    WHEN 'viewer'   THEN user_role IN ('viewer',   'operator', 'admin')
    WHEN 'operator' THEN user_role IN ('operator', 'admin')
    WHEN 'admin'    THEN user_role = 'admin'
    ELSE false
  END;
END;
$$;

-- -------------------------------------------------------
-- Service role bypass flag for Edge Functions / agents
-- Edge Functions use the service_role key and bypass RLS.
-- Agents use a dedicated anon key scoped to insert only.
-- No additional function needed — service_role bypasses RLS
-- by default in Supabase.
-- -------------------------------------------------------

-- Seed: first user to sign up automatically becomes admin
-- (handled in the Auth trigger below)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO existing_count FROM public.user_roles;
  -- First ever user → admin. Everyone after → viewer.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE WHEN existing_count = 0 THEN 'admin'::public.app_role ELSE 'viewer'::public.app_role END
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
