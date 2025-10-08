import express from 'express';
import authenticateToken from '../Middleware/userAuth.js';
import { createQuiz, getAllQuizzes, getQuizById, deleteQuiz, getQuizzesForStudentDashboard, getStudentDashboardQuizzes, startQuiz, getQuizQuestion, submitAnswer, completeQuiz } from '../controllers/quizController.js';
const router = express.Router();

// Simple test route

router.post("/create", authenticateToken, createQuiz); // Teacher create quiz
router.get("/all", authenticateToken, getAllQuizzes); // Get all quizzes
router.get("/student-dashboard", authenticateToken, getQuizzesForStudentDashboard); // Get quizzes for student dashboard (detailed)
router.get("/student-dashboard/simple", authenticateToken, getStudentDashboardQuizzes); // Get simplified quizzes for student dashboard

// Quiz playing routes for students
router.post("/:quizId/start", authenticateToken, startQuiz); // Student starts a quiz
router.get("/:quizId/question/:questionIndex", authenticateToken, getQuizQuestion); // Get specific question
router.post("/:quizId/question/:questionIndex/answer", authenticateToken, submitAnswer); // Submit answer for a question
router.post("/:quizId/complete", authenticateToken, completeQuiz); // Complete quiz with all answers

router.get("/:id", authenticateToken, getQuizById); // Get quiz by ID
router.delete("/:id", authenticateToken, deleteQuiz); // Teacher delete quiz

export default router;
