/*
  # Phase 3 — Company kiosk devices

  A "device" is a shared company kiosk authenticated by a long-lived api_token
  (validated server-side with the service role). Employees pick their name on the
  device and clock in/out; the device is scoped to one company via company_id.

  Standardized on company_id (not the abandoned business_id). Reuses live helpers
  is_super_admin() / is_company_admin(uuid) for admin management via RLS. Token
  validation happens in the API with the service role, which bypasses RLS.
*/

CREATE TABLE IF NOT EXISTS public.devices (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  device_name  text NOT NULL,
  api_token    text NOT NULL UNIQUE,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at   timestamptz DEFAULT now(),
  last_seen_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_devices_company_id ON public.devices(company_id);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS devices_admin_select ON public.devices;
CREATE POLICY devices_admin_select ON public.devices FOR SELECT TO authenticated
USING (is_super_admin() OR is_company_admin(company_id));

DROP POLICY IF EXISTS devices_admin_write ON public.devices;
CREATE POLICY devices_admin_write ON public.devices FOR ALL TO authenticated
USING (is_super_admin() OR is_company_admin(company_id))
WITH CHECK (is_super_admin() OR is_company_admin(company_id));
