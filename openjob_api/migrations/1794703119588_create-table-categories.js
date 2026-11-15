exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('categories', {
    id: {
      type: 'varchar(50)',
      primaryKey: true,
    },
    name: {
      type: 'text',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('categories');
};