const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

let ai = null;
try {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const key = process.env.GEMINI_API_KEY;
  if (key) {
    ai = new GoogleGenerativeAI(key);
  } else {
    console.warn('GEMINI_API_KEY not set — AI matching will use fallback');
  }
} catch (e) {
  console.error('Gemini SDK init error:', e.message);
}

// GET /api/mentors
router.get('/', authMiddleware, async (req, res) => {
  try {
    const mentors = await User.find({ role: 'mentor' }).select('-password -__v');
    res.json({ mentors });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch mentors' });
  }
});

// POST /api/mentors/ai-match
router.post('/ai-match', authMiddleware, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Search prompt is required' });

    const mentors = await User.find({ role: 'mentor' }).select('-password -__v');

    if (!ai) {
      return res.json({ mentors: mentors.slice(0, 3) });
    }

    const candidates = mentors.map(m => ({
      id: m._id,
      name: m.full_name,
      skills: m.skills,
      availability: m.availability || 'Not specified'
    }));

    const systemPrompt = `You are a mentor matching AI. 
Student wants: "${prompt}"
Mentors: ${JSON.stringify(candidates)}
Return ONLY a valid JSON array of mentor 'id' strings.`;

    async function generateContentWithFallback(modelName) {
      const model = ai.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(systemPrompt);
      const response = await result.response;
      const text = response.text().trim().replace(/```json/gi, '').replace(/```/g, '').trim();
      return text;
    }

    let textOutput;
    try {
      textOutput = await generateContentWithFallback('gemini-1.5-flash');
    } catch (e) {
      try {
        textOutput = await generateContentWithFallback('gemini-pro');
      } catch (e2) {
        textOutput = await generateContentWithFallback('gemini-1.0-pro-latest');
      }
    }

    let matchedIds = [];
    try {
      matchedIds = JSON.parse(textOutput);
    } catch(e) {
      return res.json({ mentors: [] });
    }

    const matchedMentors = [];
    for (const id of (Array.isArray(matchedIds) ? matchedIds : [])) {
      const m = mentors.find(mentor => mentor._id.toString() === id);
      if (m) matchedMentors.push(m);
    }

    res.json({ mentors: matchedMentors });

  } catch (err) {
    console.error('AI match error:', err.message);
    res.status(500).json({ error: 'AI matching failed' });
  }
});

module.exports = router;
