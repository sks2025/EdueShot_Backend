import express from 'express';
import VideoController from '../controllers/videoController.js';
import { authenticateToken, teacherOnly } from '../Middleware/userAuth.js';
import { videoUpload, handleUploadError } from '../Middleware/upload.js';

const router = express.Router();

router.post(
  '/upload',
  authenticateToken,
  teacherOnly, // Only teachers can upload videos
  videoUpload,
  handleUploadError,
  VideoController.uploadVideo
);

router.get('/videos', VideoController.getAllVideos);
router.get('/stream', VideoController.streamAllVideos); // Stream all videos without ID (perfect for feed)
router.get('/videos/type/:type', VideoController.getVideosByType); // Get videos by content type (reel/full)
router.get('/videos/:id', authenticateToken, VideoController.getVideoById);
router.get('/videos/:id/stream', VideoController.streamVideo);
router.get('/my-videos', authenticateToken, VideoController.getMyVideos);
router.delete('/videos/:id', authenticateToken, teacherOnly, VideoController.deleteVideo); // Only teachers can delete videos
router.put('/videos/:id/like', authenticateToken, VideoController.likeVideo);
router.get('/videos/:id/likes', VideoController.getLikes);


export default router;
