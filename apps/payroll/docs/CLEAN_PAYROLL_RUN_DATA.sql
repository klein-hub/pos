BEGIN;

UPDATE public.employees
SET pay_group_id = NULL,
    pay_template_id = NULL
WHERE pay_group_id IS NOT NULL
   OR pay_template_id IS NOT NULL;

DELETE FROM public.payments;
DELETE FROM public.payroll_lines;
DELETE FROM public.payroll_entries;
DELETE FROM public.payroll_inputs;
DELETE FROM public.pay_runs;
DELETE FROM public.payroll_warnings;
DELETE FROM public.payroll_records;

COMMIT;