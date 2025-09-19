import express from 'express';
import authenticate from '../Middleware/userAuth.js';
import { createQuiz, getAllQuizzes, getQuizById } from '../controllers/quizController.js';
const router = express.Router();

// Simple test route

router.post("/create", authenticate, createQuiz); // Teacher create quiz
router.get("/all", authenticate, getAllQuizzes); // Get all quizzes
router.get("/:id", authenticate, getQuizById); // Get quiz by ID

export default router;
