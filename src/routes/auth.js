const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const mongoose = require('mongoose');
const authMiddleware = require('../middleware/authMiddleware');

// Validate JWT_SECRET on startup
if (!process.env.JWT_SECRET) {
  console.error('❌ CRITICAL: JWT_SECRET environment variable is not set!');
  console.error('Please set JWT_SECRET in your .env file or environment variables');
}

// Middleware to check database connection
const checkDBConnection = (req, res, next) => {
  const mongooseState = mongoose.connection.readyState;
  // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  
  if (mongooseState !== 1) {
    console.error(`❌ Database connection unavailable. State: ${mongooseState}`);
    return res.status(503).json({ 
      error: 'Database connection unavailable. Please try again later.',
      isDatabaseError: true 
    });
  }
  next();
};

// Apply database check to all routes
router.use(checkDBConnection);

// Helper function to create JWT token
const createToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET not configured');
  }
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// POST /api/auth/register
router.post(['/register', '/registerUser'], async (req, res) => {
  try {
    const { email, password, full_name, role, skills, availability } = req.body;

    // Validation
    if (!email || !password || !full_name || !role) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Validate role
    if (!['mentor', 'student'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either "mentor" or "student"' });
    }

    // Check if user already exists
    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // Create user
    const user = await User.create({
      email: email.toLowerCase(),
      password,
      full_name: full_name.trim(),
      role,
      skills: role === 'mentor' && skills ? skills.split(',').map(s => s.trim()).filter(s => s !== '') : [],
      availability: role === 'mentor' ? (availability || '') : ''
    });

    // Create token
    const token = createToken(user._id);

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: user.toJSON()
    });
  } catch (err) {
    console.error('Register error:', err);
    
    // Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ error: messages[0] || 'Validation error' });
    }

    // Handle Mongoose duplicate key error
    if (err.code === 11000) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // Generic error response
    res.status(500).json({ error: 'Failed to create account. Please try again later.' });
  }
});

// POST /api/auth/login
router.post(['/login', '/loginUser'], async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check password
    const passwordMatch = await user.matchPassword(password);
    
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Create token
    const token = createToken(user._id);

    res.json({
      message: 'Signed in successfully',
      token,
      user: user.toJSON()
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to sign in. Please try again later.' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    res.json({ user: req.user.toJSON() });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PATCH /api/auth/profile
router.patch('/profile', authMiddleware, async (req, res) => {
  try {
    const { skills, availability } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (skills !== undefined) {
      user.skills = typeof skills === 'string'
        ? skills.split(',').map(s => s.trim()).filter(s => s !== '')
        : Array.isArray(skills) ? skills : [];
    }

    if (availability !== undefined) {
      user.availability = availability;
    }

    await user.save();
    res.json({ message: 'Profile updated successfully', user: user.toJSON() });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile. Please try again later.' });
  }
});

module.exports = router;
