import express from 'express';
import VideoController from '../controllers/videoController.js';
import authenticate from '../Middleware/userAuth.js';
import { videoUpload, handleUploadError } from '../Middleware/upload.js';

const router = express.Router();

router.post(
  '/upload',
  authenticate,
  videoUpload,
  handleUploadError,
  VideoController.uploadVideo
);

router.get('/videos', VideoController.getAllVideos);
router.get('/videos/:id', VideoController.getVideoById);
router.get('/my-videos', authenticate, VideoController.getMyVideos);
router.delete('/videos/:id', authenticate, VideoController.deleteVideo);



export default router;
