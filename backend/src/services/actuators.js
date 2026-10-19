const { pool } = require('../config/db');
const { broadcast } = require('./realtime');

async function updateActuatorStates(deviceId, code, states) {
  for (const [type, state] of states) {
    const result = await pool.query(
      'UPDATE actuators SET state=$3,updated_at=NOW() WHERE device_id=$1 AND actuator_type=$2 AND state IS DISTINCT FROM $3 RETURNING actuator_id',
      [deviceId, type, state]
    );
    if (result.rowCount) {
      broadcast('actuator_status', { device_id: deviceId, device_code: code, actuator_type: type, state });
    }
  }
}

module.exports = { updateActuatorStates };
