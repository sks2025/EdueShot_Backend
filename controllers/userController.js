import User from '../Models/userModel.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import authenticateToken from '../Middleware/userAuth.js';
import sendEmail from '../Common/nodeMailer.js';


// Register user with OTP verification
const register = async (req, res) => {
  try {
    const { name, email, password, role, otp } = req.body;

    // Validation
    if (!name || !email || !password || !role) {
      return res.status(400).json({ 
        success: false, 
        message: "Name, email, password and role are required" 
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

    // Check if user already exists and is verified
    const existingVerifiedUser = await User.findOne({ email, isVerified: true });
    if (existingVerifiedUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'User already exists with this email. Please use login instead.' 
      });
    }

    // If OTP is provided, verify it and complete registration
    if (otp) {
      // Find pending user with matching OTP
      const pendingUser = await User.findOne({ 
        email, 
        otp, 
        otpExpires: { $gt: new Date() },
        isVerified: false
      });

      if (!pendingUser) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired OTP. Please request a new OTP."
        });
      }

      console.log('Found pending user for registration:', email);
      console.log('Pending user OTP:', pendingUser.otp);
      console.log('Provided OTP:', otp);

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update pending user to complete registration with verified status
      pendingUser.name = name;
      pendingUser.password = hashedPassword;
      pendingUser.role = role;
      pendingUser.isVerified = true;
      pendingUser.otp = undefined;
      pendingUser.otpExpires = undefined;
      
      await pendingUser.save();
      
      // Verify the user was saved correctly
      const savedUser = await User.findById(pendingUser._id);
      console.log('User registration completed and verified:', email);
      console.log('User isVerified status in memory:', pendingUser.isVerified);
      console.log('User isVerified status in database:', savedUser.isVerified);
      console.log('User saved successfully:', !!savedUser);

      const userResponse = {
        _id: pendingUser._id,
        name: pendingUser.name,
        email: pendingUser.email,
        role: pendingUser.role,
        isVerified: pendingUser.isVerified,
        createdAt: pendingUser.createdAt
      };

      return res.status(201).json({ 
        success: true, 
        message: "User registered and email verified successfully!",
        user: userResponse,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Please verify your email with OTP before completing registration."
      });
    }
  
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

    // 2️⃣ Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address"
      });
    }

    // 3️⃣ Check if user already exists and is verified
    const existingVerifiedUser = await User.findOne({ email, isVerified: true });
    if (existingVerifiedUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email. Please use login instead."
      });
    }

    // 4️⃣ Generate a new OTP (valid for 10 minutes)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    console.log('Generated OTP for', email, ':', otp);
    console.log('OTP expires at:', otpExpires);

    // 5️⃣ Create or update pending user record
    let pendingUser = await User.findOne({ email, isVerified: false });
    
    if (pendingUser) {
      // Update existing pending user with new OTP
      pendingUser.otp = otp;
      pendingUser.otpExpires = otpExpires;
      await pendingUser.save();
      console.log('Updated existing pending user with new OTP');
      console.log('Updated user ID:', pendingUser._id);
      console.log('Updated user isVerified:', pendingUser.isVerified);
    } else {
      // Create new pending user for email verification
      pendingUser = new User({
        email,
        otp,
        otpExpires,
        isVerified: false
      });
      await pendingUser.save();
      console.log('Created new pending user for email verification');
      console.log('New user ID:', pendingUser._id);
      console.log('New user isVerified:', pendingUser.isVerified);
    }

    // 6️⃣ Send OTP email
    const subject = "Welcome to EduSpark - Email Verification OTP";
    const text = `Welcome to EduSpark!\n\nYour OTP for email verification is: ${otp}\n\nThis code will expire in 10 minutes.\n\nUse this OTP to complete your new account registration.\n\nIf you didn't create an account with EduSpark, please ignore this email.`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #667eea; margin: 0;">Welcome to EduSpark!</h1>
        </div>
        
        <h2 style="color: #333;">Email Verification Required</h2>
        <p>Thank you for starting your registration with EduSpark. To complete your account setup, please verify your email address using the OTP below:</p>
        
        <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 25px; text-align: center; margin: 25px 0; border-radius: 12px;">
          <h1 style="letter-spacing: 8px; color: white; margin: 0; font-size: 2.5em;">${otp}</h1>
        </div>
        
        <p><strong>Important:</strong></p>
        <ul style="color: #555;">
          <li>This code is valid for <strong>10 minutes</strong></li>
          <li>Enter this OTP in the registration form to complete your account</li>
          <li>Do not share this code with anyone</li>
        </ul>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px; text-align: center;">
          If you didn't create an account with EduSpark, please ignore this email.<br>
          This is an automated message, please do not reply.
        </p>
      </div>
    `;

    console.log('Attempting to send email to:', email);
    await sendEmail(email, subject, text, html);
    console.log('Email sent successfully to:', email);

    return res.status(200).json({
      success: true,
      message: "OTP has been sent to your email address. Please check your inbox to complete registration."
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

  

// Login user - Only verified users allowed
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
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
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // CRITICAL: Check if user is verified - Only verified users can login
    if (!user.isVerified) {
      console.log('Login attempt by unverified user:', email);
      return res.status(403).json({
        success: false,
        message: 'Email verification required. Please complete your registration by verifying your email address.',
        requiresVerification: true
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log('Invalid password attempt for user:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token for verified user
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    console.log('Successful login for verified user:', email);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

    // Find pending user with matching OTP
    const pendingUser = await User.findOne({ 
      email: email,
      otp: otp,
      otpExpires: { $gt: new Date() },
      isVerified: false
    });

    if (!pendingUser) {
      return response.status(400).json({
        success: false,
        message: "Invalid or expired OTP. Please request a new OTP."
      });
    }

    console.log('OTP verification successful for:', email);
    console.log('User ready for registration completion');

    // Return success - user can now complete registration
    return response.status(200).json({
      success: true,
      message: "OTP verified successfully. You can now complete your registration.",
      email: email,
      verified: true
    });

  } catch (error) {
    console.error('OTP verification error:', error);
    return response.status(500).json({
      success: false,
      message: "Internal server error during OTP verification",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
