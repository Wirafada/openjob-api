const Joi = require('joi');

const companySchema = Joi.object({
  name: Joi.string().trim().required(),
  location: Joi.string().trim().required(),
  description: Joi.string().trim().allow('').optional(),
}).required();

module.exports = { companySchema };