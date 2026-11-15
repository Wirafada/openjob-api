exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE applications
    ALTER COLUMN resume_url DROP NOT NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE applications
    ALTER COLUMN resume_url SET NOT NULL;
  `);
};