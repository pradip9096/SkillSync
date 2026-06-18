/**
 * @file uploadMiddleware.test.js
 * @description Unit tests for the Multer file upload middleware in `uploadMiddleware.js`.
 * Verifies file type validation (jpeg, jpg, png, webp only), 5 MB size limit enforcement,
 * and unique filename generation. Uses Supertest to make multipart upload requests
 * against an in-process Express test server.
 * @side_effects Creates and deletes temporary image files in the uploads directory during tests.
 */

const request = require('supertest');
const express = require('express');
const upload = require('../../../middleware/uploadMiddleware');
const fs = require('fs');
const path = require('path');

// Setup mock express app
const app = express();

app.post('/upload', (req, res) => {
  upload.single('avatar')(req, res, function (err) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    res.status(200).json({ filename: req.file.filename });
  });
});

describe('Feature 1.11: Media & File Uploads Unit Tests', () => {
  const dummyFilePath = path.join(__dirname, 'dummy.png');
  const largeFilePath = path.join(__dirname, 'large.png');
  const invalidFilePath = path.join(__dirname, 'invalid.pdf');
  const uploadDir = path.join(__dirname, '../../../../../frontend/public/uploads');

  beforeAll(() => {
    // Create dummy files for testing
    fs.writeFileSync(dummyFilePath, Buffer.alloc(1024)); // 1KB valid image
    fs.writeFileSync(largeFilePath, Buffer.alloc(5000001)); // 5MB + 1 byte
    fs.writeFileSync(invalidFilePath, Buffer.alloc(1024)); // 1KB invalid file
  });

  afterAll(() => {
    // Cleanup dummy files
    if (fs.existsSync(dummyFilePath)) fs.unlinkSync(dummyFilePath);
    if (fs.existsSync(largeFilePath)) fs.unlinkSync(largeFilePath);
    if (fs.existsSync(invalidFilePath)) fs.unlinkSync(invalidFilePath);

    // Clean up uploaded files in uploadDir (created during tests)
    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir);
      for (const file of files) {
        if (file.startsWith('avatar-')) {
          fs.unlinkSync(path.join(uploadDir, file));
        }
      }
    }
  });

  it('TC-UPL-01: BVA (Boundary) - Should reject file larger than 5MB', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('avatar', largeFilePath);
    
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/File too large/i);
  });

  it('TC-UPL-02: EP (Invalid Type) - Should reject non-image files like .pdf', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('avatar', invalidFilePath);
    
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/Images Only/i);
  });

  it('TC-UPL-03: Golden Path - Should upload valid image under 5MB', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('avatar', dummyFilePath);
    
    expect(res.statusCode).toBe(200);
    expect(res.body.filename).toMatch(/^avatar-\d+-\d+\.png$/);
  });
});
