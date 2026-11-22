/*
  # Reset payroll module data

  1. Clears payroll runtime data
    - pay_runs, payroll_entries, payroll_lines, payroll_inputs
    - legacy payroll_records and payroll_warnings

  2. Clears payroll configuration data
    - pay_groups, pay_templates, pay_components, pay_component_groups
    - pay_constants and work_entry_types

  3. Unlinks employees from removed payroll references
    - sets pay_group_id and pay_template_id to null

  Notes
    - Uses existence checks so it is safe across environments with slightly
      different schema history.
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employees'
      AND column_name = 'pay_group_id'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employees'
      AND column_name = 'pay_template_id'
  ) THEN
    UPDATE public.employees
    SET pay_group_id = NULL,
        pay_template_id = NULL
    WHERE pay_group_id IS NOT NULL OR pay_template_id IS NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payroll_lines') THEN
    DELETE FROM public.payroll_lines;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payroll_entries') THEN
    DELETE FROM public.payroll_entries;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payroll_inputs') THEN
    DELETE FROM public.payroll_inputs;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pay_runs') THEN
    DELETE FROM public.pay_runs;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pay_component_groups') THEN
    DELETE FROM public.pay_component_groups;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pay_components') THEN
    DELETE FROM public.pay_components;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pay_templates') THEN
    DELETE FROM public.pay_templates;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pay_groups') THEN
    DELETE FROM public.pay_groups;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pay_constants') THEN
    DELETE FROM public.pay_constants;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'work_entry_types') THEN
    DELETE FROM public.work_entry_types;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payroll_warnings') THEN
    DELETE FROM public.payroll_warnings;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payroll_records') THEN
    DELETE FROM public.payroll_records;
  END IF;
END $$;