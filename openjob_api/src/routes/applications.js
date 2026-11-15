const express = require('express');
const { randomUUID } = require('node:crypto');

const pool = require('../config/database');
const auth = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { getCache, setCache, deleteCache } = require('../utils/cache');

const {
  applicationSchema,
  updateApplicationSchema,
} = require('../validators/applications');

const router = express.Router();

// Autentikasi diperiksa sebelum membaca cache.
router.use(auth);

const detailKey = (id) => `openjob:v2responses:applications:detail:${id}`;
const userKey = (id) => `openjob:v2responses:applications:user:${id}`;
const jobKey = (id) => `openjob:v2responses:applications:job:${id}`;

async function invalidateApplication(application) {
  await deleteCache(
    detailKey(application.id),
    userKey(application.user_id),
    jobKey(application.job_id)
  );
}

const selectApplications = `
  SELECT applications.*,
         jobs.title AS job_title,
         companies.name AS company_name,
         users.name AS user_name,
         users.email AS user_email,
         jobs.status AS job_status,
         companies.location AS company_location
  FROM applications
  JOIN jobs ON jobs.id = applications.job_id
  JOIN companies ON companies.id = jobs.company_id
  JOIN users ON users.id = applications.user_id
`;

// Membuat lamaran dan mencatat notifikasi dalam satu transaksi.
router.post('/', validate(applicationSchema), async (req, res, next) => {
  let client;
  let transactionStarted = false;
  let application;

  try {
    const { user_id, job_id, resume_url, cover_letter } = req.body;

    if (user_id !== undefined && user_id !== req.auth.id) {
      return res.status(403).json({
        status: 'failed',
        message: 'Tidak dapat membuat lamaran untuk pengguna lain',
      });
    }

    client = await pool.connect();

    await client.query('BEGIN');
    transactionStarted = true;

    // Mencegah pekerjaan dihapus atau ditutup selama transaksi.
    const job = await client.query(
      `SELECT id, status
       FROM jobs
       WHERE id = $1
       FOR SHARE`,
      [job_id]
    );

    if (job.rowCount === 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;

      return res.status(404).json({
        status: 'failed',
        message: 'Pekerjaan tidak ditemukan',
      });
    }

    if (job.rows[0].status !== 'open') {
      await client.query('ROLLBACK');
      transactionStarted = false;

      return res.status(400).json({
        status: 'failed',
        message: 'Pekerjaan sudah tidak menerima lamaran',
      });
    }

    const result = await client.query(
      `INSERT INTO applications (
         id, user_id, job_id, resume_url, cover_letter, status
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, job_id) DO NOTHING
       RETURNING id, user_id, job_id, status`,
      [
        randomUUID(),
        req.auth.id,
        job_id,
        resume_url ?? null,
        cover_letter ?? null,
        'pending',
      ]
    );

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;

      return res.status(400).json({
        status: 'failed',
        message: 'Anda sudah melamar pekerjaan ini',
      });
    }

    application = result.rows[0];

    await client.query(
      `INSERT INTO notification_outbox (
         id, application_id, payload
       )
       VALUES ($1, $2, $3::jsonb)`,
      [
        randomUUID(),
        application.id,
        JSON.stringify({
          application_id: application.id,
        }),
      ]
    );

    await client.query('COMMIT');
    transactionStarted = false;
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Rollback lamaran gagal:', rollbackError.message);
      }
    }

    return next(error);
  } finally {
    if (client) {
      client.release();
    }
  }

  // Lamaran dan outbox sudah tersimpan.
  try {
    await invalidateApplication(application);
  } catch (error) {
    console.error(
      'Lamaran tersimpan, tetapi penghapusan cache gagal:',
      error.message
    );
  }

  return res.status(201).json({
    status: 'success',
    data: {
      id: application.id,
      user_id: application.user_id,
      job_id: application.job_id,
      status: application.status,
    },
  });
});

// Daftar seluruh lamaran, tanpa cache.
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
    const key = userKey(req.params.userId);
    const cached = await getCache(key);

    if (cached !== null) {
      res.set('X-Data-Source', 'cache');

      return res.json({
        status: 'success',
        data: {
          applications: cached,
        },
      });
    }

    const result = await pool.query(
      `${selectApplications}
       WHERE applications.user_id = $1
       ORDER BY applications.created_at DESC, applications.id`,
      [req.params.userId]
    );

    await setCache(key, result.rows);
    res.set('X-Data-Source', 'database');

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
    const key = jobKey(req.params.jobId);
    const cached = await getCache(key);

    if (cached !== null) {
      res.set('X-Data-Source', 'cache');

      return res.json({
        status: 'success',
        data: {
          applications: cached,
        },
      });
    }

    const result = await pool.query(
      `${selectApplications}
       WHERE applications.job_id = $1
       ORDER BY applications.created_at DESC, applications.id`,
      [req.params.jobId]
    );

    await setCache(key, result.rows);
    res.set('X-Data-Source', 'database');

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
    const key = detailKey(req.params.id);
    const cached = await getCache(key);

    if (cached !== null) {
      res.set('X-Data-Source', 'cache');

      return res.json({
        status: 'success',
        data: cached,
      });
    }

    const result = await pool.query(
      `${selectApplications}
       WHERE applications.id = $1`,
      [req.params.id]
    );

    res.set('X-Data-Source', 'database');

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: 'failed',
        message: 'Lamaran tidak ditemukan',
      });
    }

    const application = result.rows[0];

    await setCache(key, application);

    return res.json({
      status: 'success',
      data: application,
    });
  } catch (error) {
    return next(error);
  }
});

// Memperbarui status dan menghapus cache terkait.
router.put(
  '/:id',
  validate(updateApplicationSchema),
  async (req, res, next) => {
    try {
      const result = await pool.query(
        `UPDATE applications
         SET status = $1
         WHERE id = $2
         RETURNING id, user_id, job_id`,
        [req.body.status, req.params.id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          status: 'failed',
          message: 'Lamaran tidak ditemukan',
        });
      }

      await invalidateApplication(result.rows[0]);

      return res.json({
        status: 'success',
        message: 'Status lamaran berhasil diperbarui',
      });
    } catch (error) {
      return next(error);
    }
  }
);

// Menghapus lamaran dan cache terkait.
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `DELETE FROM applications
       WHERE id = $1
       RETURNING id, user_id, job_id`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: 'failed',
        message: 'Lamaran tidak ditemukan',
      });
    }

    await invalidateApplication(result.rows[0]);

    return res.json({
      status: 'success',
      message: 'Lamaran berhasil dihapus',
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;