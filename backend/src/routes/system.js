const express = require('express');
const { env } = require('../config/env');
const { verifyToken } = require('../middlewares/auth');
const { nightTime } = require('../utils/data');

const router = express.Router();
router.use(verifyToken);

router.get('/', (req, res) => {
  const now = new Date();
  res.json({
    night: nightTime(now, env.nightTimezone, env.nightStartHour, env.nightEndHour),
    night_start_hour: env.nightStartHour,
    night_end_hour: env.nightEndHour,
    timezone: env.nightTimezone,
    server_time: now.toISOString()
  });
});

module.exports = router;
