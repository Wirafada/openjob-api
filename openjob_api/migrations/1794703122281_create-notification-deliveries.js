exports.up = (pgm) => {
  pgm.createTable('notification_deliveries', {
    message_id: {
      type: 'text',
      primaryKey: true,
    },
    sent_at: {
      type: 'timestamptz',
    },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('notification_deliveries');
};