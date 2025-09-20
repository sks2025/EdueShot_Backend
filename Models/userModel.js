import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: function() { return this.isVerified === true; } },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: function() { return this.isVerified === true; } },
    role: { type: String, enum: ['teacher', 'student'], required: function() { return this.isVerified === true; } },
    otp: { type: String },
    otpExpires: { type: Date },
    isVerified: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);