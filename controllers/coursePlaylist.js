import { CoursePlaylist } from "../Models/courseplaylistModel.js";
import { Course } from "../Models/courseModel.js";

// Get base URL configuration
const getBaseUrl = () => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3002';
  console.log('🌐 Base URL configured:', baseUrl);
  return baseUrl;
};

// Helper function to generate full URL for uploaded files
const generateFileUrl = (filename) => {
  if (!filename) return null;
  
  const baseUrl = getBaseUrl();
  const fullUrl = `${baseUrl}/uploads/${filename}`;
  
  console.log('🔗 Generated file URL:', fullUrl);
  return fullUrl;
};

// Helper function to ensure URL is full
const ensureFullUrl = (url) => {
  if (!url) return null;
  
  console.log('🖼️ Processing URL:', url);
  
  // Already full URL
  if (url.startsWith('http')) {
    console.log('✅ Already full URL:', url);
    return url;
  }
  
  // Handle /uploads/ prefix
  if (url.startsWith('/uploads/')) {
    const filename = url.replace('/uploads/', '');
    const fullUrl = generateFileUrl(filename);
    console.log('✅ Generated full URL from /uploads/ path:', fullUrl);
    return fullUrl;
  }
  
  // Handle direct filename
  const fullUrl = generateFileUrl(url);
  console.log('✅ Generated full URL from filename:', fullUrl);
  return fullUrl;
};

// Helper function to process playlist item and ensure all URLs are full
const processPlaylistItem = (item) => {
  if (!item) return null;
  
  const processedItem = {
    ...item.toObject ? item.toObject() : item,
    thumbnail: ensureFullUrl(item.thumbnail),
    videoFile: item.videoFile ? ensureFullUrl(item.videoFile) : null,
  };
  
  console.log('📝 Processed playlist item URLs:', {
    thumbnail: processedItem.thumbnail,
    videoFile: processedItem.videoFile
  });
  
  return processedItem;
};

// ✅ Get Base URL Configuration (for frontend)
export const getBaseUrlConfig = async (req, res) => {
  try {
    const baseUrl = getBaseUrl();
    
    res.status(200).json({
      success: true,
      baseUrl: baseUrl,
      uploadsUrl: `${baseUrl}/uploads/`,
      message: "Base URL configuration retrieved successfully"
    });
  } catch (error) {
    console.error('Get base URL config error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ✅ Create Playlist Item (only Teacher who owns the course)
export const createPlaylistItem = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    const { courseId } = req.params;
    const { title, description, contentType, category, duration } = req.body;
    
    // Get uploaded files from multer
    const videoFile = req.files?.video?.[0]?.filename;
    const thumbnail = req.files?.thumbnail?.[0]?.filename;

    // Check if user is teacher
    if (userRole !== "teacher") {
      return res.status(403).json({
        success: false,
        message: "Only teachers can create playlist items",
      });
    }

    // Validate required fields
    if (!title || !description || !contentType || !category) {
      return res.status(400).json({
        success: false,
        message: "Title, description, contentType, and category are required",
      });
    }

    // Validate thumbnail is uploaded
    if (!thumbnail) {
      return res.status(400).json({
        success: false,
        message: "Thumbnail file is required",
      });
    }

    // Check if course exists and user owns it
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    if (course.teacher.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only add playlist items to your own courses",
      });
    }

    // Validate videoFile for video/audio content
    if ((contentType === "video" || contentType === "audio") && !videoFile) {
      return res.status(400).json({
        success: false,
        message: "Video file is required for video/audio content type",
      });
    }

    // Get the next order number for this course
    const lastItem = await CoursePlaylist.findOne({ course: courseId })
      .sort({ order: -1 });
    const nextOrder = lastItem ? lastItem.order + 1 : 1;

    const playlistItem = new CoursePlaylist({
      title,
      description,
      contentType,
      category,
      videoFile: videoFile || null,
      thumbnail,
      course: courseId,
      teacher: userId,
      order: nextOrder,
      duration: duration || null,
    });

    await playlistItem.save();

    // Process the playlist item to ensure all URLs are full
    const processedPlaylistItem = processPlaylistItem(playlistItem);

    res.status(201).json({
      success: true,
      message: "Playlist item created successfully",
      playlistItem: processedPlaylistItem,
    });
  } catch (error) {
    console.error('Create playlist item error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ✅ Get All Playlist Items for a Course
export const getCoursePlaylist = async (req, res) => {
  try {
    const { courseId } = req.params;
    
    console.log('🔍 Debug: Looking for course with ID:', courseId);
    console.log('🔍 Debug: Course ID type:', typeof courseId);
    console.log('🔍 Debug: Course ID length:', courseId.length);

    // Check if course exists
    const course = await Course.findById(courseId);
    console.log('🔍 Debug: Course found:', course ? 'YES' : 'NO');
    
    if (!course) {
      // Let's also check if there are any courses in the database
      const allCourses = await Course.find({}).select('_id title');
      console.log('🔍 Debug: All courses in database:', allCourses);
      
      return res.status(404).json({
        success: false,
        message: "Course not found",
        debug: {
          requestedCourseId: courseId,
          totalCoursesInDB: allCourses.length,
          availableCourseIds: allCourses.map(c => c._id.toString())
        }
      });
    }

    const playlistItems = await CoursePlaylist.find({ course: courseId })
      .populate("teacher", "name email")
      .sort({ order: 1 });

    // Process all playlist items to ensure URLs are full
    const processedPlaylistItems = playlistItems.map(item => processPlaylistItem(item));

    res.status(200).json({ 
      success: true, 
      course: {
        _id: course._id,
        title: course.title,
        description: course.description,
      },
      playlistItems: processedPlaylistItems 
    });
  } catch (error) {
    console.error('Get course playlist error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ✅ Get Single Playlist Item
export const getPlaylistItemById = async (req, res) => {
  try {
    const { courseId, itemId } = req.params;

    const playlistItem = await CoursePlaylist.findOne({ 
      _id: itemId, 
      course: courseId 
    }).populate("teacher", "name email");

    if (!playlistItem) {
      return res.status(404).json({ 
        success: false, 
        message: "Playlist item not found" 
      });
    }

    // Process the playlist item to ensure all URLs are full
    const processedPlaylistItem = processPlaylistItem(playlistItem);

    res.status(200).json({ 
      success: true, 
      playlistItem: processedPlaylistItem 
    });
  } catch (error) {
    console.error('Get playlist item error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ✅ Update Playlist Item (only Teacher who owns the course)
export const updatePlaylistItem = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    const { courseId, itemId } = req.params;
    
    // Get uploaded files from multer (if any)
    const videoFile = req.files?.video?.[0]?.filename;
    const thumbnail = req.files?.thumbnail?.[0]?.filename;

    // Check if user is teacher
    if (userRole !== "teacher") {
      return res.status(403).json({
        success: false,
        message: "Only teachers can update playlist items",
      });
    }

    const playlistItem = await CoursePlaylist.findOne({ 
      _id: itemId, 
      course: courseId 
    });

    if (!playlistItem) {
      return res.status(404).json({
        success: false,
        message: "Playlist item not found",
      });
    }

    if (playlistItem.teacher.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own playlist items",
      });
    }

    const updates = req.body;
    
    // Add uploaded files to updates if they exist
    if (videoFile) {
      updates.videoFile = videoFile;
    }
    if (thumbnail) {
      updates.thumbnail = thumbnail;
    }
    
    Object.assign(playlistItem, updates);

    await playlistItem.save();

    // Process the playlist item to ensure all URLs are full
    const processedPlaylistItem = processPlaylistItem(playlistItem);

    res.status(200).json({ 
      success: true, 
      message: "Playlist item updated successfully",
      playlistItem: processedPlaylistItem 
    });
  } catch (error) {
    console.error('Update playlist item error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ✅ Delete Playlist Item (only Teacher who owns the course)
export const deletePlaylistItem = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    const { courseId, itemId } = req.params;

    // Check if user is teacher
    if (userRole !== "teacher") {
      return res.status(403).json({
        success: false,
        message: "Only teachers can delete playlist items",
      });
    }

    const playlistItem = await CoursePlaylist.findOne({ 
      _id: itemId, 
      course: courseId 
    });

    if (!playlistItem) {
      return res.status(404).json({
        success: false,
        message: "Playlist item not found",
      });
    }

    if (playlistItem.teacher.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own playlist items",
      });
    }

    await CoursePlaylist.deleteOne({ _id: itemId });

    res.status(200).json({ 
      success: true, 
      message: "Playlist item deleted successfully" 
    });
  } catch (error) {
    console.error('Delete playlist item error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ✅ Reorder Playlist Items
export const reorderPlaylistItems = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    const { courseId } = req.params;
    const { items } = req.body; // Array of { itemId, order }

    // Check if user is teacher
    if (userRole !== "teacher") {
      return res.status(403).json({
        success: false,
        message: "Only teachers can reorder playlist items",
      });
    }

    // Check if course exists and user owns it
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    if (course.teacher.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only reorder playlist items in your own courses",
      });
    }

    // Update order for each item
    const updatePromises = items.map(({ itemId, order }) => 
      CoursePlaylist.updateOne(
        { _id: itemId, course: courseId, teacher: userId },
        { order }
      )
    );

    await Promise.all(updatePromises);

    res.status(200).json({ 
      success: true, 
      message: "Playlist items reordered successfully" 
    });
  } catch (error) {
    console.error('Reorder playlist items error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ✅ Like/Unlike Playlist Item
export const likePlaylistItem = async (req, res) => {
  try {
    const { courseId, itemId } = req.params;
    const userId = req.user.userId;

    const playlistItem = await CoursePlaylist.findOne({ 
      _id: itemId, 
      course: courseId 
    });

    if (!playlistItem) {
      return res.status(404).json({ 
        success: false, 
        message: "Playlist item not found" 
      });
    }

    const alreadyLiked = playlistItem.likedBy.includes(userId);

    if (alreadyLiked) {
      // Unlike
      playlistItem.likes -= 1;
      playlistItem.likedBy.pull(userId);
      await playlistItem.save();
      return res.json({ 
        success: true, 
        message: "Playlist item unliked", 
        likes: playlistItem.likes,
        isLiked: false
      });
    } else {
      // Like
      playlistItem.likes += 1;
      playlistItem.likedBy.push(userId);
      await playlistItem.save();
      return res.json({ 
        success: true, 
        message: "Playlist item liked", 
        likes: playlistItem.likes,
        isLiked: true
      });
    }
  } catch (error) {
    console.error('Like playlist item error:', error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      details: error.message 
    });
  }
};

// ✅ Increment View Count
export const incrementViewCount = async (req, res) => {
  try {
    const { courseId, itemId } = req.params;

    const playlistItem = await CoursePlaylist.findOne({ 
      _id: itemId, 
      course: courseId 
    });

    if (!playlistItem) {
      return res.status(404).json({ 
        success: false, 
        message: "Playlist item not found" 
      });
    }

    playlistItem.views += 1;
    await playlistItem.save();

    res.json({ 
      success: true, 
      message: "View count incremented",
      views: playlistItem.views
    });
  } catch (error) {
    console.error('Increment view count error:', error);
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
};
