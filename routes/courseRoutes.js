import express from "express";
import {
  createCourse,
  getCourses,
  getCourseById,
  enrollCourse,
  updateCourse,
  deleteCourse,
  likeCourse,
  getCourseLikes,
} from "../controllers/courseController.js";
import authenticateToken from "../Middleware/userAuth.js";

const router = express.Router();

// teacher creates
router.post("/create", authenticateToken, createCourse);

// anyone can view
router.get("/", getCourses);
router.get("/:courseId", getCourseById);

// student enrolls
router.post("/:courseId/enroll", authenticateToken, enrollCourse);

// teacher updates/deletes own course
router.put("/:courseId", authenticateToken, updateCourse);
router.delete("/:courseId", authenticateToken, deleteCourse);

// like/unlike course (authenticated users)
router.put("/:courseId/like", authenticateToken, likeCourse);
router.get("/:courseId/likes", getCourseLikes);

export default router;
