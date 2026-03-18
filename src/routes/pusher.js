const express = require('express');
const router = express.Router();
const pusher = require('../config/pusher');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/auth', authMiddleware, (req, res) => {
  const socketId = req.body.socket_id;
  const channel = req.body.channel_name;
  
  // Presence channel extra data
  const presenceData = {
    user_id: req.user.id,
    user_info: {
      name: req.user.full_name,
      role: req.user.role,
    },
  };

  const auth = pusher.authenticate(socketId, channel, presenceData);
  res.send(auth);
});

module.exports = router;
