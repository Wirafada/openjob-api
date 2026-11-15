const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');

const pool = require('../config/database');
const validate = require('../middlewares/validate');
const auth = require('../middlewares/auth');

const {
  loginSchema,
  refreshTokenSchema,
} = require('../validators/authentications');

const router = express.Router();

const verifyRefreshToken = (token) => {
  const payload = jwt.verify(
    token,
    process.env.REFRESH_TOKEN_KEY,
    { algorithms: ['HS256'] }
  );

  if (!payload || typeof payload.id !== 'string') {
    throw new Error('Refresh token tidak valid');
  }

  return payload;
};

// Login.
router.post('/', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      'SELECT id, password FROM users WHERE email = $1',
      [email]
    );

    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        status: 'failed',
        message: 'Email atau password salah',
      });
    }

    const accessToken = jwt.sign(
      { id: user.id },
      process.env.ACCESS_TOKEN_KEY,
      {
        algorithm: 'HS256',
        expiresIn: '3h',
      }
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.REFRESH_TOKEN_KEY,
      {
        algorithm: 'HS256',
        expiresIn: '7d',
        jwtid: randomUUID(),
      }
    );

    await pool.query(
      `INSERT INTO authentications (token, user_id)
       VALUES ($1, $2)`,
      [refreshToken, user.id]
    );

    return res.status(200).json({
      status: 'success',
      data: {
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Memperbarui access token.
router.put(
  '/',
  validate(refreshTokenSchema),
  async (req, res, next) => {
    try {
      const { refreshToken } = req.body;

      let payload;

      try {
        payload = verifyRefreshToken(refreshToken);
      } catch (error) {
        return res.status(400).json({
          status: 'failed',
          message: 'Refresh token tidak valid',
        });
      }

      const result = await pool.query(
        `SELECT user_id
         FROM authentications
         WHERE token = $1 AND user_id = $2`,
        [refreshToken, payload.id]
      );

      if (result.rowCount === 0) {
        return res.status(400).json({
          status: 'failed',
          message: 'Refresh token tidak terdaftar',
        });
      }

      const accessToken = jwt.sign(
        { id: result.rows[0].user_id },
        process.env.ACCESS_TOKEN_KEY,
        {
          algorithm: 'HS256',
          expiresIn: '3h',
        }
      );

      return res.status(200).json({
        status: 'success',
        data: { accessToken },
      });
    } catch (error) {
      return next(error);
    }
  }
);

// Logout: mencabut refresh token yang diberikan.
router.delete(
  '/',
  auth,
  validate(refreshTokenSchema),
  async (req, res, next) => {
    try {
      const { refreshToken } = req.body;

      let payload;

      try {
        payload = verifyRefreshToken(refreshToken);
      } catch (error) {
        return res.status(400).json({
          status: 'failed',
          message: 'Refresh token tidak valid',
        });
      }

      const result = await pool.query(
        `DELETE FROM authentications
         WHERE token = $1 AND user_id = $2
         RETURNING token`,
        [refreshToken, payload.id]
      );

      if (result.rowCount === 0) {
        return res.status(400).json({
          status: 'failed',
          message: 'Refresh token tidak terdaftar',
        });
      }

      return res.status(200).json({
        status: 'success',
        message: 'Logout berhasil',
      });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;