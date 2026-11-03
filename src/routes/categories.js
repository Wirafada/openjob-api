const express = require('express');
const { randomUUID } = require('node:crypto');

const pool = require('../config/database');
const auth = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { categorySchema } = require('../validators/categories');

const router = express.Router();

// Menambahkan kategori
router.post('/', auth, validate(categorySchema), async (req, res, next) => {
  try {
    const id = randomUUID();
    const { name } = req.body;

    await pool.query(
      'INSERT INTO categories (id, name) VALUES ($1, $2)',
      [id, name]
    );

    return res.status(201).json({
      status: 'success',
      data: { id },
    });
  } catch (error) {
    return next(error);
  }
});

// Daftar kategori — publik
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, created_at
       FROM categories
       ORDER BY created_at, id`
    );

    return res.status(200).json({
      status: 'success',
      data: { categories: result.rows },
    });
  } catch (error) {
    return next(error);
  }
});

// Detail kategori — publik
router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, name, created_at FROM categories WHERE id = $1',
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: 'failed',
        message: 'Kategori tidak ditemukan',
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

// Memperbarui kategori
router.put('/:id', auth, validate(categorySchema), async (req, res, next) => {
  try {
    const result = await pool.query(
      'UPDATE categories SET name = $1 WHERE id = $2 RETURNING id',
      [req.body.name, req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: 'failed',
        message: 'Kategori tidak ditemukan',
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Kategori berhasil diperbarui',
    });
  } catch (error) {
    return next(error);
  }
});

// Menghapus kategori
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM categories WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: 'failed',
        message: 'Kategori tidak ditemukan',
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Kategori berhasil dihapus',
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;