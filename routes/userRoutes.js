import express from 'express';
import userController from '../controllers/userController.js';
import authenticateToken from '../Middleware/userAuth.js';

const router = express.Router();

// Debug route to test if routes are working
router.get('/test', (req, res) => {
  res.json({ message: 'Routes are working!', timestamp: new Date().toISOString() });
});

// User routes
router.post('/register', userController.register);
router.post('/verify', userController.verifyOTP);
router.post('/login', userController.login);

// Protected profile routes (require authentication)
router.get('/get/:id', authenticateToken, userController.getProfile);
router.put('/update/:id', authenticateToken, userController.updateUserProfile);
router.get('/profile', authenticateToken, userController.getMyProfile);
router.put('/profile', authenticateToken, userController.updateProfile);
router.delete('/delete/:id', authenticateToken, userController.deleteUserProfile);

export default router;