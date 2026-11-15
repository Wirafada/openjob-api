exports.up = (pgm) => {
  pgm.createTable('notification_outbox', {
    id: {
      type: 'varchar(50)',
      primaryKey: true,
    },
    application_id: {
      type: 'varchar(50)',
      notNull: true,
    },
    payload: {
      type: 'jsonb',
      notNull: true,
    },
    attempts: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    available_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    published_at: {
      type: 'timestamptz',
    },
    last_error: {
      type: 'text',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('notification_outbox', [
    'published_at',
    'available_at',
  ]);
};

exports.down = (pgm) => {
  pgm.dropTable('notification_outbox');
};