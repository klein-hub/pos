/*
  # Seed NSD OT Pay Constants as Formulas

  1. New Rows in `pay_constants`
    - `NSD_OT_REGULAR_DAY` = OT_REGULAR_DAY_MULTIPLIER * (1 + NIGHT_SHIFT_DIFFERENTIAL_RATE) = 1.375
    - `NSD_OT_REST_DAY`    = OT_REST_DAY_OT_MULTIPLIER  * (1 + NIGHT_SHIFT_DIFFERENTIAL_RATE) = 1.859
    - `NSD_OT_REGULAR_HOLIDAY` = REGULAR_HOLIDAY_OT_MULTIPLIER * (1 + NIGHT_SHIFT_DIFFERENTIAL_RATE) = 2.860

  2. Notes
    - Stored with `value_type = 'formula'` so they re-evaluate when their
      dependencies change.
    - `value` holds the pre-computed result for fast payroll reads.
    - Uses ON CONFLICT (code) DO NOTHING so re-running the migration is safe
      and will not overwrite user-edited values.

  3. Security
    - No policy changes; existing `pay_constants` RLS applies.
*/

INSERT INTO pay_constants (code, name, value, category, description, value_type, formula_tokens)
VALUES
  (
    'NSD_OT_REGULAR_DAY',
    'NSD + OT Regular Day Multiplier',
    1.375,
    'labor_code',
    'Night Shift Differential applied on Regular Day Overtime.',
    'formula',
    '[
      {"type":"constant","code":"OT_REGULAR_DAY_MULTIPLIER"},
      {"type":"op","op":"*"},
      {"type":"op","op":"("},
      {"type":"number","val":1},
      {"type":"op","op":"+"},
      {"type":"constant","code":"NIGHT_SHIFT_DIFFERENTIAL_RATE"},
      {"type":"op","op":")"}
    ]'::jsonb
  ),
  (
    'NSD_OT_REST_DAY',
    'NSD + OT Rest Day Multiplier',
    1.859,
    'labor_code',
    'Night Shift Differential applied on Rest Day Overtime.',
    'formula',
    '[
      {"type":"constant","code":"OT_REST_DAY_OT_MULTIPLIER"},
      {"type":"op","op":"*"},
      {"type":"op","op":"("},
      {"type":"number","val":1},
      {"type":"op","op":"+"},
      {"type":"constant","code":"NIGHT_SHIFT_DIFFERENTIAL_RATE"},
      {"type":"op","op":")"}
    ]'::jsonb
  ),
  (
    'NSD_OT_REGULAR_HOLIDAY',
    'NSD + OT Regular Holiday Multiplier',
    2.860,
    'labor_code',
    'Night Shift Differential applied on Regular Holiday Overtime.',
    'formula',
    '[
      {"type":"constant","code":"REGULAR_HOLIDAY_OT_MULTIPLIER"},
      {"type":"op","op":"*"},
      {"type":"op","op":"("},
      {"type":"number","val":1},
      {"type":"op","op":"+"},
      {"type":"constant","code":"NIGHT_SHIFT_DIFFERENTIAL_RATE"},
      {"type":"op","op":")"}
    ]'::jsonb
  )
ON CONFLICT (code) DO NOTHING;
