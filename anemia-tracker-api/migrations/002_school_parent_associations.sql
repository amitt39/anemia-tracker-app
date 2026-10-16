BEGIN;

CREATE TABLE IF NOT EXISTS school_parents (
  school_id INTEGER NOT NULL REFERENCES schools(school_id),
  parent_id INTEGER NOT NULL REFERENCES parents(parent_id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  invited_at TIMESTAMP NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP,
  revoked_at TIMESTAMP,
  CONSTRAINT school_parents_pkey PRIMARY KEY (school_id, parent_id),
  CONSTRAINT school_parents_status_check CHECK (status IN ('pending', 'active', 'declined', 'revoked'))
);

ALTER TABLE student_parents ADD COLUMN IF NOT EXISTS parent_accepted_at TIMESTAMP;
ALTER TABLE student_parents ADD COLUMN IF NOT EXISTS school_confirmed_at TIMESTAMP;

INSERT INTO school_parents (school_id, parent_id, status, invited_at, accepted_at)
SELECT DISTINCT c.school_id, sp.parent_id, 'active', min(sp.created_at), min(sp.created_at)
FROM student_parents sp
INNER JOIN students s ON s.student_id = sp.student_id
INNER JOIN classrooms c ON c.classroom_id = s.classroom_id
WHERE sp.status = 'verified'
GROUP BY c.school_id, sp.parent_id
ON CONFLICT (school_id, parent_id) DO NOTHING;

UPDATE student_parents
SET parent_accepted_at = COALESCE(parent_accepted_at, created_at),
    school_confirmed_at = COALESCE(school_confirmed_at, created_at)
WHERE status = 'verified';

COMMIT;
