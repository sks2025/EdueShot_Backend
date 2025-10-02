import { Course } from "../Models/courseModel.js";
import User from "../Models/userModel.js";

// Helper function to generate full URL for uploaded files
const generateFileUrl = (filename) => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3002';
  return `${baseUrl}/uploads/${filename}`;
};

// Helper function to ensure URL is full (for backward compatibility)
const ensureFullUrl = (url) => {
  if (!url) return null;
  
  console.log('🖼️ Processing thumbnail URL:', url);
  
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

// ✅ Create Course (only Teacher)
export const createCourse = async (req, res) => {
  try {
    
    
    const userId = req.user.userId; // from auth middleware
    const userRole = req.user.role; // from auth middleware

    if (userRole !== "teacher") {
      console.log('Access denied - User role is not teacher:', userRole);
      return res.status(403).json({
        success: false,
        message: "Only teachers can create courses",
        debug: {
          userRole: userRole,
          userId: userId
        }
      });
    }

    const { title, description, thumbnail, price, details } = req.body;

    if (!title || !description || !thumbnail || !price) {
      return res.status(400).json({
        success: false,
        message: "Title, description, thumbnail and price are required",
      });
    }

    const course = new Course({
      title,
      description,
      thumbnail: thumbnail, // Store the filename as-is, we'll process URLs when retrieving
      price,
      details,
      teacher: userId,
    });

    await course.save();

    // Convert course to object and ensure thumbnail has full URL
    const courseWithFullUrl = {
      ...course.toObject(),
      thumbnail: ensureFullUrl(course.thumbnail)
    };

    res.status(201).json({
      success: true,
      message: "Course created successfully",
      course: courseWithFullUrl,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Get All Courses
export const getCourses = async (req, res) => {
  try {
    const courses = await Course.find()
      .populate("teacher", "name email")
      .populate("students", "name email");

    // Ensure all thumbnail URLs are full URLs
    const coursesWithFullUrls = courses.map(course => ({
      ...course.toObject(),
      thumbnail: ensureFullUrl(course.thumbnail)
    }));

    res.status(200).json({ success: true, courses: coursesWithFullUrls });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Get Single Course by ID
export const getCourseById = async (req, res) => {
  try {
    const { courseId } = req.params;
    const course = await Course.findById(courseId)
      .populate("teacher", "name email")
      .populate("students", "name email");

    if (!course) {
      return res.status(404).json({ 
        success: false, 
        message: "Course not found" 
      });
    }

    // Ensure thumbnail URL is full URL
    const courseWithFullUrl = {
      ...course.toObject(),
      thumbnail: ensureFullUrl(course.thumbnail)
    };

    res.status(200).json({ 
      success: true, 
      course: courseWithFullUrl 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ✅ Enroll in a Course (student pays -> enroll)
export const enrollCourse = async (req, res) => {
  try {
    const userId = req.userId; // student
    const { courseId } = req.params;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    if (course.students.includes(userId)) {
      return res.status(400).json({ success: false, message: "Already enrolled" });
    }

    // here you can add payment verification logic before enrollment
    course.students.push(userId);
    await course.save();

    res.status(200).json({ success: true, message: "Enrolled successfully", course });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Update Course (only teacher who created it)
export const updateCourse = async (req, res) => {
  try {
    const userId = req.userId;
    const { courseId } = req.params;

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    if (course.teacher.toString() !== userId) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const updates = req.body;
    Object.assign(course, updates);

    await course.save();

    res.status(200).json({ success: true, message: "Course updated", course });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Delete Course (only teacher who created it)
export const deleteCourse = async (req, res) => {
  try {
    const userId = req.userId;
    const { courseId } = req.params;

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    if (course.teacher.toString() !== userId) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    await course.deleteOne();

    res.status(200).json({ success: true, message: "Course deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Like/Unlike Course
export const likeCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.userId; // From JWT token

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ 
        success: false, 
        message: "Course not found" 
      });
    }

    const alreadyLiked = course.likedBy.includes(userId);

    if (alreadyLiked) {
      // 👎 Unlike
      course.likes -= 1;
      course.likedBy.pull(userId);
      await course.save();
      return res.json({ 
        success: true, 
        message: "Course unliked", 
        likes: course.likes,
        isLiked: false
      });
    } else {
      // 👍 Like
      course.likes += 1;
      course.likedBy.push(userId);
      await course.save();
      return res.json({ 
        success: true, 
        message: "Course liked", 
        likes: course.likes,
        isLiked: true
      });
    }

  } catch (error) {
    console.error('Like course error:', error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      details: error.message 
    });
  }
};

// ✅ Get Course Likes Count
export const getCourseLikes = async (req, res) => {
  try {
    const { courseId } = req.params;
    const course = await Course.findById(courseId).select('likes likedBy');

    if (!course) {
      return res.status(404).json({ 
        success: false, 
        message: "Course not found" 
      });
    }

    res.json({
      success: true,
      courseId: courseId,
      likes: course.likes,
      likedBy: course.likedBy.length
    });
  } catch (error) {
    console.error('Get course likes error:', error);
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
};
