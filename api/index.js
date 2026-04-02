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

const app = express();
const server = http.createServer(app);

// Async initialization - Connect to database first, then start server
async function initializeServer() {
  try {
    console.log('⏳ Attempting to connect to MongoDB...');
    
    // Connect to MongoDB with retry logic
    const dbConnected = await connectDB();
    
    if (!dbConnected) {
      console.error('❌ CRITICAL: Failed to connect to MongoDB after retries');
      console.error('   The application cannot start without database connection');
      if (process.env.NODE_ENV === 'production') {
        console.error('   Please check:');
        console.error('   1. MONGODB_URI environment variable is set on Vercel');
        console.error('   2. MongoDB Atlas network access allows Vercel IPs');
        console.error('   3. Database credentials are correct');
        // In production, still try to start but routes will handle missing DB
      }
    } else {
      console.log('✅ MongoDB connection successful');
    }

// Security Headers with strict CSP and HSTS
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imageSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", 'https://mentorship-backend-silk.vercel.app', 'https://mentorship-frontend-nine-ochre.vercel.app', 'https://api.pusher.com'],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
}));

// Rate Limiting — 200 requests per 15 minutes per IP for auth, 500 for others
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  skip: (req) => process.env.NODE_ENV === 'development',
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' },
  skip: (req) => process.env.NODE_ENV === 'development',
});

app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'https://mentorship-frontend-nine-ochre.vercel.app'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`⚠️ CORS request from unauthorized origin: ${origin}`);
      }
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
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
    
    // Start the server
    server.listen(PORT, '0.0.0.0', () => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔒 CORS origins allowed: ${allowedOrigins.join(', ')}`);
      } else {
        console.log(`✅ Server running on port ${PORT}`);
      }
    });
    
  } catch (error) {
    console.error('❌ FATAL ERROR during server initialization:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

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

// Initialize the server
initializeServer().catch(error => {
  console.error('Failed to initialize server:', error);
  process.exit(1);
});

module.exports = app;
