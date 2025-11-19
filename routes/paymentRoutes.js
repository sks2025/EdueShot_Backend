import express from 'express';
import authenticateToken from '../Middleware/userAuth.js';
import { 
  createOrder, 
  verifyPayment, 
  getUserPayments, 
  getPaymentById, 
  refundPayment 
} from '../controllers/paymentController.js';

const router = express.Router();

// Create payment order
router.post('/create-order', authenticateToken, createOrder);

// Verify payment
router.post('/verify', authenticateToken, verifyPayment);

// Get user's payments
router.get('/my-payments', authenticateToken, getUserPayments);

// Get payment by ID
router.get('/:id', authenticateToken, getPaymentById);

// Refund payment (Admin/Teacher only)
router.post('/:id/refund', authenticateToken, refundPayment);

export default router;

