// middleware/upload.js
import multer from 'multer';
import path from 'path';

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log('📁 Multer destination called for file:', file.originalname);
    cb(null, 'uploads/'); // folder to save
  },
  filename: (req, file, cb) => {
    const filename = Date.now() + '-' + file.originalname;
    console.log('📝 Generated filename:', filename);
    cb(null, filename);
  }
});

// File filter for videos & images
const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // max 50MB for video
  fileFilter: (req, file, cb) => {
    console.log('🔍 File filter checking:', file.originalname, 'Field:', file.fieldname);
    const allowed = /mp4|mov|avi|jpg|jpeg|png/;
    const ext = path.extname(file.originalname).toLowerCase();
    console.log('📄 File extension:', ext);
    if (allowed.test(ext)) {
      console.log('✅ File accepted');
      cb(null, true);
    } else {
      console.log('❌ File rejected - invalid extension');
      cb(new Error('Only video/image files allowed!'));
    }
  }
});

// If you need both video + thumbnail in single request
const videoUpload = upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]);

// Error handling middleware for multer
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 50MB.' });
    }
    return res.status(400).json({ error: err.message });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
};

export { videoUpload, handleUploadError };
