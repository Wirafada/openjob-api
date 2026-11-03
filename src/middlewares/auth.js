const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  const authorization = req.get('Authorization');
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);

  if (!match) {
    return res.status(401).json({
      status: 'failed',
      message: 'Access token diperlukan',
    });
  }

  try {
    const payload = jwt.verify(
      match[1],
      process.env.ACCESS_TOKEN_KEY,
      { algorithms: ['HS256'] }
    );

    if (!payload || typeof payload.id !== 'string') {
      return res.status(401).json({
        status: 'failed',
        message: 'Access token tidak valid',
      });
    }

    req.auth = { id: payload.id };
  } catch (error) {
    return res.status(401).json({
      status: 'failed',
      message: 'Access token tidak valid atau sudah kedaluwarsa',
    });
  }

  return next();
};

module.exports = auth;