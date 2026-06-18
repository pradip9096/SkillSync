/**
 * @file uploadMiddleware.js
 * @description Configures and exports a Multer middleware instance for handling profile
 * picture and gallery image uploads. Accepts jpeg, jpg, png, and webp files up to 5 MB,
 * stores them in `frontend/public/uploads/` with a unique timestamped filename.
 *
 * Inputs and outputs:
 *   - Exports: the configured `multer` upload middleware (call as `upload.single('fieldName')`).
 *
 * Side effects:
 *   - Creates the `frontend/public/uploads/` directory if it does not already exist
 *     (synchronous `fs.mkdirSync` at module-load time).
 *   - Writes uploaded files to disk in the uploads directory.
 *
 * Dependencies:
 *   - `multer` — Multipart form-data middleware for Express.
 *   - `path` — File extension extraction.
 *   - `fs` — Directory existence check and creation.
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../../frontend/public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Set storage engine
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate a unique filename using Date and original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

/**
 * Validates that an uploaded file is an allowed image type by checking both the
 * file extension and the MIME type. Both must pass to prevent extension-spoofing attacks.
 *
 * @param {Express.Multer.File} file - The Multer file object from the incoming request.
 * @param {function(Error|null, boolean): void} cb - Multer callback: `cb(null, true)` to accept;
 *   `cb(new Error(...))` to reject.
 * @returns {void}
 */
function checkFileType(file, cb) {
  const filetypes = /jpeg|jpg|png|webp/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Images Only! (jpeg, jpg, png, webp)'));
  }
}

// Initialize upload variable
const upload = multer({
  storage: storage,
  limits: { fileSize: 5000000 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  }
});

module.exports = upload;
