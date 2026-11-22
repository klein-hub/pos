/*
  # Pay Constants – Formula Support

  1. Modified Tables
    - `pay_constants`
      - `value_type` (text, default 'constant') — 'constant' | 'formula'
      - `formula_tokens` (jsonb, default '[]') — ordered list of tokens used to
        build the formula. Each token is one of:
          { "type": "constant", "code": "<pay_constant.code>" }
          { "type": "number",   "val":  <number> }
          { "type": "op",       "op":   "+" | "-" | "*" | "/" | "(" | ")" }
      - `value` continues to hold the evaluated numeric result so payroll
        computations remain fast and compatible.

  2. Security
    - No policy changes required (existing RLS already covers new columns).

  3. Notes
    - Existing rows default to `value_type = 'constant'` with an empty token
      list so no data is lost.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pay_constants' AND column_name = 'value_type'
  ) THEN
    ALTER TABLE pay_constants
      ADD COLUMN value_type text NOT NULL DEFAULT 'constant';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pay_constants' AND column_name = 'formula_tokens'
  ) THEN
    ALTER TABLE pay_constants
      ADD COLUMN formula_tokens jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;
