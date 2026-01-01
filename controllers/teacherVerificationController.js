import User from '../Models/userModel.js';
import { createNotification } from './notificationController.js';

// Helper function to generate full URL for uploaded files
const getBaseUrl = () => {
  const defaultUrl = 'http://192.168.43.18:3002';
  return process.env.BASE_URL || defaultUrl;
};

const generateFileUrl = (filename) => {
  if (!filename) return null;
  if (filename.startsWith('http')) return filename;
  return `${getBaseUrl()}/uploads/${filename}`;
};

// Submit verification documents (Teacher only)
export const submitVerificationDocuments = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;

    // Only teachers can submit verification
    if (userRole !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can submit verification documents'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if already verified
    if (user.teacherVerification?.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Your account is already verified'
      });
    }

    // Check if verification is pending
    if (user.teacherVerification?.status === 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Your verification is already pending review. Please wait 48-72 hours.'
      });
    }

    // Get uploaded files
    const files = req.files;

    if (!files?.aadharFront?.[0] || !files?.aadharBack?.[0] || !files?.panCard?.[0] || !files?.marksheet?.[0]) {
      return res.status(400).json({
        success: false,
        message: 'All documents are required: Aadhar Front, Aadhar Back, PAN Card, and Marksheet',
        received: {
          aadharFront: !!files?.aadharFront?.[0],
          aadharBack: !!files?.aadharBack?.[0],
          panCard: !!files?.panCard?.[0],
          marksheet: !!files?.marksheet?.[0]
        }
      });
    }

    // Update user with verification documents
    user.teacherVerification = {
      status: 'pending',
      aadharFront: files.aadharFront[0].filename,
      aadharBack: files.aadharBack[0].filename,
      panCard: files.panCard[0].filename,
      marksheet: files.marksheet[0].filename,
      submittedAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: null
    };

    await user.save();

    // Notify all admins about new verification request
    const admins = await User.find({ role: 'admin', isActive: true });
    for (const admin of admins) {
      await createNotification({
        recipientId: admin._id,
        recipientRole: 'admin',
        type: 'system',
        title: 'New Teacher Verification Request',
        message: `${user.name} has submitted documents for teacher verification. Please review.`,
        fromUserId: userId,
        data: {
          teacherName: user.name,
          teacherEmail: user.email
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Verification documents submitted successfully. Please wait 48-72 hours for review.',
      verification: {
        status: 'pending',
        submittedAt: user.teacherVerification.submittedAt
      }
    });

  } catch (error) {
    console.error('Submit verification error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get verification status (Teacher only)
export const getVerificationStatus = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId).select('teacherVerification name email role');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const verification = user.teacherVerification || { status: 'not_submitted' };

    res.status(200).json({
      success: true,
      verification: {
        status: verification.status,
        submittedAt: verification.submittedAt,
        reviewedAt: verification.reviewedAt,
        rejectionReason: verification.rejectionReason,
        documents: verification.status !== 'not_submitted' ? {
          aadharFront: generateFileUrl(verification.aadharFront),
          aadharBack: generateFileUrl(verification.aadharBack),
          panCard: generateFileUrl(verification.panCard),
          marksheet: generateFileUrl(verification.marksheet)
        } : null
      }
    });

  } catch (error) {
    console.error('Get verification status error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get pending verifications (Admin only)
export const getPendingVerifications = async (req, res) => {
  try {
    const userRole = req.user.role;

    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view pending verifications'
      });
    }

    const pendingTeachers = await User.find({
      role: 'teacher',
      'teacherVerification.status': 'pending'
    }).select('name email profilePic teacherVerification createdAt');

    const formattedTeachers = pendingTeachers.map(teacher => ({
      _id: teacher._id,
      name: teacher.name,
      email: teacher.email,
      profilePic: generateFileUrl(teacher.profilePic),
      submittedAt: teacher.teacherVerification.submittedAt,
      documents: {
        aadharFront: generateFileUrl(teacher.teacherVerification.aadharFront),
        aadharBack: generateFileUrl(teacher.teacherVerification.aadharBack),
        panCard: generateFileUrl(teacher.teacherVerification.panCard),
        marksheet: generateFileUrl(teacher.teacherVerification.marksheet)
      }
    }));

    res.status(200).json({
      success: true,
      count: formattedTeachers.length,
      teachers: formattedTeachers
    });

  } catch (error) {
    console.error('Get pending verifications error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all verifications with filter (Admin only)
export const getAllVerifications = async (req, res) => {
  try {
    const userRole = req.user.role;
    const { status } = req.query; // pending, approved, rejected, not_submitted

    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view verifications'
      });
    }

    let query = { role: 'teacher' };
    if (status && status !== 'all') {
      query['teacherVerification.status'] = status;
    }

    const teachers = await User.find(query)
      .select('name email profilePic teacherVerification createdAt')
      .sort({ 'teacherVerification.submittedAt': -1 });

    const formattedTeachers = teachers.map(teacher => ({
      _id: teacher._id,
      name: teacher.name,
      email: teacher.email,
      profilePic: generateFileUrl(teacher.profilePic),
      verificationStatus: teacher.teacherVerification?.status || 'not_submitted',
      submittedAt: teacher.teacherVerification?.submittedAt,
      reviewedAt: teacher.teacherVerification?.reviewedAt,
      rejectionReason: teacher.teacherVerification?.rejectionReason,
      documents: teacher.teacherVerification?.aadharFront ? {
        aadharFront: generateFileUrl(teacher.teacherVerification.aadharFront),
        aadharBack: generateFileUrl(teacher.teacherVerification.aadharBack),
        panCard: generateFileUrl(teacher.teacherVerification.panCard),
        marksheet: generateFileUrl(teacher.teacherVerification.marksheet)
      } : null
    }));

    res.status(200).json({
      success: true,
      count: formattedTeachers.length,
      teachers: formattedTeachers
    });

  } catch (error) {
    console.error('Get all verifications error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Approve teacher verification (Admin only)
export const approveVerification = async (req, res) => {
  try {
    const adminId = req.user.userId;
    const userRole = req.user.role;
    const { teacherId } = req.params;

    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can approve verifications'
      });
    }

    const teacher = await User.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    if (teacher.role !== 'teacher') {
      return res.status(400).json({
        success: false,
        message: 'User is not a teacher'
      });
    }

    if (teacher.teacherVerification?.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'No pending verification request found'
      });
    }

    // Approve verification
    teacher.teacherVerification.status = 'approved';
    teacher.teacherVerification.reviewedAt = new Date();
    teacher.teacherVerification.reviewedBy = adminId;
    teacher.teacherVerification.rejectionReason = null;

    await teacher.save();

    // Notify teacher about approval
    await createNotification({
      recipientId: teacherId,
      recipientRole: 'teacher',
      type: 'system',
      title: 'Verification Approved!',
      message: 'Congratulations! Your teacher verification has been approved. Your courses are now visible to students.',
      fromUserId: adminId
    });

    res.status(200).json({
      success: true,
      message: 'Teacher verification approved successfully',
      teacher: {
        _id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        verificationStatus: 'approved'
      }
    });

  } catch (error) {
    console.error('Approve verification error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Reject teacher verification (Admin only)
export const rejectVerification = async (req, res) => {
  try {
    const adminId = req.user.userId;
    const userRole = req.user.role;
    const { teacherId } = req.params;
    const { reason } = req.body;

    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can reject verifications'
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const teacher = await User.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    if (teacher.role !== 'teacher') {
      return res.status(400).json({
        success: false,
        message: 'User is not a teacher'
      });
    }

    if (teacher.teacherVerification?.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'No pending verification request found'
      });
    }

    // Reject verification
    teacher.teacherVerification.status = 'rejected';
    teacher.teacherVerification.reviewedAt = new Date();
    teacher.teacherVerification.reviewedBy = adminId;
    teacher.teacherVerification.rejectionReason = reason;

    await teacher.save();

    // Notify teacher about rejection
    await createNotification({
      recipientId: teacherId,
      recipientRole: 'teacher',
      type: 'system',
      title: 'Verification Rejected',
      message: `Your verification was rejected. Reason: ${reason}. Please resubmit with correct documents.`,
      fromUserId: adminId
    });

    res.status(200).json({
      success: true,
      message: 'Teacher verification rejected',
      teacher: {
        _id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        verificationStatus: 'rejected',
        rejectionReason: reason
      }
    });

  } catch (error) {
    console.error('Reject verification error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
