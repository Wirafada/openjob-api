const Joi = require('joi');

const jobSchema = Joi.object({
  company_id: Joi.string().max(50).required(),
  category_id: Joi.string().max(50).required(),
  title: Joi.string().trim().required(),
  description: Joi.string().trim().required(),

  job_type: Joi.string()
    .valid('full-time', 'part-time', 'contract', 'internship', 'freelance')
    .required(),

  experience_level: Joi.string()
    .valid('entry', 'junior', 'mid', 'senior', 'lead', 'executive')
    .required(),

  location_type: Joi.string()
    .valid('onsite', 'remote', 'hybrid')
    .required(),

  location_city: Joi.string().trim().allow('').optional(),
  salary_min: Joi.number().min(0).optional(),
  salary_max: Joi.number().min(0).optional(),
  is_salary_visible: Joi.boolean().default(false),

  // Collection resmi menggunakan "close".
  status: Joi.string()
    .valid('open', 'close', 'closed', 'draft')
    .default('open'),
})
  .custom((value, helpers) => {
    if (
      value.salary_min !== undefined &&
      value.salary_max !== undefined &&
      value.salary_max < value.salary_min
    ) {
      return helpers.message(
        'salary_max harus minimal sebesar salary_min'
      );
    }

    return value;
  })
  .required();

module.exports = { jobSchema };