exports.up = (pgm) => {
  pgm.addColumns('jobs', {
    created_by: {
      type: 'varchar(50)',
      references: 'users',
      onDelete: 'SET NULL',
    },
  });

  pgm.createIndex('jobs', 'created_by');
};

exports.down = (pgm) => {
  pgm.dropIndex('jobs', 'created_by');
  pgm.dropColumns('jobs', ['created_by']);
};