const mongoose = require('mongoose');

const telemetrySchema = new mongoose.Schema({
  telemetry_id: { type: Number, required: true, unique: true, index: true },
  device_id: { type: Number, required: true, index: true },
  device_code: { type: String, required: true },
  temperature: { type: Number, default: null },
  humidity: { type: Number, default: null },
  smoke_gas_level: { type: Number, default: null },
  door_status: { type: Boolean, default: null },
  motion_detected: { type: Boolean, default: null },
  recorded_at: { type: Date, required: true, index: true }
}, { versionKey: false, collection: 'telemetries' });

telemetrySchema.index({ device_id: 1, recorded_at: -1 });

const alertSchema = new mongoose.Schema({
  alert_id: { type: Number, required: true, unique: true, index: true },
  device_id: { type: Number, required: true, index: true },
  device_code: { type: String, required: true },
  alert_type: { type: String, required: true },
  severity: { type: String, required: true },
  alert_message: { type: String, required: true },
  is_acknowledged: { type: Boolean, default: false },
  resolved_by_user_id: { type: Number, default: null },
  created_at: { type: Date, required: true },
  resolved_at: { type: Date, default: null }
}, { versionKey: false, collection: 'alerts' });

alertSchema.index({ device_id: 1, created_at: -1 });
alertSchema.index({ is_acknowledged: 1, created_at: -1 });

const Telemetry = mongoose.model('Telemetry', telemetrySchema);
const Alert = mongoose.model('Alert', alertSchema);

module.exports = { Telemetry, Alert };
