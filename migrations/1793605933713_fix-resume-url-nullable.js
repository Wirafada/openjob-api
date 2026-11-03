export const shorthands = undefined;

export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE applications
    ALTER COLUMN resume_url DROP NOT NULL;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE applications
    ALTER COLUMN resume_url SET NOT NULL;
  `);
};