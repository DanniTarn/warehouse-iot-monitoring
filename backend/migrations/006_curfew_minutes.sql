ALTER TABLE device_configs
  ADD COLUMN IF NOT EXISTS curfew_start_minute SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE device_configs
  ADD COLUMN IF NOT EXISTS curfew_end_minute SMALLINT NOT NULL DEFAULT 0;

DO $$
BEGIN
  ALTER TABLE device_configs
    ADD CONSTRAINT device_configs_curfew_start_minute_check
    CHECK (curfew_start_minute BETWEEN 0 AND 59);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE device_configs
    ADD CONSTRAINT device_configs_curfew_end_minute_check
    CHECK (curfew_end_minute BETWEEN 0 AND 59);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
