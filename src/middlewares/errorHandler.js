const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error.code === '23505') {
    return res.status(400).json({
      status: 'failed',
      message: 'Data yang harus unik sudah digunakan',
    });
  }

  const statusCode = error.statusCode || error.status || 500;

  if (statusCode >= 500) {
    console.error(error);
  }

  return res.status(statusCode).json({
    status: 'failed',
    message: statusCode >= 500
      ? 'Terjadi kesalahan pada server'
      : error.message,
  });
};

module.exports = errorHandler;