import express from "express";
import {
  createCourse,
  getCourses,
  enrollCourse,
  updateCourse,
  deleteCourse,
} from "../controllers/courseController.js";
import authenticateToken from "../Middleware/userAuth.js";

const router = express.Router();

// teacher creates
router.post("/create", authenticateToken, createCourse);

// anyone can view
router.get("/", getCourses);

// student enrolls
router.post("/:courseId/enroll", authenticateToken, enrollCourse);

// teacher updates/deletes own course
router.put("/:courseId", authenticateToken, updateCourse);
router.delete("/:courseId", authenticateToken, deleteCourse);

export default router;
