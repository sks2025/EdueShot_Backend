import User from '../Models/userModel.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import authenticateToken from '../Middleware/userAuth.js';
import sendEmail from '../Common/nodeMailer.js';


// Register user
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validation
    if (!name || !email || !password || !role) {
      return res.status(400).json({ 
        success: false, 
        message: "Name, email and password are required" 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address"
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'User already exists with this email' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user (automatically verified since no OTP system)
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role,
      isVerified: true
    });

    await user.save();

    // const subject = "Verify Your Email – EduSpark";
    // const text = `Hello ${name},\n\nYour OTP for email verification is: ${otp}\n\nThis code is valid for 10 minutes.`;
    // const html = `
    //   <h2>Hello ${name},</h2>
    //   <p>Your OTP for email verification is:</p>
    //   <h1 style="letter-spacing:3px;">${otp}</h1>
    //   <p>This code is valid for <b>10 minutes</b>.</p>
    // `;

    // await sendEmail(email, subject, text, html);
  
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      isVerified: user.isVerified,
      createdAt: user.createdAt
    };

    return res.status(201).json({ 
      success: true, 
      message: "User registered successfully. Please check your email for verification OTP.",
      user: userResponse,
    });
  
    } catch (error) {
      console.error('Registration error:', error);
      return res.status(500).json({ 
        success: false, 
        message: "Internal server error during registration",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }


//send otp
const sendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    // 1️⃣ Validate input
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    // 2️⃣ Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email"
      });
    }

    // Optional: If user is already verified, block sending OTP
    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "This email is already verified"
      });
    }

    // 3️⃣ Generate a new OTP (valid for 10 minutes)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    // Update user with new OTP
    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    // 4️⃣ Send OTP email
    const subject = "Your OTP Code – EduSpark";
    const text = `Hello ${user.name},\n\nYour new OTP for email verification is: ${otp}\n\nThis code will expire in 10 minutes.`;
    const html = `
      <h2>Hello ${user.name},</h2>
      <p>Your new OTP for email verification is:</p>
      <h1 style="letter-spacing:3px;">${otp}</h1>
      <p>This code is valid for <b>10 minutes</b>.</p>
    `;

    await sendEmail(email, subject, text, html);

    return res.status(200).json({
      success: true,
      message: "A new OTP has been sent to your email address"
    });

  } catch (error) {
    console.error("Send OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while sending OTP",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

  

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // User is automatically verified since no OTP system

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
};

const verifyOTP = async (request, response) => {
  try {
    const { email, otp } = request.body;

    if (!email || !otp) {
      return response.status(400).json({
        success: false,
        message: "Email and OTP are required"
      });
    }

    const user = await User.findOne({ 
      email: email,
      otp: otp,
      otpExpires: { $gt: new Date() }
    });

    if (!user) {
      return response.status(400).json({
        success: false,
        message: "Invalid or expired OTP"
      });
    }

    // Update user as verified and clear OTP
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    return response.status(200).json({
      success: true,
      message: "Email verified successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified
      }
    });

  } catch (error) {
    console.error('OTP verification error:', error);
    return response.status(500).json({
      success: false,
      message: "Internal server error during OTP verification"
    });
  }
}
// OTP functions removed - no longer needed

const resendOTP = async (req, res) => {
  try {
    console.log('Resend OTP request received:', req.body);
    
    const { email } = req.body;

    // Validation
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found for resend OTP:', email);
      return res.status(404).json({ 
        success: false, 
        message: 'User not found with this email address' 
      });
    }

    // Check if user is already verified
    if (user.isVerified) {
      return res.status(400).json({ 
        success: false, 
        message: 'User is already verified' 
      });
    }
    
    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    console.log('Generated new OTP for resend:', email, ':', otp);
    console.log('OTP expires at:', otpExpires);

    // Update user with new OTP
    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    // TODO: Uncomment when email service is ready
    // await sendOtpEmail(email, otp, {
    //   subject: 'Verify your account (resend OTP)',
    //   text: `Your OTP is: ${otp}. It is valid for 10 minutes.`,
    //   html: `<p>Your OTP is: <b>${otp}</b></p><p>It is valid for 10 minutes.</p>`
    // });

    console.log('Resend OTP saved for user:', email);

    return res.status(200).json({ 
      success: true, 
      message: 'OTP resent to your email address',
      // In development, you might want to include the OTP for testing
      ...(process.env.NODE_ENV === 'development' && { otp: otp })
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error during OTP resend',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
// Get user profile by ID (public route)
const getProfile = async (req, res) => {
  try {
    const userId = req.params.id;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const user = await User.findById(userId).select('-password -otp -otpExpires');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get current user's profile (authenticated route)
const getMyProfile = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    const user = await User.findById(userId).select('-password -otp -otpExpires');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Get my profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user?.userId; // Get user ID from JWT token
    const { name, email } = req.body;

    // Validation - at least one field must be provided
    if (!name && !email) {
      return res.status(400).json({
        success: false,
        message: 'At least one field (name or email) must be provided for update'
      });
    }

    // Validate email format if email is being updated
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid email address'
        });
      }
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if email already exists (if email is being updated)
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists. Please use a different email address'
        });
      }
    }

    // Update only the provided fields
    if (name) user.name = name;
    if (email) user.email = email;

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during profile update'
    });
  }
};

// Update any user profile by ID (public route - for admin use)
const updateUserProfile = async (req, res) => {
  try {
    console.log('updateUserProfile called with params:', req.params);
    console.log('updateUserProfile called with body:', req.body);
    
    const userId = req.params.id;
    const { name, email } = req.body;

    // Validation - at least one field must be provided
    if (!name && !email) {
      return res.status(400).json({
        success: false,
        message: 'At least one field (name or email) must be provided for update'
      });
    }

    // Validate email format if email is being updated
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid email address'
        });
      }
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if email already exists (if email is being updated)
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists. Please use a different email address'
        });
      }
    }

    // Update only the provided fields
    if (name) user.name = name;
    if (email) user.email = email;

    await user.save();

    res.json({
      success: true,
      message: 'User profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during profile update'
    });
  }
};

//for forgot password
const forgotPassword = async (req, res) => {
  try {
    console.log('Forgot password request received:', req.body);

    const { email } = req.body;

    // Validation
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found for email:', email);
      return res.status(404).json({
        success: false,
        message: 'User not found with this email address'
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    console.log('Generated OTP for password reset:', email, ':', otp);
    console.log('OTP expires at:', otpExpires);

    // Update user with OTP
    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    // TODO: Uncomment when email service is ready
    // await sendOtpEmail(email, otp, {
    //   subject: 'Password Reset OTP',
    //   text: `Your password reset OTP is: ${otp}. It is valid for 10 minutes.`,
    //   html: `<p>Your password reset OTP is: <b>${otp}</b></p><p>It is valid for 10 minutes.</p>`
    // });

    console.log('Password reset OTP saved for user:', email);

    return res.status(200).json({
      success: true,
      message: 'Password reset OTP sent to your email address',
      // In development, you might want to include the OTP for testing
      ...(process.env.NODE_ENV === 'development' && { otp: otp })
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during password reset',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

const resetPassword = async (req, res) => {
  try {
    console.log('Reset password request received:', req.body);
    
    const { email, otp, newPassword } = req.body;
    
    // Validation
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email, OTP, and new password are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Validate password length
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found for password reset:', email);
      return res.status(404).json({ 
        success: false, 
        message: 'User not found with this email address' 
      });
    }

    // Verify OTP
    if (user.otp !== otp || user.otpExpires < new Date()) {
      console.log('Invalid or expired OTP for user:', email);
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired OTP' 
      });
    }

    // Hash new password and clear OTP
    user.password = await bcrypt.hash(newPassword, 10);
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    console.log('Password reset successful for user:', email);

    return res.status(200).json({ 
      success: true, 
      message: 'Password reset successful' 
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error during password reset',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
//delete user profile
const deleteUserProfile = async (req, res) => {
  try {
    const userId = req.params.id;
    await User.findByIdAndDelete(userId);
    res.json({ success: true, message: 'User profile deleted successfully' });
  } catch (error) {
    console.error('Delete user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during profile deletion'
    });
  }
}

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.json({ success: true, users });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ success: false, message: 'Internal server error during users retrieval' });
  }
}



export default {
  register,
  verifyOTP,
  resendOTP,
  login,
  getProfile,
  getMyProfile,
  updateProfile,
  updateUserProfile,
  deleteUserProfile,
  getAllUsers,
  forgotPassword,
  resetPassword,
  sendOtp
};
