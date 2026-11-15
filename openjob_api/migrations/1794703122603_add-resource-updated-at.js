exports.shorthands = undefined;

exports.up = (pgm) => {
  for (const table of ['companies', 'categories']) {
    pgm.addColumns(table, { updated_at: { type: 'timestamptz' } });
    // Historical update times are unknown; use creation time as the baseline.
    pgm.sql(`UPDATE ${table} SET updated_at = created_at`);
    pgm.alterColumn(table, 'updated_at', {
      notNull: true,
      default: pgm.func('current_timestamp'),
    });
  }
};

exports.down = (pgm) => {
  for (const table of ['categories', 'companies']) {
    pgm.dropColumns(table, ['updated_at']);
  }
};
