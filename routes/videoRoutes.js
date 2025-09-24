import express from 'express';
import VideoController from '../controllers/videoController.js';
import authenticateToken from '../Middleware/userAuth.js';
import { videoUpload, handleUploadError } from '../Middleware/upload.js';

const router = express.Router();

router.post(
  '/upload',
  authenticateToken,
  videoUpload,
  handleUploadError,
  VideoController.uploadVideo
);

router.get('/videos', VideoController.getAllVideos);
router.get('/videos/:id', VideoController.getVideoById);
router.get('/videos/:id/stream', VideoController.streamVideo);
router.get('/my-videos', authenticateToken, VideoController.getMyVideos);
router.delete('/videos/:id', authenticateToken, VideoController.deleteVideo);
router.put('/videos/:id/like', authenticateToken, VideoController.likeVideo);
router.get('/videos/:id/likes', VideoController.getLikes);


export default router;
