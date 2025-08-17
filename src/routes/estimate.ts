import { Router } from 'express';
import multer from 'multer';
import { estimateFromText, estimateFromImage } from '@/controllers/estimateController';
import { validateTextEstimation, validateImageUpload, asyncHandler, optionalAuth } from '@/middleware';
import { config } from '@/config/env';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.upload.maxFileSizeMB * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`));
    }
  },
});

router.post('/estimate', optionalAuth, validateTextEstimation, asyncHandler(estimateFromText));

router.post('/estimate/image', optionalAuth, upload.single('image'), validateImageUpload, asyncHandler(estimateFromImage));

export default router;
