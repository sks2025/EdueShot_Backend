import User from '../Models/userModel.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import authenticateToken from '../Middleware/userAuth.js';
// import { transporter } from '../Common/nodeMailer.js';


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

    // Generate OTP for email verification
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    console.log('Generated OTP for', email, ':', otp);
    console.log('OTP expires at:', otpExpires);

    // Hash password

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role,
      otp : otp,
      otpExpires : otpExpires,
      isVerified: false
    });

    await user.save();

      
  
      // Send verification email
      // try {
      //   const mailOptions = {
      //     from: process.env.SENDER_EMAIL,
      //     to: email,
      //     subject: 'Welcome! Verify Your Account',
      //     html: `
      //       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      //         <h2 style="color: #333;">Welcome to our platform!</h2>
      //          <p>Your account has been created successfully with name: <strong>${name}</strong></p>
      //         <p>Please verify your email address using the OTP below:</p>
      //         <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
      //           <h1 style="color: #007bff; font-size: 32px; margin: 0;">${otp}</h1>
      //         </div>
      //         <p style="color: #666;">This OTP will expire in 10 minutes.</p>
      //         <p>If you didn't create this account, please ignore this email.</p>
      //       </div>
      //     `
      //   };
  
      //   await transporter.sendMail(mailOptions);
      // } catch (emailError) {
      //   console.error('Email sending failed:', emailError);
      //   // Don't fail registration if email fails
      // }
  
       // Remove sensitive data from response
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

 const verifyOTP= async (request, response)=> {
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


export default {
  register,
  verifyOTP,
  login,
  getProfile,
  getMyProfile,
  updateProfile,
  updateUserProfile,
  deleteUserProfile
};
