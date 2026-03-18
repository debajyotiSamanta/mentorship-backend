const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  full_name: {
    type: String,
    required: true,
    trim: true,
  },
  role: {
    type: String,
    enum: ['mentor', 'student'],
    required: true,
  },
  avatar_url: {
    type: String,
  },
  skills: {
    type: [String],
    default: [],
  },
  availability: {
    type: String,
    trim: true,
  }
}, { timestamps: true });

// Check password
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Hash password before saving - V7 ULTRA SAFE ASYNC
userSchema.pre('save', async function() {
  console.log(">>> [V7] PRE-SAVE HOOK START FOR:", this.email, "<<<");
  
  if (!this.isModified('password')) {
    console.log(">>> [V7] PASSWORD NOT MODIFIED, SKIPPING HASH <<<");
    return;
  }
  
  console.log(">>> [V7] HASHING PASSWORD... <<<");
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    console.log(">>> [V7] PASSWORD HASHED SUCCESSFULLY <<<");
  } catch (err) {
    console.error(">>> [V7] HASHING FAILED:", err.message);
    throw err;
  }
});

// Remove password/version key from returned object and map _id to id
userSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString();
    delete returnedObject._id;
    delete returnedObject.__v;
    delete returnedObject.password;
  }
});

const User = mongoose.model('User', userSchema);
module.exports = User;
