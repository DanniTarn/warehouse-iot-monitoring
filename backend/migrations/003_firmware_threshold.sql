ALTER TABLE device_configs ADD COLUMN IF NOT EXISTS temperature_threshold DOUBLE PRECISION NOT NULL DEFAULT 50;
ALTER TABLE device_configs DROP CONSTRAINT IF EXISTS device_configs_temperature_threshold_check;
ALTER TABLE device_configs ADD CONSTRAINT device_configs_temperature_threshold_check CHECK (temperature_threshold >= 0 AND temperature_threshold <= 125);
