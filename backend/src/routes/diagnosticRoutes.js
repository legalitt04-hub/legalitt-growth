const express = require('express');
const router = express.Router();
const { busyUsers } = require('../config/socket');

router.get('/sockets', (req, res) => {
  // busyUsers is a Map
  const users = Object.fromEntries(busyUsers);
  res.json({ busyUsers: users });
});

module.exports = router;
