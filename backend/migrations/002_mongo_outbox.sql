CREATE TABLE IF NOT EXISTS mongo_outbox (
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('telemetry', 'alert')),
  entity_id BIGINT NOT NULL,
  payload JSONB NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  PRIMARY KEY (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_mongo_outbox_unsent
ON mongo_outbox (next_attempt_at, changed_at)
WHERE delivered_at IS NULL;

CREATE OR REPLACE FUNCTION enqueue_mongo_history()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  entry_type TEXT;
  entry_id BIGINT;
  entry_payload JSONB;
  entry_code TEXT;
BEGIN
  SELECT device_code INTO entry_code FROM nodes WHERE device_id = NEW.device_id;
  IF TG_TABLE_NAME = 'telemetry' THEN
    entry_type := 'telemetry';
    entry_id := NEW.telemetry_id;
  ELSE
    entry_type := 'alert';
    entry_id := NEW.alert_id;
  END IF;
  entry_payload := to_jsonb(NEW) || jsonb_build_object('device_code', entry_code);
  INSERT INTO mongo_outbox(entity_type, entity_id, payload)
  VALUES(entry_type, entry_id, entry_payload)
  ON CONFLICT(entity_type, entity_id) DO UPDATE
  SET payload = EXCLUDED.payload,
      changed_at = NOW(),
      delivered_at = NULL,
      next_attempt_at = NOW(),
      attempt_count = 0,
      last_error = NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS telemetry_mongo_history ON telemetry;
CREATE TRIGGER telemetry_mongo_history
AFTER INSERT ON telemetry
FOR EACH ROW EXECUTE FUNCTION enqueue_mongo_history();

DROP TRIGGER IF EXISTS alerts_mongo_history ON alerts;
CREATE TRIGGER alerts_mongo_history
AFTER INSERT OR UPDATE OF alert_type, severity, alert_message, is_acknowledged, resolved_by_user_id, resolved_at ON alerts
FOR EACH ROW EXECUTE FUNCTION enqueue_mongo_history();
