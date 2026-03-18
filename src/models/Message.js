const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  session_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
  },
  sender_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  content: {
    type: String,
    required: true,
    trim: true,
  }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Transform _id to id
messageSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    // Rename virtual populated fields if needed, or handle in query
    delete returnedObject._id;
    delete returnedObject.__v;
  }
});

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
