ALTER TABLE device_configs
  ADD COLUMN IF NOT EXISTS curfew_start_hour SMALLINT NOT NULL DEFAULT 20;
ALTER TABLE device_configs
  ADD COLUMN IF NOT EXISTS curfew_end_hour SMALLINT NOT NULL DEFAULT 6;

DO $$
BEGIN
  ALTER TABLE device_configs
    ADD CONSTRAINT device_configs_curfew_start_check
    CHECK (curfew_start_hour BETWEEN 0 AND 23);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE device_configs
    ADD CONSTRAINT device_configs_curfew_end_check
    CHECK (curfew_end_hour BETWEEN 0 AND 23);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
