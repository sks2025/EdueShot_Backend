import jwt from 'jsonwebtoken';

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
 
  
  const authHeader = req.headers['authorization'];
  console.log('🔑 Auth header:', authHeader);
  
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  console.log('🎫 Token:', token ? 'Present' : 'Missing');

  if (!token) {
    console.log('No token provided');
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      console.log('Token verification failed:', err.message);
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
 
    req.user = user;
    next();
  });
};

// Teacher-only middleware - checks if user has teacher role
const teacherOnly = (req, res, next) => {
  // First check if user is authenticated
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Check if user has teacher role
  if (req.user.role !== 'teacher') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only teachers can perform this action.'
    });
  }

  next();
};

// Admin-only middleware - checks if user has admin role
const adminOnly = (req, res, next) => {
  // First check if user is authenticated
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Check if user has admin role
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only administrators can perform this action.'
    });
  }

  next();
};

export { authenticateToken, teacherOnly, adminOnly };
export default authenticateToken;
