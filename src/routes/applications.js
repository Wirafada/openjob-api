const express = require('express');
const { randomUUID } = require('node:crypto');

const pool = require('../config/database');
const auth = require('../middlewares/auth');
const validate = require('../middlewares/validate');

const {
  applicationSchema,
  updateApplicationSchema,
} = require('../validators/applications');

const router = express.Router();

router.use(auth);

const selectApplications = `
  SELECT applications.*,
         jobs.title AS job_title,
         companies.name AS company_name,
         users.name AS user_name
  FROM applications
  JOIN jobs ON jobs.id = applications.job_id
  JOIN companies ON companies.id = jobs.company_id
  JOIN users ON users.id = applications.user_id
`;

// Membuat lamaran.
router.post(
  '/',
  validate(applicationSchema),
  async (req, res, next) => {
    try {
      const {
        user_id,
        job_id,
        resume_url,
        cover_letter,
      } = req.body;

      // Identitas pelamar harus sesuai dengan akun yang login.
      if (user_id !== undefined && user_id !== req.auth.id) {
        return res.status(403).json({
          status: 'failed',
          message: 'Tidak dapat membuat lamaran untuk pengguna lain',
        });
      }

      const job = await pool.query(
        'SELECT id, status FROM jobs WHERE id = $1',
        [job_id]
      );

      if (job.rowCount === 0) {
        return res.status(404).json({
          status: 'failed',
          message: 'Pekerjaan tidak ditemukan',
        });
      }

      if (job.rows[0].status !== 'open') {
        return res.status(400).json({
          status: 'failed',
          message: 'Pekerjaan sudah tidak menerima lamaran',
        });
      }

      const id = randomUUID();

      const result = await pool.query(
        `INSERT INTO applications (
           id,
           user_id,
           job_id,
           resume_url,
           cover_letter,
           status
         )
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, job_id) DO NOTHING
         RETURNING id`,
        [
          id,
          req.auth.id,
          job_id,
          resume_url ?? null,
          cover_letter ?? null,
          'pending',
        ]
      );

      if (result.rowCount === 0) {
        return res.status(400).json({
          status: 'failed',
          message: 'Anda sudah melamar pekerjaan ini',
        });
      }

      return res.status(201).json({
        status: 'success',
        data: { id: result.rows[0].id },
      });
    } catch (error) {
      return next(error);
    }
  }
);

// Daftar lamaran.
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `${selectApplications}
       ORDER BY applications.created_at DESC, applications.id`
    );

    return res.json({
      status: 'success',
      data: {
        applications: result.rows,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Daftar lamaran berdasarkan pengguna.
router.get('/user/:userId', async (req, res, next) => {
  try {
    const result = await pool.query(
      `${selectApplications}
       WHERE applications.user_id = $1
       ORDER BY applications.created_at DESC, applications.id`,
      [req.params.userId]
    );

    return res.json({
      status: 'success',
      data: {
        applications: result.rows,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Daftar lamaran berdasarkan pekerjaan.
router.get('/job/:jobId', async (req, res, next) => {
  try {
    const result = await pool.query(
      `${selectApplications}
       WHERE applications.job_id = $1
       ORDER BY applications.created_at DESC, applications.id`,
      [req.params.jobId]
    );

    return res.json({
      status: 'success',
      data: {
        applications: result.rows,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Detail lamaran.
router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `${selectApplications}
       WHERE applications.id = $1`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: 'failed',
        message: 'Lamaran tidak ditemukan',
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

// Memperbarui status lamaran.
router.put(
  '/:id',
  validate(updateApplicationSchema),
  async (req, res, next) => {
    try {
      const result = await pool.query(
        `UPDATE applications
         SET status = $1
         WHERE id = $2
         RETURNING id`,
        [req.body.status, req.params.id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          status: 'failed',
          message: 'Lamaran tidak ditemukan',
        });
      }

      return res.json({
        status: 'success',
        message: 'Status lamaran berhasil diperbarui',
      });
    } catch (error) {
      return next(error);
    }
  }
);

// Menghapus lamaran.
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `DELETE FROM applications
       WHERE id = $1
       RETURNING id`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: 'failed',
        message: 'Lamaran tidak ditemukan',
      });
    }

    return res.json({
      status: 'success',
      message: 'Lamaran berhasil dihapus',
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;