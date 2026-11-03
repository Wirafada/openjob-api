const Joi = require('joi');

const applicationSchema = Joi.object({
  user_id: Joi.string().max(50).optional(),
  job_id: Joi.string().max(50).required(),

  status: Joi.string()
    .valid('pending')
    .default('pending'),

  resume_url: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .optional(),

  cover_letter: Joi.string()
    .trim()
    .allow('')
    .optional(),
}).required();

const updateApplicationSchema = Joi.object({
  status: Joi.string()
    .valid(
      'pending',
      'reviewed',
      'interview',
      'accepted',
      'rejected'
    )
    .required(),
}).required();

module.exports = {
  applicationSchema,
  updateApplicationSchema,
};