/*
  # Add department_id to projects table

  1. Changes
    - Add `department_id` (bigint, nullable) column to `projects`
    - Add foreign key constraint to `departments.id`
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE projects ADD COLUMN department_id bigint REFERENCES departments(id) ON DELETE SET NULL;
  END IF;
END $$;
