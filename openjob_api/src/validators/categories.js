const Joi = require('joi');

const categorySchema = Joi.object({
  name: Joi.string().trim().required(),
}).required();

module.exports = { categorySchema };