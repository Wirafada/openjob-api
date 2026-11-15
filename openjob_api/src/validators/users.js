const Joi = require('joi');

const registerUserSchema = Joi.object({
  name: Joi.string().trim().required(),
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid('user').default('user'),
}).required();

module.exports = { registerUserSchema };