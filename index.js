import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import userRoutes from './routes/userRoutes.js';
import videoRoutes from './routes/videoRoutes.js';
import quizRoutes from './routes/quizRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
// Import routes

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3002;
const dbURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/edu-spark';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static('public'));

// Serve uploaded files from uploads directory
app.use('/uploads', express.static('uploads', {
  setHeaders: (res, path) => {
    console.log('📁 Serving static file:', path);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
  }
}));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/courses', courseRoutes);
// Basic route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Edu-Spark API is running!',
    version: '1.0.0',
    endpoints: {
      users: '/api/users',
      register: 'POST /api/users/register',
      login: 'POST /api/users/login',
      profile: 'GET /api/users/profile'
    }
  });
});

// Database connection with better error handling
const connectDB = async () => {
  try {
    if (!dbURI) {
      console.error('MONGODB_URI is not defined in environment variables');
      process.exit(1);
    }
    
    await mongoose.connect(dbURI);
    console.log('Connected to MongoDB successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

// Connect to database
connectDB();

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`API endpoint: http://localhost:${PORT}`);
    console.log(`Users API: http://localhost:${PORT}/api/users`);
});

export default app;