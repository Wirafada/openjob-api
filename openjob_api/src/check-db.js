require('dotenv').config();

const { Pool } = require('pg');

const pool = new Pool({
  connectionTimeoutMillis: 5000,
});

async function checkDatabase() {
  try {
    const result = await pool.query(
      'SELECT current_database() AS database'
    );

    console.log('Koneksi PostgreSQL berhasil!');
    console.log('Database:', result.rows[0].database);
  } catch (error) {
    console.error('Koneksi PostgreSQL gagal:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

checkDatabase();