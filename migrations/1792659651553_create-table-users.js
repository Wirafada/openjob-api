export const shorthands = undefined;

export const up = (pgm) => {
  pgm.createTable('users', {
    id: {
      type: 'varchar(50)',
      primaryKey: true,
    },
    name: {
      type: 'text',
      notNull: true,
    },
    email: {
      type: 'text',
      notNull: true,
      unique: true,
    },
    password: {
      type: 'text',
      notNull: true,
    },
    role: {
      type: 'text',
      notNull: true,
      default: 'user',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });
};

export const down = (pgm) => {
  pgm.dropTable('users');
};