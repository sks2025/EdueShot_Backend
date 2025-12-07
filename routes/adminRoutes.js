import express from 'express';
import adminController from '../controllers/adminController.js';
import authenticateToken, { adminOnly } from '../Middleware/userAuth.js';
import { courseUpload, handleUploadError } from '../Middleware/upload.js';

const router = express.Router();

// Admin login (can also use regular login endpoint)
router.post('/login', adminController.adminLogin);

// Create Admin (one-time setup - protected by secret key from .env)
router.post('/create', adminController.createAdmin);

// Dashboard statistics (admin only)
router.get('/dashboard/stats', authenticateToken, adminOnly, adminController.getDashboardStats);

// User management (admin only)
router.get('/users', authenticateToken, adminOnly, adminController.getAllUsers);
router.get('/users/:id', authenticateToken, adminOnly, adminController.getUserById);
router.put('/users/:id', authenticateToken, adminOnly, adminController.updateUser);
router.delete('/users/:id', authenticateToken, adminOnly, adminController.deleteUser);

// Student management (admin only - only for students)
router.get('/students', authenticateToken, adminOnly, adminController.getAllStudents);
router.get('/students/:id', authenticateToken, adminOnly, adminController.getStudentById);
router.put('/students/:id', authenticateToken, adminOnly, adminController.updateStudent);
router.delete('/students/:id', authenticateToken, adminOnly, adminController.deleteStudent);

// Teacher management (admin only - only for teachers)
router.get('/teachers', authenticateToken, adminOnly, adminController.getAllTeachers);
router.get('/teachers/:id', authenticateToken, adminOnly, adminController.getTeacherById);
router.put('/teachers/:id', authenticateToken, adminOnly, adminController.updateTeacher);
router.delete('/teachers/:id', authenticateToken, adminOnly, adminController.deleteTeacher);

// Course management (admin only)
router.get('/courses', authenticateToken, adminOnly, adminController.getAllCourses);
router.get('/courses/admin-created', authenticateToken, adminOnly, adminController.getAdminCreatedCourses);
router.get('/courses/:id', authenticateToken, adminOnly, adminController.getCourseById);
router.post('/courses', authenticateToken, adminOnly, courseUpload, handleUploadError, adminController.createCourse);
router.put('/courses/:id', authenticateToken, adminOnly, courseUpload, handleUploadError, adminController.updateCourse);
router.delete('/courses/:id', authenticateToken, adminOnly, adminController.deleteCourse);

// Payment management (admin only)
router.get('/payments', authenticateToken, adminOnly, adminController.getAllPayments);

// Quiz management (admin only)
router.get('/quizzes', authenticateToken, adminOnly, adminController.getAllQuizzes);
router.get('/quizzes/admin-created', authenticateToken, adminOnly, adminController.getAdminCreatedQuizzes);

// Quiz attempts and rankings (admin only) - MUST come before :id route
router.get('/quizzes/:quizId/attempts', authenticateToken, adminOnly, adminController.getQuizAttempts);
router.get('/quizzes/:quizId/rankings', authenticateToken, adminOnly, adminController.getQuizRankings);

// General quiz routes - MUST come after specific routes
router.get('/quizzes/:id', authenticateToken, adminOnly, adminController.getQuizById);
router.post('/quizzes', authenticateToken, adminOnly, adminController.createQuiz);
router.put('/quizzes/:id', authenticateToken, adminOnly, adminController.updateQuiz);
router.delete('/quizzes/:id', authenticateToken, adminOnly, adminController.deleteQuiz);

// Video management (admin only)
router.get('/videos', authenticateToken, adminOnly, adminController.getAllVideos);

export default router;

