const express = require('express');
const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const pool = require('../config/database');
const auth = require('../middlewares/auth');

const router = express.Router();
const uploadDirectory = path.resolve(__dirname, '../../uploads/documents');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
}).single('document');

function receiveDocument(req, res, next) {
  upload(req, res, (error) => {
    if (!error) return next();
    if (!(error instanceof multer.MulterError)) return next(error);
    return res.status(400).json({
      status: 'failed',
      message: error.code === 'LIMIT_FILE_SIZE'
        ? 'PDF file must not exceed 5 MB'
        : 'File is required in the document field, with one file only',
    });
  });
}

function documentPath(filename) {
  if (!/^[0-9a-f-]{36}\.pdf$/.test(filename)) {
    const error = new Error('Document not found');
    error.statusCode = 404;
    throw error;
  }
  return path.join(uploadDirectory, filename);
}

router.post('/', auth, receiveDocument, async (req, res, next) => {
  const file = req.file;
  if (!file || file.mimetype !== 'application/pdf' || file.size === 0
      || file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    return res.status(400).json({
      status: 'failed',
      message: 'File is required and must be a non-empty PDF with a valid PDF signature',
    });
  }

  const id = randomUUID();
  const filename = `${randomUUID()}.pdf`;
  const originalName = path.win32.basename(file.originalname).replace(/[\r\n\x00-\x1f\x7f]/g, '');
  const storedPath = documentPath(filename);
  try {
    await fs.mkdir(uploadDirectory, { recursive: true });
    await fs.writeFile(storedPath, file.buffer, { flag: 'wx' });
    try {
      await pool.query(
        `INSERT INTO documents (id, user_id, filename, original_name, size)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, req.auth.id, filename, originalName, file.size]
      );
    } catch (error) {
      await fs.unlink(storedPath).catch((cleanupError) => {
        console.error('Failed to remove document after metadata failure', cleanupError);
      });
      throw error;
    }
    return res.status(201).json({
      status: 'success',
      data: { documentId: id, filename, originalName, size: file.size },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, filename, original_name AS "originalName", size, created_at
       FROM documents ORDER BY created_at DESC, id`
    );
    return res.json({ status: 'success', data: { documents: result.rows } });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT filename FROM documents WHERE id = $1', [req.params.id]);
    if (!result.rowCount) {
      return res.status(404).json({ status: 'failed', message: 'Document not found' });
    }
    const storedPath = documentPath(result.rows[0].filename);
    await fs.access(storedPath);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="${result.rows[0].filename}"`);
    return res.sendFile(storedPath, (error) => {
      if (error) next(error);
    });
  } catch (error) {
    if (error.code === 'ENOENT') error.statusCode = 404;
    return next(error);
  }
});

router.delete('/:id', auth, async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM documents WHERE id = $1 AND user_id = $2 RETURNING filename',
      [req.params.id, req.auth.id]
    );
    if (!result.rowCount) {
      return res.status(404).json({ status: 'failed', message: 'Document not found for this user' });
    }
    await fs.unlink(documentPath(result.rows[0].filename)).catch((error) => {
      if (error.code !== 'ENOENT') console.error('Failed to remove deleted document file', error);
    });
    return res.json({ status: 'success', message: 'Document deleted' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
