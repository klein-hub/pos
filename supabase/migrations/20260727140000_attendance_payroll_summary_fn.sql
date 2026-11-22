/*
  # Phase 2 — Attendance → payroll compute bridge

  compute_attendance_summary(employee_id, period_start, period_end) aggregates the
  punch-based attendance rows (joined to the payroll employee via employees.auth_user_id)
  into the numbers the payroll engine consumes:
    - worked_days  : distinct calendar days with a clock-in in the period
    - worked_hours : sum of (time_out - time_in) for closed sessions, in hours
    - sessions     : number of attendance rows (open or closed)

  Timezone is Asia/Manila to match companies.timezone default and the
  attendance_with_employee view. Rejected attendance is excluded.

  Tardiness/OT are intentionally NOT auto-derived here: there is no per-employee
  work-schedule assignment on live yet, so the engine keeps using the manual
  TARDINESS_MINUTES / OT payroll_inputs. Once employees get a work_schedule_id this
  function can be extended to emit late/undertime/OT minutes.
*/

CREATE OR REPLACE FUNCTION public.compute_attendance_summary(
  p_employee_id bigint,
  p_start       date,
  p_end         date
)
RETURNS TABLE(worked_days integer, worked_hours numeric, sessions integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(DISTINCT (a.time_in AT TIME ZONE 'Asia/Manila')::date)::int AS worked_days,
    COALESCE(SUM(
      CASE WHEN a.time_out IS NOT NULL
           THEN EXTRACT(EPOCH FROM (a.time_out - a.time_in)) / 3600.0
      END
    ), 0)::numeric AS worked_hours,
    COUNT(*)::int AS sessions
  FROM public.attendance a
  JOIN public.employees e ON e.auth_user_id = a.user_id
  WHERE e.id = p_employee_id
    AND (a.time_in AT TIME ZONE 'Asia/Manila')::date BETWEEN p_start AND p_end
    AND COALESCE(a.approval_status, 'pending') <> 'rejected';
$$;

-- Let the app roles call it (SECURITY DEFINER runs with owner rights; RLS on
-- attendance is bypassed intentionally so payroll can aggregate all matched rows).
GRANT EXECUTE ON FUNCTION public.compute_attendance_summary(bigint, date, date)
  TO authenticated, service_role;
