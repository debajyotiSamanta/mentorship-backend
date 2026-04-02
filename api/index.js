require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Validate critical environment variables on startup
const validateEnvVariables = () => {
  const required = ['JWT_SECRET', 'MONGODB_URI'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ CRITICAL: Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\nPlease set these in your .env file or environment variables.');
    console.error('See .env.example for reference.\n');
  }
  
  return missing.length === 0;
};

if (!validateEnvVariables()) {
  console.warn('⚠️  Warning: Some environment variables are missing. The app may not work correctly.');
}

const pusher = require('../src/config/pusher');
const connectDB = require('../src/config/db');
const authRoutes = require('../src/routes/auth');
const sessionRoutes = require('../src/routes/sessions');
const messageRoutes = require('../src/routes/messages');
const mentorRoutes = require('../src/routes/mentors');
const pusherRoutes = require('../src/routes/pusher');

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

// Security Headers
app.use(helmet());

// Rate Limiting — 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'https://mentorship-platform-frontend.vercel.app',
  'https://mentorship-frontend.vercel.app'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS request from unauthorized origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/mentors', mentorRoutes);
app.use('/api/pusher', pusherRoutes);

app.get('/api', (req, res) => {
  res.json({ 
    message: 'Mentorship API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/', (req, res) => {
  res.send('<h1>One-on-One Mentorship Platform API</h1><p>Status: Running</p><p>Check <a href="/api/health">/api/health</a> for details.</p>');
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 CORS origins allowed: ${allowedOrigins.join(', ')}`);
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Global Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS policy violation' });
  }
  
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

module.exports = app;
