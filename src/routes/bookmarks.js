const express = require('express');
const { randomUUID } = require('node:crypto');

const pool = require('../config/database');
const auth = require('../middlewares/auth');

const router = express.Router();

router.use(auth);

// Membuat bookmark.
router.post('/jobs/:jobId/bookmark', async (req, res, next) => {
  try {
    const job = await pool.query(
      'SELECT id FROM jobs WHERE id = $1',
      [req.params.jobId]
    );

    if (job.rowCount === 0) {
      return res.status(404).json({
        status: 'failed',
        message: 'Pekerjaan tidak ditemukan',
      });
    }

    const id = randomUUID();

    const result = await pool.query(
      `INSERT INTO bookmarks (id, user_id, job_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, job_id) DO NOTHING
       RETURNING id`,
      [id, req.auth.id, req.params.jobId]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({
        status: 'failed',
        message: 'Pekerjaan sudah disimpan',
      });
    }

    return res.status(201).json({
      status: 'success',
      data: { id },
    });
  } catch (error) {
    return next(error);
  }
});

// Detail bookmark milik pengguna yang login.
router.get('/jobs/:jobId/bookmark/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT bookmarks.*, jobs.title,
              companies.name AS company_name
       FROM bookmarks
       JOIN jobs ON jobs.id = bookmarks.job_id
       JOIN companies ON companies.id = jobs.company_id
       WHERE bookmarks.id = $1
         AND bookmarks.job_id = $2
         AND bookmarks.user_id = $3`,
      [req.params.id, req.params.jobId, req.auth.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: 'failed',
        message: 'Bookmark tidak ditemukan',
      });
    }

    return res.json({
      status: 'success',
      data: result.rows[0],
    });
  } catch (error) {
    return next(error);
  }
});

// Menghapus bookmark milik pengguna yang login.
router.delete('/jobs/:jobId/bookmark', async (req, res, next) => {
  try {
    const result = await pool.query(
      `DELETE FROM bookmarks
       WHERE job_id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.jobId, req.auth.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: 'failed',
        message: 'Bookmark tidak ditemukan',
      });
    }

    return res.json({
      status: 'success',
      message: 'Bookmark berhasil dihapus',
    });
  } catch (error) {
    return next(error);
  }
});

// Digunakan oleh /bookmarks dan /profile/bookmarks.
const listBookmarks = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT bookmarks.*, jobs.title, jobs.description,
              jobs.location_type, jobs.location_city,
              companies.name AS company_name,
              categories.name AS category_name
       FROM bookmarks
       JOIN jobs ON jobs.id = bookmarks.job_id
       JOIN companies ON companies.id = jobs.company_id
       JOIN categories ON categories.id = jobs.category_id
       WHERE bookmarks.user_id = $1
       ORDER BY bookmarks.created_at DESC, bookmarks.id`,
      [req.auth.id]
    );

    return res.json({
      status: 'success',
      data: {
        bookmarks: result.rows,
      },
    });
  } catch (error) {
    return next(error);
  }
};

router.get('/bookmarks', listBookmarks);
router.get('/profile/bookmarks', listBookmarks);

module.exports = router;