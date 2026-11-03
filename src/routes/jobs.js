const express = require('express');
const { randomUUID } = require('node:crypto');

const pool = require('../config/database');
const auth = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { jobSchema } = require('../validators/jobs');

const router = express.Router();

// Membuat pekerjaan — wajib login.
router.post('/', auth, validate(jobSchema), async (req, res, next) => {
  try {
    const {
      company_id,
      category_id,
      title,
      description,
      job_type,
      experience_level,
      location_type,
      location_city,
      salary_min,
      salary_max,
      is_salary_visible,
      status,
    } = req.body;

    const company = await pool.query(
      'SELECT id FROM companies WHERE id = $1',
      [company_id]
    );

    if (company.rowCount === 0) {
      return res.status(404).json({
        status: 'failed',
        message: 'Perusahaan tidak ditemukan',
      });
    }

    const category = await pool.query(
      'SELECT id FROM categories WHERE id = $1',
      [category_id]
    );

    if (category.rowCount === 0) {
      return res.status(404).json({
        status: 'failed',
        message: 'Kategori tidak ditemukan',
      });
    }

    const id = randomUUID();

    await pool.query(
      `INSERT INTO jobs (
        id, company_id, category_id, title, description,
        job_type, experience_level, location_type, location_city,
        salary_min, salary_max, is_salary_visible, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13
      )`,
      [
        id,
        company_id,
        category_id,
        title,
        description,
        job_type,
        experience_level,
        location_type,
        location_city ?? null,
        salary_min ?? null,
        salary_max ?? null,
        is_salary_visible,
        status,
      ]
    );

    return res.status(201).json({
      status: 'success',
      data: { id },
    });
  } catch (error) {
    return next(error);
  }
});

// Daftar dan pencarian pekerjaan — tanpa login.
router.get('/', async (req, res, next) => {
  try {
    const title = req.query.title;
    const companyName = req.query['company-name'];

    if (
      (title !== undefined && typeof title !== 'string') ||
      (companyName !== undefined && typeof companyName !== 'string')
    ) {
      return res.status(400).json({
        status: 'failed',
        message: 'Parameter pencarian harus berupa teks',
      });
    }

    const result = await pool.query(
      `SELECT jobs.*, companies.name AS company_name,
              categories.name AS category_name
       FROM jobs
       JOIN companies ON companies.id = jobs.company_id
       JOIN categories ON categories.id = jobs.category_id
       WHERE jobs.title ILIKE $1
         AND companies.name ILIKE $2
       ORDER BY jobs.created_at DESC, jobs.id`,
      [
        `%${title ?? ''}%`,
        `%${companyName ?? ''}%`,
      ]
    );

    return res.status(200).json({
      status: 'success',
      data: {
        jobs: result.rows,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Daftar pekerjaan berdasarkan perusahaan — tanpa login.
router.get('/company/:companyId', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT jobs.*, companies.name AS company_name,
              categories.name AS category_name
       FROM jobs
       JOIN companies ON companies.id = jobs.company_id
       JOIN categories ON categories.id = jobs.category_id
       WHERE jobs.company_id = $1
       ORDER BY jobs.created_at DESC, jobs.id`,
      [req.params.companyId]
    );

    return res.status(200).json({
      status: 'success',
      data: {
        jobs: result.rows,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Daftar pekerjaan berdasarkan kategori — tanpa login.
router.get('/category/:categoryId', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT jobs.*, companies.name AS company_name,
              categories.name AS category_name
       FROM jobs
       JOIN companies ON companies.id = jobs.company_id
       JOIN categories ON categories.id = jobs.category_id
       WHERE jobs.category_id = $1
       ORDER BY jobs.created_at DESC, jobs.id`,
      [req.params.categoryId]
    );

    return res.status(200).json({
      status: 'success',
      data: {
        jobs: result.rows,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Detail pekerjaan — tanpa login.
router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT jobs.*, companies.name AS company_name,
              categories.name AS category_name
       FROM jobs
       JOIN companies ON companies.id = jobs.company_id
       JOIN categories ON categories.id = jobs.category_id
       WHERE jobs.id = $1`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: 'failed',
        message: 'Pekerjaan tidak ditemukan',
      });
    }

    return res.status(200).json({
      status: 'success',
      data: result.rows[0],
    });
  } catch (error) {
    return next(error);
  }
});

// Memperbarui pekerjaan — wajib login.
router.put('/:id', auth, validate(jobSchema), async (req, res, next) => {
  try {
    const {
      company_id,
      category_id,
      title,
      description,
      job_type,
      experience_level,
      location_type,
      location_city,
      salary_min,
      salary_max,
      is_salary_visible,
      status,
    } = req.body;

    const job = await pool.query(
      'SELECT id FROM jobs WHERE id = $1',
      [req.params.id]
    );

    if (job.rowCount === 0) {
      return res.status(404).json({
        status: 'failed',
        message: 'Pekerjaan tidak ditemukan',
      });
    }

    const company = await pool.query(
      'SELECT id FROM companies WHERE id = $1',
      [company_id]
    );

    if (company.rowCount === 0) {
      return res.status(404).json({
        status: 'failed',
        message: 'Perusahaan tidak ditemukan',
      });
    }

    const category = await pool.query(
      'SELECT id FROM categories WHERE id = $1',
      [category_id]
    );

    if (category.rowCount === 0) {
      return res.status(404).json({
        status: 'failed',
        message: 'Kategori tidak ditemukan',
      });
    }

    const result = await pool.query(
      `UPDATE jobs SET
         company_id = $1,
         category_id = $2,
         title = $3,
         description = $4,
         job_type = $5,
         experience_level = $6,
         location_type = $7,
         location_city = $8,
         salary_min = $9,
         salary_max = $10,
         is_salary_visible = $11,
         status = $12
       WHERE id = $13
       RETURNING id`,
      [
        company_id,
        category_id,
        title,
        description,
        job_type,
        experience_level,
        location_type,
        location_city ?? null,
        salary_min ?? null,
        salary_max ?? null,
        is_salary_visible,
        status,
        req.params.id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: 'failed',
        message: 'Pekerjaan tidak ditemukan',
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Pekerjaan berhasil diperbarui',
    });
  } catch (error) {
    return next(error);
  }
});

// Menghapus pekerjaan — wajib login.
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM jobs WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: 'failed',
        message: 'Pekerjaan tidak ditemukan',
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Pekerjaan berhasil dihapus',
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;