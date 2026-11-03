export const shorthands = undefined;

export const up = (pgm) => {
  pgm.createTable('bookmarks', {
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
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.addConstraint('bookmarks', 'bookmarks_user_job_unique', {
    unique: ['user_id', 'job_id'],
  });
};

export const down = (pgm) => {
  pgm.dropTable('bookmarks', { ifExists: true });
};