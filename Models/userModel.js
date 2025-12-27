import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: function() { return this.isVerified === true; } },
    email: { type: String, required: true },
    password: { type: String, required: function() { return this.isVerified === true; } },
    role: { type: String, enum: ['teacher', 'student', 'admin'], required: function() { return this.isVerified === true; } },
    profilePic: { type: String, default: null }, // Profile picture URL
    mobile: { type: String, default: null }, // Mobile number
    otp: { type: String },
    otpExpires: { type: Date },
    forgotPasswordOtp: { type: String },
    forgotPasswordExpiry: { type: Date },
    isVerified: { type: Boolean, default: false },
    quizAttempts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' }], // Track attempted quizzes
    // Teacher permission for paid quiz creation (only admin can enable this)
    canCreatePaidQuiz: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// Compound unique index: same email can be used for different roles
// But same email + same role combination must be unique
userSchema.index({ email: 1, role: 1 }, { unique: true, sparse: true });

export default mongoose.model('User', userSchema);