exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('jobs', {
    id: {
      type: 'varchar(50)',
      primaryKey: true,
    },
    company_id: {
      type: 'varchar(50)',
      notNull: true,
      references: 'companies',
      onDelete: 'CASCADE',
    },
    category_id: {
      type: 'varchar(50)',
      notNull: true,
      references: 'categories',
      onDelete: 'CASCADE',
    },
    title: {
      type: 'text',
      notNull: true,
    },
    description: {
      type: 'text',
      notNull: true,
    },
    job_type: {
      type: 'text',
      notNull: true,
    },
    experience_level: {
      type: 'text',
      notNull: true,
    },
    location_type: {
      type: 'text',
      notNull: true,
    },
    location_city: {
      type: 'text',
    },
    salary_min: {
      type: 'numeric',
    },
    salary_max: {
      type: 'numeric',
    },
    is_salary_visible: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    status: {
      type: 'text',
      notNull: true,
      default: 'open',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('jobs', 'company_id');
  pgm.createIndex('jobs', 'category_id');
};

exports.down = (pgm) => {
  pgm.dropTable('jobs');
};