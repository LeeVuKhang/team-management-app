import multer from 'multer';
import multerS3 from 'multer-s3';
import { S3Client } from '@aws-sdk/client-s3';
import path from 'path';

/**
 * AWS S3 Upload Middleware
 * Handles file uploads directly to S3 using multer-s3
 */

// 1. Initialize S3 Client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Allowed file types for upload
const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  // Documents
  'application/pdf', 'text/plain', 'text/markdown',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Archives
  'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
  // Code
  'text/javascript', 'text/html', 'text/css', 'application/json', 'text/xml',
  // Video
  'video/mp4', 'video/webm', 'video/quicktime',
  // Audio
  'audio/mpeg', 'audio/wav', 'audio/ogg',
];

// 2. Configure Multer to upload directly to S3
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_BUCKET_NAME,
    // Note: ACL removed - S3 buckets created after April 2023 have ACLs disabled by default
    // To make files public, use Bucket Policy instead of ACL
    contentType: multerS3.AUTO_CONTENT_TYPE, // Auto-detect content type
    metadata: function (req, file, cb) {
      cb(null, { 
        fieldName: file.fieldname,
        originalName: file.originalname,
      });
    },
    key: function (req, file, cb) {
      // Generate unique filename: uploads/timestamp-random-originalname
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      // Sanitize filename to remove special characters
      const safeName = path.basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .substring(0, 50); // Limit name length
      cb(null, `uploads/${uniqueSuffix}-${safeName}${ext}`);
    },
  }),
  limits: { 
    fileSize: 100 * 1024 * 1024, // 100MB limit per file
    files: 5, // Maximum 5 files per request
  },
  fileFilter: (req, file, cb) => {
    // Validate file type
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type "${file.mimetype}" is not allowed. Allowed types: images, documents, archives, code files, video, and audio.`), false);
    }
  },
});

export default upload;