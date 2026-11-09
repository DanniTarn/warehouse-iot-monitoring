ALTER TABLE device_configs
  ADD COLUMN IF NOT EXISTS guard_mode VARCHAR(10) NOT NULL DEFAULT 'AUTO';

DO $$
BEGIN
  ALTER TABLE device_configs
    ADD CONSTRAINT device_configs_guard_mode_check
    CHECK (guard_mode IN ('AUTO', 'ON', 'OFF'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

UPDATE device_configs SET guard_mode = 'OFF' WHERE night_mode_enabled = FALSE;
