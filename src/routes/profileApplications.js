const express = require('express');

const pool = require('../config/database');
const auth = require('../middlewares/auth');

const router = express.Router();

router.get('/applications', auth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT applications.*,
              jobs.title AS job_title,
              jobs.location_type,
              jobs.location_city,
              companies.name AS company_name
       FROM applications
       JOIN jobs ON jobs.id = applications.job_id
       JOIN companies ON companies.id = jobs.company_id
       WHERE applications.user_id = $1
       ORDER BY applications.created_at DESC, applications.id`,
      [req.auth.id]
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

module.exports = router;