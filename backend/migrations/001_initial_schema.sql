CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  role VARCHAR(20) NOT NULL DEFAULT 'VIEWER' CHECK (role IN ('ADMIN', 'OPERATOR', 'VIEWER')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS warehouses (
  warehouse_id SERIAL PRIMARY KEY,
  warehouse_name VARCHAR(100) UNIQUE NOT NULL,
  location_address TEXT
);

CREATE TABLE IF NOT EXISTS nodes (
  device_id SERIAL PRIMARY KEY,
  device_code VARCHAR(50) UNIQUE NOT NULL,
  device_name VARCHAR(100) NOT NULL,
  warehouse_id INTEGER REFERENCES warehouses(warehouse_id) ON DELETE SET NULL,
  assigned_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  mac_address VARCHAR(17) UNIQUE NOT NULL,
  firmware_version VARCHAR(50),
  ip_address VARCHAR(45),
  lifecycle_status VARCHAR(20) NOT NULL DEFAULT 'REGISTERED' CHECK (lifecycle_status IN ('REGISTERED', 'ACTIVE', 'OFFLINE', 'MAINTENANCE', 'DECOMMISSIONED')),
  auth_token_hash TEXT,
  auth_token_suffix CHAR(4),
  last_heartbeat TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sensors (
  sensor_id SERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES nodes(device_id) ON DELETE CASCADE,
  sensor_type VARCHAR(50) NOT NULL,
  unit VARCHAR(20),
  UNIQUE (device_id, sensor_type)
);

CREATE TABLE IF NOT EXISTS actuators (
  actuator_id SERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES nodes(device_id) ON DELETE CASCADE,
  actuator_type VARCHAR(50) NOT NULL,
  state BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (device_id, actuator_type)
);

CREATE TABLE IF NOT EXISTS device_configs (
  device_id INTEGER PRIMARY KEY REFERENCES nodes(device_id) ON DELETE CASCADE,
  humidity_threshold DOUBLE PRECISION DEFAULT 65,
  smoke_gas_threshold DOUBLE PRECISION DEFAULT 300,
  telemetry_interval INTEGER NOT NULL DEFAULT 5,
  night_mode_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  curfew_start_hour SMALLINT NOT NULL DEFAULT 20 CHECK (curfew_start_hour BETWEEN 0 AND 23),
  curfew_end_hour SMALLINT NOT NULL DEFAULT 6 CHECK (curfew_end_hour BETWEEN 0 AND 23),
  fan_mode VARCHAR(10) NOT NULL DEFAULT 'AUTO' CHECK (fan_mode IN ('AUTO', 'ON', 'OFF')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telemetry (
  telemetry_id BIGSERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES nodes(device_id) ON DELETE CASCADE,
  temperature DOUBLE PRECISION,
  humidity DOUBLE PRECISION,
  smoke_gas_level DOUBLE PRECISION,
  door_status BOOLEAN,
  motion_detected BOOLEAN,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_rules (
  rule_id SERIAL PRIMARY KEY,
  metric_name VARCHAR(50) NOT NULL,
  threshold_value DOUBLE PRECISION NOT NULL,
  comparison_operator VARCHAR(5) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS alerts (
  alert_id BIGSERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES nodes(device_id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
  alert_message TEXT NOT NULL,
  is_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS device_controls (
  command_id BIGSERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES nodes(device_id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  command_type VARCHAR(50) NOT NULL,
  parameters JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'ACKNOWLEDGED', 'FAILED')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  failure_reason TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  log_id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  ip_client VARCHAR(45),
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_device_time ON telemetry(device_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_device_time ON alerts(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_open ON alerts(is_acknowledged, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_controls_device_time ON device_controls(device_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_controls_pending ON device_controls(status, sent_at) WHERE status IN ('PENDING','SENT');
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_one_open ON alerts(device_id, alert_type) WHERE is_acknowledged = FALSE;

INSERT INTO warehouses(warehouse_name, location_address)
VALUES ('Kho chính', NULL)
ON CONFLICT (warehouse_name) DO NOTHING;
