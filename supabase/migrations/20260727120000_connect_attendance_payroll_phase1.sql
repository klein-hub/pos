/*
  # Phase 1 — Connect attendance-tracker <-> payroll (identity + tenant integrity)

  Live is the source of truth (shared multi-app DB). This migration is additive and
  idempotent. It wires the two apps together on the confirmed join keys:
    - identity : attendance.user_id = profiles.id = auth.users.id = employees.auth_user_id
    - tenant   : company_id (uuid) on companies / employees / profiles / attendance

  Changes:
    1. attendance.user_id: drop bogus gen_random_uuid() default; add FK to profiles.
    2. Backfill attendance.company_id from the matching employee; trigger to keep it set.
    3. Drop the duplicate FK on employees.company_id.
    4. Add missing FKs: profiles.company_id -> companies, leaves.employee_id -> employees
       (NOT VALID so legacy rows can't block the migration).
    5. Add RLS policies to leaves and attendance_approvals (were RLS-on with 0 policies).
    6. Create security-invoker view attendance_with_employee for payroll consumption.

  Reuses existing live helper functions: is_super_admin(), is_company_admin(uuid).
*/

BEGIN;

-- 1. attendance.user_id integrity ------------------------------------------------
ALTER TABLE public.attendance ALTER COLUMN user_id DROP DEFAULT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='attendance'
      AND constraint_name='attendance_user_id_fkey'
  ) THEN
    ALTER TABLE public.attendance
      ADD CONSTRAINT attendance_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. attendance.company_id backfill + trigger -----------------------------------
UPDATE public.attendance a
SET company_id = e.company_id
FROM public.employees e
WHERE a.company_id IS NULL
  AND e.auth_user_id = a.user_id
  AND e.company_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.attendance_set_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT e.company_id INTO NEW.company_id
    FROM public.employees e
    WHERE e.auth_user_id = NEW.user_id
      AND e.company_id IS NOT NULL
    LIMIT 1;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_attendance_set_company_id ON public.attendance;
CREATE TRIGGER trg_attendance_set_company_id
  BEFORE INSERT ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.attendance_set_company_id();

-- 3. Remove duplicate FK on employees.company_id (keep exactly one) --------------
DO $$
DECLARE c text; n int := 0;
BEGIN
  FOR c IN
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema   = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name   = 'employees'
      AND kcu.column_name = 'company_id'
    ORDER BY tc.constraint_name
  LOOP
    n := n + 1;
    IF n > 1 THEN
      EXECUTE format('ALTER TABLE public.employees DROP CONSTRAINT %I', c);
    END IF;
  END LOOP;
END $$;

-- 4. Missing FKs (NOT VALID: don't fail on any legacy orphan rows) ---------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='profiles'
      AND constraint_name='profiles_company_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='leaves'
      AND constraint_name='leaves_employee_id_fkey'
  ) THEN
    ALTER TABLE public.leaves
      ADD CONSTRAINT leaves_employee_id_fkey
      FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

-- 5. RLS for previously-locked tables -------------------------------------------
-- leaves: employee sees/creates own; company admins & super admin manage.
DROP POLICY IF EXISTS leaves_select ON public.leaves;
CREATE POLICY leaves_select ON public.leaves FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR EXISTS (SELECT 1 FROM public.employees e
             WHERE e.id = leaves.employee_id
               AND (e.auth_user_id = auth.uid() OR is_company_admin(e.company_id)))
);

DROP POLICY IF EXISTS leaves_insert ON public.leaves;
CREATE POLICY leaves_insert ON public.leaves FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.employees e
          WHERE e.id = leaves.employee_id
            AND (e.auth_user_id = auth.uid() OR is_company_admin(e.company_id)))
);

DROP POLICY IF EXISTS leaves_update ON public.leaves;
CREATE POLICY leaves_update ON public.leaves FOR UPDATE TO authenticated
USING (
  is_super_admin()
  OR EXISTS (SELECT 1 FROM public.employees e
             WHERE e.id = leaves.employee_id AND is_company_admin(e.company_id))
);

DROP POLICY IF EXISTS leaves_delete ON public.leaves;
CREATE POLICY leaves_delete ON public.leaves FOR DELETE TO authenticated
USING (
  is_super_admin()
  OR EXISTS (SELECT 1 FROM public.employees e
             WHERE e.id = leaves.employee_id AND is_company_admin(e.company_id))
);

-- attendance_approvals: scoped through the parent attendance row's company.
DROP POLICY IF EXISTS attendance_approvals_select ON public.attendance_approvals;
CREATE POLICY attendance_approvals_select ON public.attendance_approvals FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR EXISTS (SELECT 1 FROM public.attendance a
             WHERE a.id = attendance_approvals.attendance_id
               AND (a.user_id = auth.uid() OR is_company_admin(a.company_id)))
);

DROP POLICY IF EXISTS attendance_approvals_write ON public.attendance_approvals;
CREATE POLICY attendance_approvals_write ON public.attendance_approvals FOR ALL TO authenticated
USING (
  is_super_admin()
  OR EXISTS (SELECT 1 FROM public.attendance a
             WHERE a.id = attendance_approvals.attendance_id
               AND is_company_admin(a.company_id))
)
WITH CHECK (
  is_super_admin()
  OR EXISTS (SELECT 1 FROM public.attendance a
             WHERE a.id = attendance_approvals.attendance_id
               AND is_company_admin(a.company_id))
);

-- 6. Payroll-facing view: attendance joined to the payroll employee -------------
CREATE OR REPLACE VIEW public.attendance_with_employee
WITH (security_invoker = true) AS
SELECT
  a.id            AS attendance_id,
  a.user_id,
  a.company_id,
  a.time_in,
  a.time_out,
  a.work_hours,
  a.approval_status,
  a.selfie_in_url,
  a.selfie_out_url,
  a.location_in,
  a.location_out,
  (a.time_in AT TIME ZONE 'Asia/Manila')::date AS work_date,
  CASE WHEN a.time_out IS NOT NULL
       THEN EXTRACT(EPOCH FROM (a.time_out - a.time_in)) / 3600.0
  END AS hours_worked,
  e.id            AS employee_id,
  e.first_name,
  e.last_name,
  e.department_id,
  e.project_id,
  e.pay_group_id,
  e.pay_template_id
FROM public.attendance a
LEFT JOIN public.employees e ON e.auth_user_id = a.user_id;

COMMIT;
