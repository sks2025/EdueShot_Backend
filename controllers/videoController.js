import Video from '../Models/videoModel.js';
import fs from 'fs';
import path from 'path';

const uploadVideo = async (req, res) => {
  try {
    console.log('Upload video request received:', req.body);
    
    // Multer stores files in req.files
    const videoFile = req.files?.video?.[0];
    const thumbFile = req.files?.thumbnail?.[0];

    console.log('🎥 Video file:', videoFile);
    console.log('🖼️ Thumbnail file:', thumbFile);

    if (!videoFile) {
      console.log('❌ No video file found');
      return res.status(400).json({ error: 'Video file is required' });
    }

    const { title, description, contentType, category, customCategory } = req.body;

    console.log('📋 Video data:', { title, description, contentType, category, customCategory });

    const newVideo = new Video({
      title,
      description,
      contentType,
      category: category ? category.split(',') : [], // if array comes as CSV
      customCategory,
      videoUrl: `/uploads/${videoFile.filename}`,
      thumbnailUrl: thumbFile ? `/uploads/${thumbFile.filename}` : null,
      uploadedBy: req.user.userId // from authenticate middleware (JWT contains userId, not _id)
    });

    console.log('💾 Saving video to database...');
    await newVideo.save();
    console.log('✅ Video saved successfully');
    
    res.status(201).json({ message: 'Video uploaded successfully', video: newVideo });
  } catch (err) {
    console.error('Upload video error:', err);
    res.status(500).json({ error: 'Failed to upload video', details: err.message });
  }
};

const getAllVideos = async (req, res) => {
  try {
    const videos = await Video.find().populate('uploadedBy', 'name email');
    res.json(videos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
};

const getVideoById = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id).populate('uploadedBy', 'name email');
    if (!video) return res.status(404).json({ error: 'Video not found' });
    res.json(video);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
};

const getMyVideos = async (req, res) => {
  try {
    const userId = req.user.userId; // From JWT token
    const videos = await Video.find({ uploadedBy: userId })
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 }); // Latest first
    
    res.json({
      success: true,
      count: videos.length,
      videos
    });
  } catch (err) {
    console.error('Get my videos error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch your videos',
      details: err.message 
    });
  }
};


const streamVideo = async (req, res) => {
  try {
    const videoId = req.params.id;
    const video = await Video.findById(videoId);
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const videoPath = path.join(process.cwd(), video.videoUrl);
    
    // Check if file exists
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ error: 'Video file not found on server' });
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // Partial content request (for video seeking)
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      // Full video request
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(200, head);
      fs.createReadStream(videoPath).pipe(res);
    }
  } catch (err) {
    console.error('Stream video error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to stream video',
      details: err.message 
    });
  }
};

const deleteVideo = async (req, res) => {
  try {
    const videoId = req.params.id;
    const userId = req.user.userId; // From JWT token

    // Find the video first
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Check if user owns the video
    if (video.uploadedBy.toString() !== userId) {
      return res.status(403).json({ 
        error: 'Unauthorized - You can only delete your own videos' 
      });
    }

    // Delete the video file from filesystem
    const videoPath = path.join(process.cwd(), video.videoUrl);
    if (fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath);
    }

    // Delete thumbnail if exists
    if (video.thumbnailUrl) {
      const thumbPath = path.join(process.cwd(), video.thumbnailUrl);
      if (fs.existsSync(thumbPath)) {
        fs.unlinkSync(thumbPath);
      }
    }

    // Delete the video record from database
    await Video.findByIdAndDelete(videoId);
    
    res.json({ 
      success: true,
      message: 'Video deleted successfully' 
    });
  } catch (err) {
    console.error('Delete video error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete video',
      details: err.message 
    });
  }
};



//like video
// PUT /api/videos/:id/like
const likeVideo = async (req, res) => {
  try {
    const { id } = req.params;       // Video ID from URL
    const userId = req.user.userId;  // User ID from auth middleware (JWT contains userId)

    const video = await Video.findById(id);
    if (!video) return res.status(404).json({ success: false, message: "Video not found" });

    const alreadyLiked = video.likedBy.includes(userId);

    if (alreadyLiked) {
      // 👎 Unlike
      video.likes -= 1;
      video.likedBy.pull(userId);
      await video.save();
      return res.json({ success: true, message: "Unliked", likes: video.likes });
    } else {
      // 👍 Like
      video.likes += 1;
      video.likedBy.push(userId);
      await video.save();
      return res.json({ success: true, message: "Liked", likes: video.likes });
    }

  } catch (err) {
    console.error('Like video error:', err);
    res.status(500).json({ success: false, message: "Server error", details: err.message });
  }
};


//get liked videos
// GET /api/videos/:id/likes
const getLikes = async (req, res) => {
  try {
    const { id } = req.params; // Video ID from URL
    const video = await Video.findById(id).select('likes'); // only return likes field

    if (!video) {
      return res.status(404).json({ success: false, message: "Video not found" });
    }

    res.json({
      success: true,
      videoId: id,
      likes: video.likes
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



export default {
  uploadVideo,
  getAllVideos,
  getVideoById,
  getMyVideos,
  streamVideo,
  deleteVideo,
  likeVideo,
  getLikes
};
