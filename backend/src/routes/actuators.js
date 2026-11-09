const express = require('express');
const { pool } = require('../config/db');
const { verifyToken } = require('../middlewares/auth');

const router = express.Router();
router.use(verifyToken);

router.get('/', async (req, res) => {
  const result = await pool.query(
    `SELECT a.device_id,n.device_code,a.actuator_type,a.state,a.updated_at
     FROM actuators a JOIN nodes n ON n.device_id=a.device_id
     ORDER BY a.device_id,a.actuator_type`
  );
  res.json(result.rows);
});

module.exports = router;
