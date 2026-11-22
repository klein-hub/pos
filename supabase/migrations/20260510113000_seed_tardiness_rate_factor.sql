/*
  # Seed Tardiness Rate Factor Constant

  1. New Row in `pay_constants`
    - `TARDINESS_RATE_FACTOR` = `OT_REGULAR_DAY_MULTIPLIER / REGULAR_WORK_HOURS_PER_DAY / 60`
    - Used by pay component formulas to convert daily rate into a per-minute tardiness rate.

  2. Notes
    - Stored as a formula constant so it stays editable and transparent in configuration.
    - `value` stores the current computed numeric factor for runtime reads.
    - Safe to re-run due to `ON CONFLICT (code) DO NOTHING`.
*/

INSERT INTO pay_constants (code, name, value, category, description, value_type, formula_tokens)
VALUES (
  'TARDINESS_RATE_FACTOR',
  'Tardiness Rate Factor',
  1.25 / 8 / 60,
  'general',
  'Minute-rate factor for tardiness deduction: OT Regular Day Multiplier divided by Regular Work Hours Per Day divided by 60.',
  'formula',
  '[
    {"type":"constant","code":"OT_REGULAR_DAY_MULTIPLIER"},
    {"type":"op","op":"/"},
    {"type":"constant","code":"REGULAR_WORK_HOURS_PER_DAY"},
    {"type":"op","op":"/"},
    {"type":"number","val":60}
  ]'::jsonb
)
ON CONFLICT (code) DO NOTHING;