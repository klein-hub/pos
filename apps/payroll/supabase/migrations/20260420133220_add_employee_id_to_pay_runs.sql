/*
  # Add employee_id to pay_runs

  1. Changes
    - Adds an optional `employee_id` column on `pay_runs` so a pay run can
      target a single employee (individual run) instead of a whole pay group.
    - Foreign key to `employees(id)` with ON DELETE SET NULL so deleting an
      employee does not destroy their historical pay run records.
    - Adds an index on `employee_id` for quick lookup.

  2. Security
    - No policy changes required; existing `pay_runs` RLS applies.

  3. Notes
    - Nullable, so all existing group/all-employees pay runs remain valid.
    - When both `pay_group_id` and `employee_id` are null, the run targets
      all active employees (legacy behavior).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pay_runs' AND column_name = 'employee_id'
  ) THEN
    ALTER TABLE pay_runs
      ADD COLUMN employee_id bigint REFERENCES employees(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS pay_runs_employee_id_idx ON pay_runs(employee_id);
