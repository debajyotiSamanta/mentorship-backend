const Pusher = require('pusher');

let pusher;

try {
  if (process.env.PUSHER_APP_ID && process.env.PUSHER_KEY && process.env.PUSHER_SECRET && process.env.PUSHER_CLUSTER) {
    pusher = new Pusher({
      appId: process.env.PUSHER_APP_ID,
      key: process.env.PUSHER_KEY,
      secret: process.env.PUSHER_SECRET,
      cluster: process.env.PUSHER_CLUSTER,
      useTLS: true,
    });
  } else {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️ Pusher credentials missing. Real-time features will be disabled.');
    }
    // Dummy pusher to prevent crashes
    pusher = { 
      trigger: () => {},
      authenticate: () => ({ auth: 'dummy_auth' }) 
    };
  }
} catch (error) {
  console.error('❌ Pusher Initialization Error:', error.message);
  pusher = { 
    trigger: () => {},
    authenticate: () => ({ auth: 'dummy_auth' }) 
  };
}

module.exports = pusher;
