const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const authMiddleware = require('../middleware/authMiddleware');
const pusher = require('../config/pusher');

// GET /api/messages/:sessionId
router.get('/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const messages = await Message.find({ session_id: sessionId })
      .populate('sender_id', 'full_name role _id')
      .sort('created_at');

    const formattedMessages = messages.map(m => {
      const obj = m.toJSON();
      obj.sender = m.sender_id ? { id: m.sender_id._id.toString(), full_name: m.sender_id.full_name, role: m.sender_id.role } : null;
      return obj;
    });

    res.json({ messages: formattedMessages });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/messages  (fallback REST, actual sending is via socket)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { session_id, content } = req.body;
    if (!session_id || !content) {
      return res.status(400).json({ error: 'session_id and content required' });
    }

    const message = await Message.create({
      session_id,
      sender_id: req.user.id,
      content,
    });

    const populatedMessage = await message.populate('sender_id', 'full_name role _id');
    
    const obj = populatedMessage.toJSON();
    obj.sender = { id: populatedMessage.sender_id._id.toString(), full_name: populatedMessage.sender_id.full_name, role: populatedMessage.sender_id.role };

    // Trigger Pusher event
    pusher.trigger(`presence-session-${session_id}`, 'receive-message', obj);

    res.status(201).json({ message: obj });
  } catch (err) {
    console.error('Post message error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
