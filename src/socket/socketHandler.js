const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');

// Track rooms: { sessionId: { users: [{ socketId, userId, name }] } }
const rooms = {};

function setupSocket(io) {
  // Socket auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`✅ Socket connected: ${socket.id} (user: ${socket.userId})`);

    // Fetch user profile
    let profile;
    try {
      profile = await User.findById(socket.userId).select('full_name role');
    } catch (err) {
      console.error('Socket user fetch error:', err);
    }

    socket.userProfile = profile;

    // ── JOIN ROOM ──────────────────────────────────────────────
    socket.on('join-room', (sessionId) => {
      socket.join(sessionId);
      socket.currentRoom = sessionId;

      if (!rooms[sessionId]) rooms[sessionId] = { users: [] };

      // Remove old entry for same user (reconnect)
      rooms[sessionId].users = rooms[sessionId].users.filter(u => u.userId !== socket.userId.toString());
      rooms[sessionId].users.push({
        socketId: socket.id,
        userId: socket.userId.toString(),
        name: profile?.full_name || 'Unknown',
        role: profile?.role || 'student',
      });

      // Notify others
      socket.to(sessionId).emit('user-joined', {
        socketId: socket.id,
        userId: socket.userId.toString(),
        name: profile?.full_name,
        role: profile?.role,
      });

      // Send room participants to the joining user
      socket.emit('room-participants', rooms[sessionId].users);
      console.log(`🟢 ${profile?.full_name} joined room ${sessionId}`);
    });

    // ── CODE EDITOR ────────────────────────────────────────────
    let codeChangeTimeout = null;
    socket.on('code-change', ({ sessionId, code }) => {
      // Throttle: only broadcast after 100ms of inactivity
      if (codeChangeTimeout) clearTimeout(codeChangeTimeout);
      codeChangeTimeout = setTimeout(() => {
        socket.to(sessionId).emit('code-update', { code, senderId: socket.userId.toString() });
      }, 100);
    });

    socket.on('language-change', ({ sessionId, language }) => {
      socket.to(sessionId).emit('language-update', { language, senderId: socket.userId.toString() });
    });

    // ── CHAT ──────────────────────────────────────────────────
    socket.on('send-message', async ({ sessionId, content }) => {
      if (!content?.trim()) return;

      try {
        // Persist to DB using Mongoose
        const msgDoc = await Message.create({
          session_id: sessionId,
          sender_id: socket.userId,
          content: content.trim(),
        });

        const obj = msgDoc.toJSON();
        
        // Use the cached profile attached to the socket connection!
        obj.sender = {
          id: socket.userId.toString(),
          full_name: socket.userProfile?.full_name || 'Unknown',
          role: socket.userProfile?.role || 'student'
        };

        // Broadcast to entire room (including sender)
        io.to(sessionId).emit('receive-message', obj);
      } catch (err) {
        console.error('Chat error:', err);
        socket.emit('message-error', { error: 'Failed to send message' });
      }
    });

    // ── WEBRTC SIGNALING ──────────────────────────────────────
    socket.on('webrtc-offer', ({ targetSocketId, offer }) => {
      io.to(targetSocketId).emit('webrtc-offer', {
        offer,
        fromSocketId: socket.id,
        fromUserId: socket.userId.toString(),
        fromName: profile?.full_name,
      });
    });

    socket.on('webrtc-answer', ({ targetSocketId, answer }) => {
      io.to(targetSocketId).emit('webrtc-answer', {
        answer,
        fromSocketId: socket.id,
      });
    });

    socket.on('webrtc-ice-candidate', ({ targetSocketId, candidate }) => {
      io.to(targetSocketId).emit('webrtc-ice-candidate', {
        candidate,
        fromSocketId: socket.id,
      });
    });

    // ── DISCONNECT ────────────────────────────────────────────
    socket.on('disconnect', () => {
      const sessionId = socket.currentRoom;
      if (sessionId && rooms[sessionId]) {
        rooms[sessionId].users = rooms[sessionId].users.filter(
          u => u.socketId !== socket.id
        );

        socket.to(sessionId).emit('user-left', {
          userId: socket.userId.toString(),
          name: profile?.full_name,
        });

        if (rooms[sessionId].users.length === 0) {
          delete rooms[sessionId];
        }
      }
      console.log(`🔴 Socket disconnected: ${socket.id}`);
    });
  });
}

module.exports = setupSocket;
