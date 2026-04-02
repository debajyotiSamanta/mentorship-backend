const mongoose = require('mongoose');

let isConnected = false;
let connectionAttempts = 0;
const MAX_RETRIES = 5;
const RETRY_DELAY = 2000; // 2 seconds

const connectDB = async () => {
  // If already connected, skip
  if (isConnected && mongoose.connection.readyState === 1) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ Using existing MongoDB connection');
    }
    return true;
  }

  // Prevent too many connection attempts
  // Reset counter if fully disconnected (allows fresh retries after transient failures)
  if (mongoose.connection.readyState === 0) {
    connectionAttempts = 0;
  }
  
  if (connectionAttempts >= MAX_RETRIES) {
    console.error('❌ Max MongoDB connection attempts reached');
    return false;
  }

  try {
    if (!process.env.MONGODB_URI) {
      console.error('❌ CRITICAL: MONGODB_URI environment variable is not defined');
      console.error('   Please set MONGODB_URI in your Vercel environment variables');
      return false;
    }

    connectionAttempts++;
    console.log(`[MongoDB] Connection attempt ${connectionAttempts}/${MAX_RETRIES}...`);

    // Set mongoose connection options for better reliability
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, skip trying IPv6
      retryWrites: true,
      writeConcern: { w: 'majority' },
    };

    const conn = await mongoose.connect(process.env.MONGODB_URI, options);

    // Verify connection is actually ready
    if (conn.connection.readyState === 1) {
      isConnected = true;
      console.log(`✅ MongoDB Connected Successfully: ${conn.connection.host}`);
      console.log(`   Database: ${conn.connection.name}`);
      connectionAttempts = 0; // Reset counter on successful connection
      return true;
    } else {
      console.error('❌ MongoDB connection established but readyState is not 1');
      return false;
    }
  } catch (error) {
    console.error(`❌ MongoDB Connection Error (Attempt ${connectionAttempts}):`, error.message);
    
    // Specific error handling
    if (error.message.includes('ECONNREFUSED')) {
      console.error('   → Connection refused. Is MongoDB Atlas running?');
    } else if (error.message.includes('ETIMEDOUT')) {
      console.error('   → Connection timeout. Check your network/firewall.');
    } else if (error.message.includes('MongoServerSelectionError')) {
      console.error('   → Cannot reach MongoDB server. Check MONGODB_URI.');
    } else if (error.message.includes('authentication failed')) {
      console.error('   → Authentication failed. Check MongoDB username/password.');
    }

    // Retry connection after delay if not at max retries
    if (connectionAttempts < MAX_RETRIES) {
      console.log(`   Retrying in ${RETRY_DELAY}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return connectDB(); // Recursive retry
    }

    return false;
  }
};

// Handle mongoose connection events
mongoose.connection.on('connected', () => {
  console.log('✅ Mongoose connected event fired');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err.message);
  isConnected = false;
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ Mongoose disconnected event fired');
  isConnected = false;
});

module.exports = connectDB;
