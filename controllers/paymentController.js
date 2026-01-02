import Razorpay from 'razorpay';
import crypto from 'crypto';
import { Payment } from '../Models/paymentModel.js';
import { Course } from '../Models/courseModel.js';
import { Withdrawal } from '../Models/withdrawalModel.js';
import User from '../Models/userModel.js';
import { createNotification } from './notificationController.js';
import AdminNotification from '../Models/adminNotificationModel.js';
import dotenv from 'dotenv';
dotenv.config();

// Lazy initialization function for Razorpay
const getRazorpayInstance = () => {
  const keyId = rzp_test_RbFbqNg7LGgSPC;
  const keySecret = Xiu7UYMCvWFEaWVxfNZb1yDY;

  if (!keyId || !keySecret) {
    throw new Error('Razorpay credentials are not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment variables.');
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

// ✅ Create Payment Order
export const createOrder = async (req, res) => {
  try {
    const { courseId } = req.body;
    const userId = req.user.userId;

    // Find the course
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if user has already purchased this course
    const existingPayment = await Payment.findOne({
      userId,
      courseId,
      status: 'completed'
    });

    if (existingPayment) {
      return res.status(400).json({
        success: false,
        message: 'You have already purchased this course'
      });
    }

    // Convert amount to paise (Razorpay uses smallest currency unit)
    const amountInPaise = course.price * 100;

    // Create Razorpay order
    const razorpay = getRazorpayInstance();
    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `course_${courseId}_${Date.now()}`,
      notes: {
        userId: userId.toString(),
        courseId: courseId.toString(),
        courseName: course.title
      }
    });

    // Save payment record in database
    const payment = new Payment({
      orderId: razorpayOrder.id,
      userId,
      courseId,
      amount: course.price,
      currency: 'INR',
      razorpayOrderId: razorpayOrder.id,
      status: 'pending'
    });

    await payment.save();

    res.status(200).json({
      success: true,
      message: 'Order created successfully',
      order: {
        orderId: razorpayOrder.id,
        amount: course.price,
        currency: 'INR',
        key: process.env.RAZORPAY_KEY_ID,
        name: 'Edu-Spark',
        description: course.title,
        prefill: {
          name: req.user.name || 'User',
          email: req.user.email
        },
        course: {
          id: course._id,
          title: course.title,
          description: course.description,
          thumbnail: course.thumbnail,
          price: course.price
        }
      }
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating order',
      error: error.message
    });
  }
};

// ✅ Verify Payment
export const verifyPayment = async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    const userId = req.user.userId;

    // Find the payment record
    const payment = await Payment.findOne({
      razorpayOrderId,
      userId,
      status: 'pending'
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found or already verified'
      });
    }

    // Verify the signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (generatedSignature !== razorpaySignature) {
      // Update payment status to failed
      payment.status = 'failed';
      await payment.save();

      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }

    // Find the course to add student
    const course = await Course.findById(payment.courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if student is already enrolled
    if (!course.students.includes(userId)) {
      course.students.push(userId);
      await course.save();
    }

    // Update payment record
    payment.paymentId = razorpayPaymentId;
    payment.razorpayPaymentId = razorpayPaymentId;
    payment.razorpaySignature = razorpaySignature;
    payment.status = 'completed';
    await payment.save();

    // Send notification to teacher about the course purchase
    if (course.teacher) {
      try {
        // Populate course teacher if not already populated
        const courseWithTeacher = await Course.findById(payment.courseId).populate('teacher', 'name email');
        
        // Get student details for notification
        const student = await User.findById(userId).select('name email');

        if (courseWithTeacher.teacher && courseWithTeacher.teacher._id) {
          await createNotification({
            recipientId: courseWithTeacher.teacher._id,
            recipientRole: 'teacher',
            type: 'course_purchase',
            title: 'New Course Purchase!',
            message: `${student?.name || 'A student'} has purchased your course "${course.title}"`,
            fromUserId: userId,
            relatedCourseId: payment.courseId,
            data: {
              amount: payment.amount,
              courseName: course.title,
              studentName: student?.name || 'Unknown',
              studentEmail: student?.email || ''
            }
          });
          console.log(`📬 Notification sent to teacher for course purchase: ${course.title}`);
        }
      } catch (notifError) {
        console.error('Error sending notification to teacher:', notifError);
        // Don't fail payment verification if notification fails
      }
    }

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      payment: {
        id: payment._id,
        courseId: payment.courseId,
        courseName: course.title,
        amount: payment.amount,
        status: payment.status,
        enrolledAt: new Date()
      }
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying payment',
      error: error.message
    });
  }
};

// ✅ Get User Payments
export const getUserPayments = async (req, res) => {
  try {
    const userId = req.user.userId;

    const payments = await Payment.find({ userId })
      .populate('courseId', 'title description thumbnail price teacher')
      .sort({ createdAt: -1 });

    const formattedPayments = payments.map(payment => ({
      id: payment._id,
      orderId: payment.orderId,
      amount: payment.amount,
      status: payment.status,
      course: payment.courseId,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt
    }));

    res.status(200).json({
      success: true,
      message: 'Payments fetched successfully',
      payments: formattedPayments,
      count: formattedPayments.length
    });
  } catch (error) {
    console.error('Get user payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payments',
      error: error.message
    });
  }
};

// ✅ Get Payment by ID
export const getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const payment = await Payment.findById(id)
      .populate('courseId', 'title description thumbnail price teacher')
      .populate('userId', 'name email');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check if user is authorized to view this payment
    if (payment.userId._id.toString() !== userId && req.user.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to view this payment'
      });
    }

    res.status(200).json({
      success: true,
      payment: {
        id: payment._id,
        orderId: payment.orderId,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        course: payment.courseId,
        user: payment.userId,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt
      }
    });
  } catch (error) {
    console.error('Get payment by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payment',
      error: error.message
    });
  }
};

// ✅ Refund Payment (Admin/Teacher only)
export const refundPayment = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the payment
    const payment = await Payment.findById(id).populate('courseId');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check if payment is completed
    if (payment.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Only completed payments can be refunded'
      });
    }

    // Initiate Razorpay refund
    const razorpay = getRazorpayInstance();
    const refund = await razorpay.payments.refund(payment.razorpayPaymentId, {
      amount: payment.amount * 100 // Convert to paise
    });

    // Update payment status
    payment.status = 'refunded';
    await payment.save();

    // Remove student from course
    const course = await Course.findById(payment.courseId);
    if (course) {
      course.students = course.students.filter(
        studentId => studentId.toString() !== payment.userId.toString()
      );
      await course.save();
    }

    res.status(200).json({
      success: true,
      message: 'Refund processed successfully',
      refund: {
        refundId: refund.id,
        amount: payment.amount,
        status: payment.status
      }
    });
  } catch (error) {
    console.error('Refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing refund',
      error: error.message
    });
  }
};

// ✅ Get Teacher Earnings (payments received for their courses)
export const getTeacherEarnings = async (req, res) => {
  try {
    const teacherId = req.user.userId;

    // Get all courses by this teacher
    const teacherCourses = await Course.find({ teacher: teacherId }).select('_id title');
    const courseIds = teacherCourses.map(course => course._id);

    // Get all completed payments for these courses
    const payments = await Payment.find({
      courseId: { $in: courseIds },
      status: 'completed'
    })
      .populate('courseId', 'title price thumbnail')
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    // Calculate totals
    const totalEarnings = payments.reduce((sum, p) => sum + p.amount, 0);

    // Get withdrawals
    const withdrawals = await Withdrawal.find({ userId: teacherId });
    const totalWithdrawn = withdrawals
      .filter(w => w.status === 'completed')
      .reduce((sum, w) => sum + w.amount, 0);
    const pendingWithdrawals = withdrawals
      .filter(w => w.status === 'pending')
      .reduce((sum, w) => sum + w.amount, 0);

    const availableBalance = totalEarnings - totalWithdrawn - pendingWithdrawals;

    const formattedPayments = payments.map(payment => ({
      id: payment._id,
      type: 'earning',
      title: 'Course Sale',
      description: payment.courseId?.title || 'Course',
      amount: payment.amount,
      status: payment.status,
      student: payment.userId,
      course: payment.courseId,
      date: payment.createdAt,
      icon: '💰'
    }));

    res.status(200).json({
      success: true,
      message: 'Teacher earnings fetched successfully',
      summary: {
        totalEarnings,
        totalWithdrawn,
        pendingWithdrawals,
        availableBalance,
        totalCourses: teacherCourses.length,
        totalSales: payments.length
      },
      earnings: formattedPayments
    });
  } catch (error) {
    console.error('Get teacher earnings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching earnings',
      error: error.message
    });
  }
};

// ✅ Request Withdrawal (Teacher only)
export const requestWithdrawal = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount, paymentMethod, bankDetails, upiId } = req.body;

    // Validate amount
    if (!amount || amount < 100) {
      return res.status(400).json({
        success: false,
        message: 'Minimum withdrawal amount is ₹100'
      });
    }

    // Check available balance
    const teacherCourses = await Course.find({ teacher: userId }).select('_id');
    const courseIds = teacherCourses.map(course => course._id);

    const payments = await Payment.find({
      courseId: { $in: courseIds },
      status: 'completed'
    });
    const totalEarnings = payments.reduce((sum, p) => sum + p.amount, 0);

    const withdrawals = await Withdrawal.find({ userId });
    const totalWithdrawn = withdrawals
      .filter(w => w.status === 'completed')
      .reduce((sum, w) => sum + w.amount, 0);
    const pendingWithdrawals = withdrawals
      .filter(w => w.status === 'pending')
      .reduce((sum, w) => sum + w.amount, 0);

    const availableBalance = totalEarnings - totalWithdrawn - pendingWithdrawals;

    if (amount > availableBalance) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₹${availableBalance}`
      });
    }

    // Get user details
    const user = await User.findById(userId).select('name email role');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Create withdrawal request
    const withdrawal = new Withdrawal({
      userId,
      amount,
      paymentMethod,
      bankDetails: paymentMethod === 'bank_transfer' ? bankDetails : undefined,
      upiId: paymentMethod === 'upi' ? upiId : undefined,
      status: 'pending'
    });

    await withdrawal.save();

    // Create admin notification for withdrawal request
    try {
      const adminNotification = new AdminNotification({
        type: 'withdrawal',
        title: `Withdrawal Request - ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}`,
        message: `${user.name} (${user.email}) has requested a withdrawal of ₹${amount} via ${paymentMethod === 'bank_transfer' ? 'Bank Transfer' : paymentMethod === 'upi' ? 'UPI' : 'Paytm'}.`,
        fromUser: userId,
        data: {
          userRole: user.role,
          userEmail: user.email,
          userName: user.name,
          withdrawalId: withdrawal._id.toString(),
          withdrawalAmount: amount,
          paymentMethod: paymentMethod
        },
        status: 'unread'
      });
      await adminNotification.save();
      console.log(`📬 Admin notification created for withdrawal request from ${user.email}`);
    } catch (notifError) {
      console.error('Error creating admin notification:', notifError);
      // Don't fail withdrawal if notification fails
    }

    // Send notification to user about withdrawal request
    try {
      await createNotification({
        recipientId: userId,
        recipientRole: user.role,
        type: 'system',
        title: 'Withdrawal Request Submitted',
        message: `Your withdrawal request of ₹${amount} has been submitted successfully. The amount will be credited to your account within 48-72 hours.`,
        fromUserId: null,
        data: {
          withdrawalAmount: amount,
          paymentMethod: paymentMethod
        }
      });
      console.log(`📬 User notification sent for withdrawal request`);
    } catch (userNotifError) {
      console.error('Error sending user notification:', userNotifError);
      // Don't fail withdrawal if notification fails
    }

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted successfully. Your amount will be credited within 48-72 hours.',
      withdrawal: {
        id: withdrawal._id,
        amount: withdrawal.amount,
        status: withdrawal.status,
        paymentMethod: withdrawal.paymentMethod,
        createdAt: withdrawal.createdAt
      }
    });
  } catch (error) {
    console.error('Request withdrawal error:', error);
    res.status(500).json({
      success: false,
      message: 'Error requesting withdrawal',
      error: error.message
    });
  }
};

// ✅ Get User Withdrawals
export const getUserWithdrawals = async (req, res) => {
  try {
    const userId = req.user.userId;

    const withdrawals = await Withdrawal.find({ userId })
      .sort({ createdAt: -1 });

    const formattedWithdrawals = withdrawals.map(w => ({
      id: w._id,
      type: 'withdrawal',
      title: 'Withdrawal',
      description: w.paymentMethod === 'bank_transfer' ? 'Bank Transfer' :
                   w.paymentMethod === 'upi' ? 'UPI Transfer' : 'Paytm',
      amount: -w.amount,
      status: w.status,
      paymentMethod: w.paymentMethod,
      transactionId: w.transactionId,
      date: w.createdAt,
      processedAt: w.processedAt,
      icon: '🏦'
    }));

    res.status(200).json({
      success: true,
      message: 'Withdrawals fetched successfully',
      withdrawals: formattedWithdrawals,
      count: formattedWithdrawals.length
    });
  } catch (error) {
    console.error('Get user withdrawals error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching withdrawals',
      error: error.message
    });
  }
};

// ✅ Get Complete History (for both students and teachers)
export const getHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;

    let history = [];

    if (userRole === 'student') {
      // Get student's course purchases
      const payments = await Payment.find({ userId })
        .populate('courseId', 'title price thumbnail teacher')
        .sort({ createdAt: -1 });

      history = payments.map(p => ({
        id: p._id,
        type: 'purchase',
        title: 'Course Purchase',
        description: p.courseId?.title || 'Course',
        amount: p.amount,
        status: p.status,
        course: p.courseId,
        date: p.createdAt,
        icon: '🎓'
      }));

    } else if (userRole === 'teacher') {
      // Get teacher's earnings
      const teacherCourses = await Course.find({ teacher: userId }).select('_id title');
      const courseIds = teacherCourses.map(course => course._id);

      const earnings = await Payment.find({
        courseId: { $in: courseIds },
        status: 'completed'
      })
        .populate('courseId', 'title price thumbnail')
        .populate('userId', 'name email')
        .sort({ createdAt: -1 });

      const earningsHistory = earnings.map(p => ({
        id: p._id,
        type: 'earning',
        title: 'Course Sale',
        description: p.courseId?.title || 'Course',
        amount: p.amount,
        status: 'completed',
        student: { name: p.userId?.name, email: p.userId?.email },
        date: p.createdAt,
        icon: '💰'
      }));

      // Get teacher's withdrawals
      const withdrawals = await Withdrawal.find({ userId })
        .sort({ createdAt: -1 });

      const withdrawalsHistory = withdrawals.map(w => ({
        id: w._id,
        type: 'withdrawal',
        title: 'Withdrawal',
        description: w.paymentMethod === 'bank_transfer' ? 'Bank Transfer' :
                     w.paymentMethod === 'upi' ? 'UPI Transfer' : 'Paytm',
        amount: -w.amount,
        status: w.status,
        paymentMethod: w.paymentMethod,
        transactionId: w.transactionId,
        date: w.createdAt,
        icon: '🏦'
      }));

      // Combine and sort by date
      history = [...earningsHistory, ...withdrawalsHistory].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      );
    }

    // Calculate summary
    const totalPurchases = history.filter(h => h.type === 'purchase').reduce((sum, h) => sum + h.amount, 0);
    const totalEarnings = history.filter(h => h.type === 'earning').reduce((sum, h) => sum + h.amount, 0);
    const totalWithdrawals = history.filter(h => h.type === 'withdrawal').reduce((sum, h) => sum + Math.abs(h.amount), 0);

    res.status(200).json({
      success: true,
      message: 'History fetched successfully',
      summary: {
        totalPurchases,
        totalEarnings,
        totalWithdrawals,
        balance: totalEarnings - totalWithdrawals
      },
      history,
      count: history.length
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching history',
      error: error.message
    });
  }
};

