const express = require('express');
const { pool } = require('../config/db');
const { verifyToken } = require('../middlewares/auth');
const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
  const result = await pool.query('SELECT warehouse_id,warehouse_name,location_address FROM warehouses ORDER BY warehouse_id');
  res.json(result.rows);
});

module.exports = router;
