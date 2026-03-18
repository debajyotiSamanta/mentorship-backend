const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const authMiddleware = require('../middleware/authMiddleware');

// Helper: generate short invite code
function generateInviteCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

// POST /api/sessions  (Mentor only)
router.post('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'mentor') {
      return res.status(403).json({ error: 'Only mentors can create sessions' });
    }

    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const invite_code = generateInviteCode();

    const session = await Session.create({
      mentor_id: req.user.id,
      title,
      status: 'waiting',
      invite_code,
    });

    res.status(201).json({ session: session.toJSON() });
  } catch (err) {
    console.error('Create session error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/sessions  (list own sessions)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const query = req.user.role === 'mentor' 
      ? { mentor_id: req.user.id } 
      : { student_id: req.user.id };

    const sessions = await Session.find(query)
      .populate('mentor_id', 'full_name role _id')
      .populate('student_id', 'full_name role _id')
      .sort('-created_at');

    // Rename populated fields to match previous Supabase API structure
    const formattedSessions = sessions.map(s => {
      const obj = s.toJSON();
      obj.mentor = s.mentor_id ? { id: s.mentor_id._id.toString(), full_name: s.mentor_id.full_name, role: s.mentor_id.role } : null;
      obj.student = s.student_id ? { id: s.student_id._id.toString(), full_name: s.student_id.full_name, role: s.student_id.role } : null;
      return obj;
    });

    res.json({ sessions: formattedSessions });
  } catch (err) {
    console.error('Get sessions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/sessions/:inviteCode
router.get('/:inviteCode', authMiddleware, async (req, res) => {
  try {
    const { inviteCode } = req.params;

    const session = await Session.findOne({ invite_code: inviteCode })
      .populate('mentor_id', 'full_name role _id')
      .populate('student_id', 'full_name role _id');

    if (!session) return res.status(404).json({ error: 'Session not found' });

    const obj = session.toJSON();
    obj.mentor = session.mentor_id ? { id: session.mentor_id._id.toString(), full_name: session.mentor_id.full_name, role: session.mentor_id.role } : null;
    obj.student = session.student_id ? { id: session.student_id._id.toString(), full_name: session.student_id.full_name, role: session.student_id.role } : null;

    res.json({ session: obj });
  } catch (err) {
    console.error('Get session error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/sessions/:inviteCode/join  (Student)
router.post('/:inviteCode/join', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can join via invite code' });
    }

    const { inviteCode } = req.params;

    const session = await Session.findOne({ invite_code: inviteCode });

    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status === 'ended') return res.status(400).json({ error: 'Session has ended' });

    // Link student to session
    session.student_id = req.user.id;
    session.status = 'active';
    await session.save();

    res.json({ session: session.toJSON() });
  } catch (err) {
    console.error('Join session error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/sessions/:id/end  (Mentor only)
router.patch('/:id/end', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'mentor') {
      return res.status(403).json({ error: 'Only mentors can end sessions' });
    }

    const session = await Session.findOneAndUpdate(
      { _id: req.params.id, mentor_id: req.user.id },
      { status: 'ended', ended_at: new Date() },
      { new: true }
    );

    if (!session) return res.status(404).json({ error: 'Session not found or not authorized' });

    res.json({ session: session.toJSON() });
  } catch (err) {
    console.error('End session error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
