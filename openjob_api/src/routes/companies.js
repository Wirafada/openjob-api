const express = require('express');
const { randomUUID } = require('node:crypto');

const pool = require('../config/database');
const auth = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { companySchema } = require('../validators/companies');
const {
  getCache,
  setCache,
  deleteCache,
} = require('../utils/cache');

const router = express.Router();

const companyCacheKey = (id) => `openjob:v2responses:companies:${id}`;

// Menambahkan perusahaan — membutuhkan access token
router.post('/', auth, validate(companySchema), async (req, res, next) => {
  try {
    const { name, location, description } = req.body;
    const id = randomUUID();

    await pool.query(
      `INSERT INTO companies (id, name, location, description)
       VALUES ($1, $2, $3, $4)`,
      [id, name, location, description ?? null]
    );

    return res.status(201).json({
      status: 'success',
      data: { id },
    });
  } catch (error) {
    return next(error);
  }
});

// Daftar perusahaan — publik
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, location, description, created_at, updated_at
       FROM companies
       ORDER BY created_at, id`
    );

    return res.status(200).json({
      status: 'success',
      data: { companies: result.rows },
    });
  } catch (error) {
    return next(error);
  }
});

// Detail perusahaan — publik, cache selama 1 jam
router.get('/:id', async (req, res, next) => {
  try {
    const key = companyCacheKey(req.params.id);
    const cached = await getCache(key);

    if (cached !== null) {
      res.set('X-Data-Source', 'cache');

      return res.status(200).json({
        status: 'success',
        data: cached,
      });
    }

    const result = await pool.query(
      `SELECT id, name, location, description, created_at, updated_at
       FROM companies
       WHERE id = $1`,
      [req.params.id]
    );

    res.set('X-Data-Source', 'database');

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: 'failed',
        message: 'Perusahaan tidak ditemukan',
      });
    }

    const company = result.rows[0];
    await setCache(key, company);

    return res.status(200).json({
      status: 'success',
      data: company,
    });
  } catch (error) {
    return next(error);
  }
});

// Memperbarui perusahaan — membutuhkan access token
router.put('/:id', auth, validate(companySchema), async (req, res, next) => {
  try {
    const { name, location, description } = req.body;

    const result = await pool.query(
      `UPDATE companies
       SET name = $1, location = $2, description = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id`,
      [name, location, description ?? null, req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: 'failed',
        message: 'Perusahaan tidak ditemukan',
      });
    }

    await deleteCache(companyCacheKey(req.params.id));

    return res.status(200).json({
      status: 'success',
      message: 'Perusahaan berhasil diperbarui',
    });
  } catch (error) {
    return next(error);
  }
});

// Menghapus perusahaan — membutuhkan access token
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM companies WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: 'failed',
        message: 'Perusahaan tidak ditemukan',
      });
    }

    await deleteCache(companyCacheKey(req.params.id));

    return res.status(200).json({
      status: 'success',
      message: 'Perusahaan berhasil dihapus',
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;