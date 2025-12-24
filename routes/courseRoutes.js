import express from "express";
import {
  createCourse,
  getCourses,
  getCourseById,
  enrollCourse,
  updateCourse,
  deleteCourse,
} from "../controllers/courseController.js";
import authenticateToken from "../Middleware/userAuth.js";
import { imageUpload } from "../Middleware/upload.js";

const router = express.Router();

// teacher creates (with file upload)
router.post("/create", authenticateToken, imageUpload, createCourse);

// anyone can view
router.get("/", getCourses);
router.get("/:courseId", getCourseById);

// student enrolls
router.post("/:courseId/enroll", authenticateToken, enrollCourse);

// teacher updates/deletes own course
router.put("/:courseId", authenticateToken, updateCourse);
router.delete("/:courseId", authenticateToken, deleteCourse);

export default router;
