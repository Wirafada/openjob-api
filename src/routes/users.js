const express = require('express');
const bcrypt = require('bcrypt');
const { randomUUID } = require('node:crypto');

const pool = require('../config/database');
const validate = require('../middlewares/validate');
const { registerUserSchema } = require('../validators/users');

const router = express.Router();

router.post('/', validate(registerUserSchema), async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    const id = randomUUID();
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users (id, name, email, password, role)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, name, email, hashedPassword, role]
    );

    return res.status(201).json({
      status: 'success',
      data: { id },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, created_at
       FROM users
       WHERE id = $1`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: 'failed',
        message: 'Pengguna tidak ditemukan',
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

module.exports = router;