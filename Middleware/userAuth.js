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

export default authenticateToken;
