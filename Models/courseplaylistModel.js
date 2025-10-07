import mongoose from "mongoose";

const coursePlaylistSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  contentType: {
    type: String,
    required: true,
    enum: ["video", "audio", "document", "quiz", "assignment"],
    default: "video"
  },
  category: {
    type: String,
    required: true,
    trim: true,
  },
  videoFile: {
    type: String,
    required: function() {
      return this.contentType === "video" || this.contentType === "audio";
    }
  },
  thumbnail: {
    type: String,
    required: true,
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true,
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  order: {
    type: Number,
    default: 0,
  },
  duration: {
    type: String, // e.g., "10:30" for 10 minutes 30 seconds
  },
  isPublished: {
    type: Boolean,
    default: false,
  },
  views: {
    type: Number,
    default: 0,
  },
  likes: {
    type: Number,
    default: 0,
  },
  likedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  }],
}, { 
  timestamps: true 
});

// Index for better query performance
coursePlaylistSchema.index({ course: 1, order: 1 });
coursePlaylistSchema.index({ teacher: 1 });

const CoursePlaylist = mongoose.model("CoursePlaylist", coursePlaylistSchema);

export { CoursePlaylist };
