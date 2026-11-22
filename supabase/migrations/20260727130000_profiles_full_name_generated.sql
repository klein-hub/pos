/*
  # Phase 4a — profiles.full_name convenience column

  The attendance-tracker app reads profiles.full_name in many places, but live
  profiles only has first_name / last_name (email/full_name were dropped when the
  schema was made company-centric). Rather than rewrite every read site, add a
  STORED generated full_name so reads keep working. Writes still target
  first_name / last_name (a generated column cannot be written to).

  Note: email is intentionally NOT re-added — it lives in auth.users and the app
  sources it from the auth session.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text
  GENERATED ALWAYS AS (
    NULLIF(TRIM(BOTH ' ' FROM COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '')
  ) STORED;
