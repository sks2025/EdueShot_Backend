import Video from '../Models/videoModel.js';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffprobe from 'ffprobe-static';

// Set ffprobe path
ffmpeg.setFfprobePath(ffprobe.path);

// Helper function to get video duration in seconds
const getVideoDuration = (videoPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        console.error('Error getting video duration:', err);
        reject(err);
      } else {
        const duration = metadata.format.duration;
        console.log(`Video duration: ${duration} seconds`);
        resolve(duration);
      }
    });
  });
};

// Helper function to generate full URL for uploaded files
const generateFileUrl = (filename) => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3002';
  return `${baseUrl}/uploads/${filename}`;
};

// Helper function to ensure URL is full (for backward compatibility)
const ensureFullUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url; // Already full URL
  if (url.startsWith('/uploads/')) {
    const filename = url.replace('/uploads/', '');
    return generateFileUrl(filename);
  }
  return generateFileUrl(url);
};

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

    const { title, description, category, customCategory } = req.body;

    console.log('📋 Video data:', { title, description, category, customCategory });

    // Get video duration to determine content type
    const videoPath = path.join(process.cwd(), 'uploads', videoFile.filename);
    let contentType = 'full'; // Default to full
    
    try {
      const duration = await getVideoDuration(videoPath);
      contentType = duration > 30 ? 'reel' : 'full';
      console.log(`📏 Video duration: ${duration}s, Content type: ${contentType}`);
    } catch (durationError) {
      console.warn('⚠️ Could not determine video duration, defaulting to full:', durationError.message);
      // Keep default contentType as 'full'
    }

    const newVideo = new Video({
      title,
      description,
      contentType, // Automatically determined based on duration
      category: category ? category.split(',') : [], // if array comes as CSV
      customCategory,
      videoUrl: generateFileUrl(videoFile.filename),
      thumbnailUrl: thumbFile ? generateFileUrl(thumbFile.filename) : null,
      uploadedBy: req.user.userId // from authenticate middleware (JWT contains userId, not _id)
    });

    console.log('💾 Saving video to database...');
    await newVideo.save();
    console.log('✅ Video saved successfully');
    
    res.status(201).json({ 
      message: 'Video uploaded successfully', 
      video: newVideo,
      duration: contentType === 'reel' ? '>30s' : '≤30s'
    });
  } catch (err) {
    console.error('Upload video error:', err);
    res.status(500).json({ error: 'Failed to upload video', details: err.message });
  }
};

const getAllVideos = async (req, res) => {
  try {
    const videos = await Video.find().populate('uploadedBy', 'name email');
    
    // Ensure all URLs are full URLs
    const videosWithFullUrls = videos.map(video => ({
      ...video.toObject(),
      videoUrl: ensureFullUrl(video.videoUrl),
      thumbnailUrl: ensureFullUrl(video.thumbnailUrl)
    }));
    
    res.json(videosWithFullUrls);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
};

const getVideoById = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id).populate('uploadedBy', 'name email');
    if (!video) return res.status(404).json({ error: 'Video not found' });
    
    // Ensure URLs are full URLs
    const videoWithFullUrls = {
      ...video.toObject(),
      videoUrl: ensureFullUrl(video.videoUrl),
      thumbnailUrl: ensureFullUrl(video.thumbnailUrl)
    };
    
    res.json(videoWithFullUrls);
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
    
    // Ensure all URLs are full URLs
    const videosWithFullUrls = videos.map(video => ({
      ...video.toObject(),
      videoUrl: ensureFullUrl(video.videoUrl),
      thumbnailUrl: ensureFullUrl(video.thumbnailUrl)
    }));
    
    res.json({
      success: true,
      count: videosWithFullUrls.length,
      videos: videosWithFullUrls
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

    // Extract filename from full URL or relative path
    const filename = video.videoUrl.includes('/uploads/') 
      ? video.videoUrl.split('/uploads/')[1] 
      : video.videoUrl.replace('/uploads/', '');
    
    const videoPath = path.join(process.cwd(), 'uploads', filename);
    
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

// Stream all videos without requiring ID - perfect for video feed
const streamAllVideos = async (req, res) => {
  try {
    console.log('📱 Stream all videos request received');
    
    // Get query parameters for filtering
    const contentType = req.query.type; // 'reel' or 'full'
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    
    // Build query
    let query = {};
    if (contentType && ['reel', 'full'].includes(contentType)) {
      query.contentType = contentType;
    }
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get videos from database
    const videos = await Video.find(query)
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 }) // Latest first
      .skip(skip)
      .limit(limit);
    
    if (videos.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'No videos found' 
      });
    }
    
    // Transform videos for streaming format
    const streamableVideos = videos.map(video => {
      const videoObj = video.toObject();
      
      // Extract filename from videoUrl
      const filename = videoObj.videoUrl.includes('/uploads/') 
        ? videoObj.videoUrl.split('/uploads/')[1] 
        : videoObj.videoUrl.replace('/uploads/', '');
      
      return {
        id: videoObj._id,
        title: videoObj.title,
        description: videoObj.description,
        contentType: videoObj.contentType,
        category: videoObj.category,
        thumbnail: ensureFullUrl(videoObj.thumbnailUrl),
        videoUrl: ensureFullUrl(videoObj.videoUrl),
        filename: filename, // For direct streaming
        creator: {
          id: videoObj.uploadedBy._id,
          name: videoObj.uploadedBy.name,
          email: videoObj.uploadedBy.email
        },
        stats: {
          likes: videoObj.likes || 0
        },
        createdAt: videoObj.createdAt
      };
    });
    
    console.log(`📱 Streaming ${streamableVideos.length} videos`);
    
    res.json({
      success: true,
      data: {
        videos: streamableVideos,
        pagination: {
          currentPage: page,
          limit,
          totalVideos: streamableVideos.length
        },
        metadata: {
          contentType: contentType || 'all',
          streamType: 'feed_format'
        }
      }
    });
    
  } catch (err) {
    console.error('📱 Stream all videos error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to stream videos', 
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
    const videoFilename = video.videoUrl.includes('/uploads/') 
      ? video.videoUrl.split('/uploads/')[1] 
      : video.videoUrl.replace('/uploads/', '');
    const videoPath = path.join(process.cwd(), 'uploads', videoFilename);
    if (fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath);
    }

    // Delete thumbnail if exists
    if (video.thumbnailUrl) {
      const thumbFilename = video.thumbnailUrl.includes('/uploads/') 
        ? video.thumbnailUrl.split('/uploads/')[1] 
        : video.thumbnailUrl.replace('/uploads/', '');
      const thumbPath = path.join(process.cwd(), 'uploads', thumbFilename);
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

// Get videos by content type (reel or full)
const getVideosByType = async (req, res) => {
  try {
    const { type } = req.params; // 'reel' or 'full'
    
    if (!['reel', 'full'].includes(type)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid content type. Must be 'reel' or 'full'" 
      });
    }

    const videos = await Video.find({ contentType: type })
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 }); // Latest first
    
    // Ensure all URLs are full URLs
    const videosWithFullUrls = videos.map(video => ({
      ...video.toObject(),
      videoUrl: ensureFullUrl(video.videoUrl),
      thumbnailUrl: ensureFullUrl(video.thumbnailUrl)
    }));
    
    res.json({
      success: true,
      contentType: type,
      count: videosWithFullUrls.length,
      videos: videosWithFullUrls
    });
  } catch (err) {
    console.error('Get videos by type error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch videos',
      details: err.message 
    });
  }
};



export default {
  uploadVideo,
  getAllVideos,
  getVideoById,
  getMyVideos,
  streamVideo,
  streamAllVideos,
  deleteVideo,
  likeVideo,
  getLikes,
  getVideosByType
};
