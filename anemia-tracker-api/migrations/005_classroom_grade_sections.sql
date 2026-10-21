BEGIN;
ALTER TABLE classrooms
  ADD COLUMN IF NOT EXISTS grade_name TEXT,
  ADD COLUMN IF NOT EXISTS section_name TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS classrooms_school_grade_section_unique
  ON classrooms (school_id, grade_name, section_name)
  WHERE grade_name IS NOT NULL AND section_name IS NOT NULL;
COMMIT;
