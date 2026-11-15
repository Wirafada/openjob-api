const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
  });

  if (error) {
    const validationError = new Error(
      error.details.map((detail) => detail.message).join(', ')
    );

    validationError.statusCode = 400;
    return next(validationError);
  }

  req.body = value;
  return next();
};

module.exports = validate;