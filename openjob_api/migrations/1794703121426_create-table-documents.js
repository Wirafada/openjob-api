exports.up = (pgm) => {
  pgm.createTable('documents', {
    id: { type: 'varchar(50)', primaryKey: true },
    user_id: {
      type: 'varchar(50)',
      notNull: true,
      references: 'users',
    },
    filename: { type: 'text', notNull: true, unique: true },
    original_name: { type: 'text', notNull: true },
    size: { type: 'integer', notNull: true },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });
  pgm.createIndex('documents', 'user_id');
};

exports.down = (pgm) => {
  pgm.dropTable('documents');
};
