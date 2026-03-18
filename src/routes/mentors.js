const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

console.log(">>> [V7] MENTORS ROUTE LOADED <<<");

let ai = null;
try {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const key = process.env.GEMINI_API_KEY;
  if (key) {
    console.log(">>> [V7] INITIALIZING GEMINI SDK... <<<");
    ai = new GoogleGenerativeAI(key);
  } else {
    console.warn(">>> [V7] MISSING GEMINI_API_KEY <<<");
  }
} catch (e) {
  console.error(">>> [V7] SDK INIT ERROR:", e.message);
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
  console.log(">>> [V7] AI-MATCH REQUEST RECEIVED <<<");
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Search prompt is required' });

    const mentors = await User.find({ role: 'mentor' }).select('-password -__v');

    if (!ai) {
      console.warn(">>> [V7] AI NOT CONFIGURED, USING MOCK <<<");
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
      console.log(`>>> [V7] TRYING MODEL: ${modelName} <<<`);
      try {
        const model = ai.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(systemPrompt);
        const response = await result.response;
        const text = response.text().trim().replace(/```json/gi, '').replace(/```/g, '').trim();
        return text;
      } catch (err) {
        console.error(`>>> [V7] MODEL ${modelName} ERROR:`, err.message);
        throw err;
      }
    }

    let textOutput;
    try {
      // Primary model: Flash 1.5
      textOutput = await generateContentWithFallback('gemini-1.5-flash');
    } catch (e) {
      console.log(">>> [V7] FALLING BACK TO gemini-pro... <<<");
      try {
        textOutput = await generateContentWithFallback('gemini-pro');
      } catch (e2) {
        console.log(">>> [V7] ALL MODELS FAILED, USING gemini-1.0-pro-latest... <<<");
        textOutput = await generateContentWithFallback('gemini-1.0-pro-latest');
      }
    }
    
    console.log(">>> [V7] GEMINI OUTPUT:", textOutput);

    let matchedIds = [];
    try {
      matchedIds = JSON.parse(textOutput);
    } catch(e) {
      console.error(">>> [V7] JSON PARSE ERROR <<<");
      return res.json({ mentors: [] });
    }

    const matchedMentors = [];
    for (const id of (Array.isArray(matchedIds) ? matchedIds : [])) {
      const m = mentors.find(mentor => mentor._id.toString() === id);
      if (m) matchedMentors.push(m);
    }

    res.json({ mentors: matchedMentors });

  } catch (err) {
    console.error('>>> [V7] AI MATCH CRASH:', err.message);
    res.status(500).json({ error: `AI_MATCH_FATAL_ERROR: ${err.message}` });
  }
});

module.exports = router;
