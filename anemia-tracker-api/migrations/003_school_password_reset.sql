BEGIN;

ALTER TABLE schools ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS school_password_reset_challenges (
  challenge_id BIGSERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(school_id),
  otp_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  attempts_remaining INTEGER NOT NULL DEFAULT 5 CHECK (attempts_remaining >= 0),
  consumed_at TIMESTAMP,
  verified_at TIMESTAMP,
  reset_token_hash CHAR(64),
  reset_expires_at TIMESTAMP,
  last_sent_at TIMESTAMP NOT NULL DEFAULT now(),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS school_password_reset_challenges_school_idx
  ON school_password_reset_challenges (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS school_password_reset_challenges_expiry_idx
  ON school_password_reset_challenges (expires_at);

COMMIT;
