/*
  # Phase 3 — Break/meal tracking + kiosk (timekeeper) write access

  - attendance_breaks: break/meal segments within a work session (no selfie/location;
    only Time-In/Out capture those).
  - is_company_timekeeper(company_id): like is_company_admin but also allows the
    'timekeeper' and 'business_admin' roles to operate the kiosk (punch employees).
  - RLS: employees manage their own attendance/breaks; timekeepers/admins can punch
    any employee in their company (for admin-login kiosk mode). The device-token
    kiosk path writes via the service role and bypasses RLS.
*/

BEGIN;

-- ── Timekeeper helper ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_company_timekeeper(company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.company_id = $1
      AND LOWER(REPLACE(COALESCE(p.role, ''), ' ', '_'))
          IN ('admin', 'super_admin', 'business_admin', 'timekeeper')
  ) OR public.is_super_admin();
$$;

GRANT EXECUTE ON FUNCTION public.is_company_timekeeper(uuid) TO authenticated, service_role;

-- ── attendance_breaks ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance_breaks (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attendance_id bigint NOT NULL REFERENCES public.attendance(id) ON DELETE CASCADE,
  break_type    text NOT NULL CHECK (break_type IN ('break', 'meal')),
  start_at      timestamptz NOT NULL DEFAULT now(),
  end_at        timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_breaks_attendance
  ON public.attendance_breaks(attendance_id);
-- At most one open break/meal per session is enforced in app logic; this partial
-- index makes the "is there an open break?" lookup fast.
CREATE INDEX IF NOT EXISTS idx_attendance_breaks_open
  ON public.attendance_breaks(attendance_id) WHERE end_at IS NULL;

ALTER TABLE public.attendance_breaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attendance_breaks_select ON public.attendance_breaks;
CREATE POLICY attendance_breaks_select ON public.attendance_breaks FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.attendance a
  WHERE a.id = attendance_breaks.attendance_id
    AND (a.user_id = auth.uid() OR is_company_timekeeper(a.company_id))
));

DROP POLICY IF EXISTS attendance_breaks_write ON public.attendance_breaks;
CREATE POLICY attendance_breaks_write ON public.attendance_breaks FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.attendance a
  WHERE a.id = attendance_breaks.attendance_id
    AND (a.user_id = auth.uid() OR is_company_timekeeper(a.company_id))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.attendance a
  WHERE a.id = attendance_breaks.attendance_id
    AND (a.user_id = auth.uid() OR is_company_timekeeper(a.company_id))
));

-- ── Kiosk write access on attendance (timekeeper punches employees) ────────────
DROP POLICY IF EXISTS attendance_kiosk_insert ON public.attendance;
CREATE POLICY attendance_kiosk_insert ON public.attendance FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id OR is_company_timekeeper(company_id));

DROP POLICY IF EXISTS attendance_kiosk_update ON public.attendance;
CREATE POLICY attendance_kiosk_update ON public.attendance FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR is_company_timekeeper(company_id))
WITH CHECK (auth.uid() = user_id OR is_company_timekeeper(company_id));

COMMIT;
