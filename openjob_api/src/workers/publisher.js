require('dotenv').config();
const env = require('../config/workerEnv');

const amqp = require('amqplib');
const { setTimeout: delay } = require('node:timers/promises');

const pool = require('../config/database');

const rabbitUrl = env.RABBITMQ_SERVER;
const queue = env.RABBITMQ_QUEUE;

let stopping = false;

process.on('SIGINT', () => {
  stopping = true;
});

process.on('SIGTERM', () => {
  stopping = true;
});

// Tunggu konfirmasi penerimaan dari RabbitMQ.
function publish(channel, row) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Konfirmasi RabbitMQ melewati 10 detik'));
    }, 10000);

    try {
      channel.sendToQueue(
        queue,
        Buffer.from(JSON.stringify(row.payload)),
        {
          persistent: true,
          contentType: 'application/json',
          messageId: row.id,
          type: 'application.created',
        },
        (error) => {
          clearTimeout(timer);

          if (error) {
            reject(error);
            return;
          }

          resolve();
        }
      );
    } catch (error) {
      clearTimeout(timer);
      reject(error);
    }
  });
}

async function publishNext(channel) {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;

    // Beberapa publisher dapat berjalan tanpa mengambil baris yang sama.
    const result = await client.query(
      `SELECT id, application_id, payload
       FROM notification_outbox
       WHERE published_at IS NULL
         AND available_at <= CURRENT_TIMESTAMP
       ORDER BY created_at, id
       LIMIT 1
       FOR UPDATE SKIP LOCKED`
    );

    if (result.rowCount === 0) {
      await client.query('COMMIT');
      transactionStarted = false;
      return false;
    }

    const row = result.rows[0];

    await publish(channel, row);

    // Tandai selesai setelah broker memberikan konfirmasi.
    await client.query(
      `UPDATE notification_outbox
       SET published_at = CURRENT_TIMESTAMP,
           attempts = attempts + 1,
           last_error = NULL
       WHERE id = $1`,
      [row.id]
    );

    await client.query('COMMIT');
    transactionStarted = false;

    console.log(
      `Notifikasi lamaran dikirim ke RabbitMQ: ${row.application_id}`
    );

    return true;
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Rollback outbox gagal:', rollbackError.message);
      }
    }

    throw error;
  } finally {
    client.release();
  }
}

async function run() {
  if (!rabbitUrl || !queue) {
    throw new Error(
      'RABBITMQ_SERVER dan RABBITMQ_QUEUE wajib diisi pada .env'
    );
  }

  while (!stopping) {
    let connection;
    let channel;
    let disconnected = false;

    try {
      connection = await amqp.connect(rabbitUrl, {
        timeout: 5000,
      });

      connection.on('error', (error) => {
        disconnected = true;
        console.error('Koneksi RabbitMQ bermasalah:', error.message);
      });

      connection.on('close', () => {
        disconnected = true;
      });

      channel = await connection.createConfirmChannel();

      channel.on('error', (error) => {
        disconnected = true;
        console.error('Channel RabbitMQ bermasalah:', error.message);
      });

      channel.on('close', () => {
        disconnected = true;
      });

      await channel.assertQueue(queue, {
        durable: true,
      });

      console.log(`Publisher siap. Antrean: ${queue}`);

      while (!stopping && !disconnected) {
        const published = await publishNext(channel);

        if (!published) {
          await delay(1000);
        }
      }
    } catch (error) {
      console.error('Publisher gagal:', error.message);
    } finally {
      if (channel) {
        await channel.close().catch(() => {});
      }

      if (connection) {
        await connection.close().catch(() => {});
      }
    }

    if (!stopping) {
      console.log('Menghubungkan ulang dalam 5 detik...');
      await delay(5000);
    }
  }
}

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });