require('dotenv').config();
console.log("Env keys loaded:", Object.keys(process.env).filter(k => k.includes('GEMINI') || k.includes('PORT')));
const express = require('express');
const http = require('http');
const cors = require('cors');
// const Pusher = require('pusher'); // Removed, using config instead
const pusher = require('./src/config/pusher');

const connectDB = require('./src/config/db');
const authRoutes = require('./src/routes/auth');
const sessionRoutes = require('./src/routes/sessions');
const messageRoutes = require('./src/routes/messages');
const mentorRoutes = require('./src/routes/mentors');
// const setupSocket = require('./src/socket/socketHandler'); // Removed for Pusher
const pusherRoutes = require('./src/routes/pusher');

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

/* 
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
});
*/

// app.use(cors(...)) // already there

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/mentors', mentorRoutes);
app.use('/api/pusher', pusherRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket setup
// setupSocket(io); // Removed for Pusher

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production') {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
