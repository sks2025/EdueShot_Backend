import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: function() { return this.isVerified === true; } },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: function() { return this.isVerified === true; } },
    role: { type: String, enum: ['teacher', 'student', 'admin'], required: function() { return this.isVerified === true; } },
    otp: { type: String },
    otpExpires: { type: Date },
    forgotPasswordOtp: { type: String },
    forgotPasswordExpiry: { type: Date },
    isVerified: { type: Boolean, default: false },
    quizAttempts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' }] // Track attempted quizzes
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);