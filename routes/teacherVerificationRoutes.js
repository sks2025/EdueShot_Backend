import express from 'express';
import authenticateToken from '../Middleware/userAuth.js';
import { verificationDocsUpload, handleUploadError } from '../Middleware/upload.js';
import {
  submitVerificationDocuments,
  getVerificationStatus,
  getPendingVerifications,
  getAllVerifications,
  approveVerification,
  rejectVerification
} from '../controllers/teacherVerificationController.js';

const router = express.Router();

// Teacher routes
router.post('/submit', authenticateToken, verificationDocsUpload, handleUploadError, submitVerificationDocuments);
router.get('/status', authenticateToken, getVerificationStatus);

// Admin routes
router.get('/pending', authenticateToken, getPendingVerifications);
router.get('/all', authenticateToken, getAllVerifications);
router.put('/approve/:teacherId', authenticateToken, approveVerification);
router.put('/reject/:teacherId', authenticateToken, rejectVerification);

export default router;
