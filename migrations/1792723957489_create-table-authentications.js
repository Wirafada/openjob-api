export const shorthands = undefined;

export const up = (pgm) => {
  pgm.createTable('authentications', {
    token: {
      type: 'text',
      primaryKey: true,
    },
    user_id: {
      type: 'varchar(50)',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });
};

export const down = (pgm) => {
  pgm.dropTable('authentications');
};