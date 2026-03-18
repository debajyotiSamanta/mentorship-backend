const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, full_name, role, skills, availability } = req.body;

    if (!email || !password || !full_name || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (!['mentor', 'student'].includes(role)) {
      return res.status(400).json({ error: 'Role must be mentor or student' });
    }

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create user
    console.log(`Registering ${role}: ${full_name} with email ${email}`);
    const user = await User.create({
      email,
      password,
      full_name,
      role,
      skills: role === 'mentor' && skills ? skills.split(',').map(s => s.trim()) : [],
      availability: role === 'mentor' ? availability : ''
    });
    console.log("User created successfully in DB");

    if (user) {
      // Generate JWT
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

      res.status(201).json({
        message: 'Registered successfully',
        token,
        user: user.toJSON()
      });
    } else {
      res.status(400).json({ error: 'Invalid user data' });
    }
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      // Generate JWT
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

      res.json({
        message: 'Logged in successfully',
        token,
        user: user.toJSON()
      });
    } else {
      res.status(401).json({ error: 'Invalid email or password' });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  res.json({ user: req.user });
});

// PATCH /api/auth/profile
router.patch('/profile', authMiddleware, async (req, res) => {
  console.log(">>> PROFILE UPDATE REQUEST RECEIVED <<<");
  try {
    const { skills, availability } = req.body;
    const user = req.user; 

    if (!user) {
      console.error(">>> PROFILE UPDATE FAILED: USER NOT ATTACHED TO REQ <<<");
      return res.status(404).json({ error: 'User not found' });
    }

    if (skills !== undefined) {
      // Ensure skills is processed safely even if empty
      user.skills = typeof skills === 'string' 
        ? skills.split(',').map(s => s.trim()).filter(s => s !== '')
        : Array.isArray(skills) ? skills : [];
    }
    
    if (availability !== undefined) {
      user.availability = availability;
    }

    await user.save();
    console.log(">>> PROFILE UPDATED SUCCESSFULLY FOR:", user.email);
    res.json({ message: 'Profile updated successfully', user: user.toJSON() });
  } catch (err) {
    console.error('>>> PROFILE UPDATE EXCEPTION:', err.message);
    res.status(500).json({ error: `Failed to update profile: ${err.message}` });
  }
});

module.exports = router;
