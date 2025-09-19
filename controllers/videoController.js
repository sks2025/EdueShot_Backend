import Video from '../Models/videoModel.js';

const uploadVideo = async (req, res) => {
  try {
    

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
      videoUrl: videoFile.path,
      thumbnailUrl: thumbFile ? thumbFile.path : null,
      uploadedBy: req.user.userId // from authenticate middleware (JWT contains userId, not _id)
    });

    console.log('💾 Saving video to database...');
    await newVideo.save();
    console.log('✅ Video saved successfully');
    
    res.status(201).json({ message: 'Video uploaded successfully', video: newVideo });
  } catch (err) {
   
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

    // Delete the video
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

export default {
  uploadVideo,
  getAllVideos,
  getVideoById,
  getMyVideos,
  deleteVideo
};
