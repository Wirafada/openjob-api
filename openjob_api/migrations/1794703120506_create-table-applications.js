exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('applications', {
    id: {
      type: 'varchar(50)',
      primaryKey: true,
    },
    user_id: {
      type: 'varchar(50)',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    job_id: {
      type: 'varchar(50)',
      notNull: true,
      references: 'jobs',
      onDelete: 'CASCADE',
    },
    resume_url: {
      type: 'text',
      notNull: true,
    },
    cover_letter: {
      type: 'text',
    },
    status: {
      type: 'text',
      notNull: true,
      default: 'pending',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.addConstraint('applications', 'applications_user_job_unique', {
    unique: ['user_id', 'job_id'],
  });

  pgm.createIndex('applications', 'job_id');
};

exports.down = (pgm) => {
  pgm.dropTable('applications', { ifExists: true });
};