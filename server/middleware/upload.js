import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '..', 'uploads', 'kyc');

try {
  fs.mkdirSync(uploadDir, { recursive: true });
} catch (e) {}

const storage = multer.memoryStorage();

const allowed = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
  'image/webp'
]);

export const kycUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const mt = (file.mimetype || '').toLowerCase();
    if (!allowed.has(mt)) {
      return cb(new Error('Only PDF, JPG, PNG and WEBP KYC documents are allowed'));
    }
    cb(null, true);
  }
});

/**
 * Process uploaded multer buffer file into persistent DB data + disk fallback
 */
export function processUploadedFile(file, type = 'other') {
  if (!file || !file.buffer) return null;
  const ext = path.extname(file.originalname).toLowerCase() || (file.mimetype === 'application/pdf' ? '.pdf' : '.jpg');
  const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
  const filePath = path.join(uploadDir, filename);

  // Write to disk for fallback static serving
  try {
    fs.writeFileSync(filePath, file.buffer);
  } catch (e) {
    console.error('Disk write notice (using memory/DB storage):', e.message);
  }

  // Base64 Data URL for persistent DB storage (never lost on container restarts)
  const base64Str = file.buffer.toString('base64');
  const dataUrl = `data:${file.mimetype};base64,${base64Str}`;

  return {
    type: type || 'other',
    originalName: file.originalname,
    filename,
    mimetype: file.mimetype,
    url: `/uploads/kyc/${filename}`,
    dataUrl,
    uploadedAt: new Date()
  };
}
