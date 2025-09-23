import mongoose from 'mongoose';
import User from './userModel.js';

const videoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  contentType: { type: String, enum: ['reel', 'full'], required: true },
  category: [{ type: String, required: true }],
  customCategory: { type: String },
  videoUrl: { type: String },
  thumbnailUrl: { type: String },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  // Like functionality
  likes: { type: Number, default: 0 },
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

export default mongoose.model('Video', videoSchema);