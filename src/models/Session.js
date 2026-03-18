const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  mentor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  student_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'ended'],
    default: 'waiting',
  },
  invite_code: {
    type: String,
    required: true,
    unique: true,
  },
  ended_at: {
    type: Date,
  }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Transform _id to id
sessionSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
  }
});

const Session = mongoose.model('Session', sessionSchema);
module.exports = Session;
