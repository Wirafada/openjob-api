const Joi = require('joi');

const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().required(),
}).required();

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
}).required();

module.exports = {
  loginSchema,
  refreshTokenSchema,
};