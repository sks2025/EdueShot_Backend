import express from 'express';
import authenticateToken from '../Middleware/userAuth.js';
import { createQuiz, getAllQuizzes, getQuizById, deleteQuiz } from '../controllers/quizController.js';
const router = express.Router();

// Simple test route

router.post("/create", authenticateToken, createQuiz); // Teacher create quiz
router.get("/all", authenticateToken, getAllQuizzes); // Get all quizzes
router.get("/:id", authenticateToken, getQuizById); // Get quiz by ID
router.delete("/:id", authenticateToken, deleteQuiz); // Teacher delete quiz

export default router;
