/*
  # Seed Pay Template & Pay Components from Philippine Labor Code

  Adds a pre-built Pay Template ("Philippines Regular Pay") along with a
  complete set of Pay Components that mirror the rules and rates defined in
  `src/lib/laborCode.ts`:

  Earnings:
    - BASIC          Base monthly pay
    - OVERTIME       Overtime pay (input, 1.25x default)
    - NIGHT_DIFF     Night shift differential (input, 10% on top)
    - HOLIDAY_PAY    Regular / special holiday premiums (input)
    - BONUS          One-off bonuses (input)
    - GROSS          Computed: BASIC + OVERTIME + NIGHT_DIFF + HOLIDAY_PAY + BONUS

  Deductions (Philippine mandatory contributions):
    - SSS         4.5%  of BASIC (R.A. 11199)
    - PHILHEALTH  2.5%  of BASIC (R.A. 11223)
    - PAGIBIG     2.0%  of BASIC, capped at 100 (R.A. 9679)
    - TAX         Simplified BIR TRAIN Law monthly withholding
    - OTHER_DED   Other deductions (input)

  Net:
    - NET         GROSS - SSS - PHILHEALTH - PAGIBIG - TAX - OTHER_DED

  The seeding is idempotent — if a template with the same name already
  exists, the components are not duplicated.
*/

DO $$
DECLARE
  template_id bigint;
BEGIN
  SELECT id INTO template_id FROM pay_templates WHERE name = 'Philippines Regular Pay' LIMIT 1;

  IF template_id IS NULL THEN
    INSERT INTO pay_templates (name, description, active)
    VALUES (
      'Philippines Regular Pay',
      'Default pay template aligned with the Philippine Labor Code (SSS, PhilHealth, Pag-IBIG, BIR TRAIN).',
      true
    )
    RETURNING id INTO template_id;

    INSERT INTO pay_components
      (pay_template_id, name, code, category, sequence, condition_type,
       computation_type, amount, percentage, percentage_of_code, formula)
    VALUES
      -- Earnings
      (template_id, 'Basic Pay',                 'BASIC',       'earning',   10, 'always',     'formula',    0,    0,   '',      'BASE_PAY'),
      (template_id, 'Overtime Pay',              'OVERTIME',    'earning',   20, 'input',      'fixed',      0,    0,   '',      ''),
      (template_id, 'Night Shift Differential',  'NIGHT_DIFF',  'earning',   30, 'input',      'fixed',      0,    0,   '',      ''),
      (template_id, 'Holiday Pay',               'HOLIDAY_PAY', 'earning',   40, 'input',      'fixed',      0,    0,   '',      ''),
      (template_id, 'Bonus',                     'BONUS',       'earning',   50, 'input',      'fixed',      0,    0,   '',      ''),
      (template_id, 'Gross Pay',                 'GROSS',       'earning',   60, 'always',     'formula',    0,    0,   '',      'BASIC + OVERTIME + NIGHT_DIFF + HOLIDAY_PAY + BONUS'),

      -- Mandatory deductions based on laborCode.ts constants
      (template_id, 'SSS Contribution',          'SSS',         'deduction', 70, 'always',     'percentage', 0,    4.5, 'BASIC', ''),
      (template_id, 'PhilHealth Contribution',   'PHILHEALTH',  'deduction', 80, 'always',     'percentage', 0,    2.5, 'BASIC', ''),
      (template_id, 'Pag-IBIG Contribution',     'PAGIBIG',     'deduction', 90, 'always',     'formula',    0,    0,   '',      'Math.min(100, BASIC * 0.02)'),
      (template_id, 'Withholding Tax',           'TAX',         'deduction', 100,'always',     'formula',    0,    0,   '',
        '((GROSS - SSS - PHILHEALTH - PAGIBIG) * 12) <= 250000 ? 0 : ' ||
        '(((GROSS - SSS - PHILHEALTH - PAGIBIG) * 12) <= 400000 ? ' ||
          '((((GROSS - SSS - PHILHEALTH - PAGIBIG) * 12) - 250000) * 0.15) / 12 : ' ||
        '(((GROSS - SSS - PHILHEALTH - PAGIBIG) * 12) <= 800000 ? ' ||
          '(22500 + ((((GROSS - SSS - PHILHEALTH - PAGIBIG) * 12) - 400000) * 0.20)) / 12 : ' ||
        '(((GROSS - SSS - PHILHEALTH - PAGIBIG) * 12) <= 2000000 ? ' ||
          '(102500 + ((((GROSS - SSS - PHILHEALTH - PAGIBIG) * 12) - 800000) * 0.25)) / 12 : ' ||
        '(((GROSS - SSS - PHILHEALTH - PAGIBIG) * 12) <= 8000000 ? ' ||
          '(402500 + ((((GROSS - SSS - PHILHEALTH - PAGIBIG) * 12) - 2000000) * 0.30)) / 12 : ' ||
          '(2202500 + ((((GROSS - SSS - PHILHEALTH - PAGIBIG) * 12) - 8000000) * 0.35)) / 12))))'
      ),
      (template_id, 'Other Deductions',          'OTHER_DED',   'deduction', 110,'input',      'fixed',      0,    0,   '',      ''),

      -- Net
      (template_id, 'Net Pay',                   'NET',         'net',       200,'always',     'formula',    0,    0,   '',      'GROSS - SSS - PHILHEALTH - PAGIBIG - TAX - OTHER_DED');
  END IF;
END $$;

-- Seed a default Pay Group if none exist
INSERT INTO pay_groups (name, description, pay_schedule, wage_type, active)
SELECT 'Monthly Staff', 'Default group for monthly-paid employees', 'monthly', 'fixed', true
WHERE NOT EXISTS (SELECT 1 FROM pay_groups);
