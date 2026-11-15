require('dotenv').config();
const env = require('../config/workerEnv');

const amqp = require('amqplib');
const nodemailer = require('nodemailer');
const { setTimeout: delay } = require('node:timers/promises');

const pool = require('../config/database');

const queue = env.RABBITMQ_QUEUE;
const failedQueue = `${queue}.failed`;

let stopping = false;

process.on('SIGINT', () => {
  stopping = true;
});

process.on('SIGTERM', () => {
  stopping = true;
});

function permanentError(message) {
  const error = new Error(message);
  error.permanent = true;
  return error;
}

function preserveFailedMessage(channel, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Konfirmasi antrean gagal melewati 10 detik'));
    }, 10000);

    try {
      channel.sendToQueue(
        failedQueue,
        message.content,
        {
          persistent: true,
          contentType: 'application/json',
          messageId: message.properties.messageId,
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

async function deliver(message, transporter) {
  let payload;

  try {
    payload = JSON.parse(message.content.toString());
  } catch {
    throw permanentError('Isi pesan bukan JSON yang valid');
  }

  if (
    !payload ||
    typeof payload.application_id !== 'string' ||
    payload.application_id.length === 0
  ) {
    throw permanentError('application_id tidak valid');
  }

  const messageId =
    message.properties.messageId ||
    `application:${payload.application_id}`;

  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;

    await client.query(
      `INSERT INTO notification_deliveries (message_id)
       VALUES ($1)
       ON CONFLICT (message_id) DO NOTHING`,
      [messageId]
    );

    const delivery = await client.query(
      `SELECT sent_at
       FROM notification_deliveries
       WHERE message_id = $1
       FOR UPDATE`,
      [messageId]
    );

    if (delivery.rows[0].sent_at !== null) {
      await client.query('COMMIT');
      transactionStarted = false;

      console.log('Pesan sudah diproses; email tidak dikirim ulang');
      return;
    }

    const result = await client.query(
      `SELECT applications.id,
              applications.created_at,
              jobs.title AS job_title,
              companies.name AS company_name,
              applicant.name AS applicant_name,
              applicant.email AS applicant_email,
              owner.name AS owner_name,
              owner.email AS owner_email
       FROM applications
       JOIN jobs ON jobs.id = applications.job_id
       JOIN companies ON companies.id = jobs.company_id
       JOIN users AS applicant ON applicant.id = applications.user_id
       LEFT JOIN users AS owner ON owner.id = jobs.created_by
       WHERE applications.id = $1`,
      [payload.application_id]
    );

    if (result.rowCount === 0) {
      throw permanentError('Data lamaran tidak ditemukan');
    }

    const application = result.rows[0];

    if (!application.owner_email) {
      throw permanentError(
        'Pembuat lowongan belum tercatat atau sudah dihapus'
      );
    }

    const info = await transporter.sendMail({
      from: env.MAIL_FROM,
      to: {
        name: application.owner_name,
        address: application.owner_email,
      },
      subject: 'OpenJob: Lamaran baru diterima',
      text: [
        `Halo ${application.owner_name},`,
        '',
        'Ada lamaran baru untuk lowongan Anda.',
        '',
        `Lowongan: ${application.job_title}`,
        `Perusahaan: ${application.company_name}`,
        `Pelamar: ${application.applicant_name}`,
        `Email pelamar: ${application.applicant_email}`,
        `ID lamaran: ${application.id}`,
        `Waktu melamar: ${application.created_at.toISOString()}`,
        '',
        'Silakan periksa detail lamaran di OpenJob.',
      ].join('\n'),
    });

    if (!info.accepted || info.accepted.length === 0) {
      throw new Error('SMTP tidak menerima alamat penerima');
    }

    await client.query(
      `UPDATE notification_deliveries
       SET sent_at = CURRENT_TIMESTAMP
       WHERE message_id = $1`,
      [messageId]
    );

    await client.query('COMMIT');
    transactionStarted = false;

    console.log(`Email diterima SMTP untuk lamaran: ${application.id}`);

    const preview = nodemailer.getTestMessageUrl(info);

    if (preview) {
      console.log(`Lihat email pengujian: ${preview}`);
    }
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Rollback email gagal:', rollbackError.message);
      }
    }

    throw error;
  } finally {
    client.release();
  }
}

async function run() {
  const required = [
    'RABBITMQ_SERVER',
    'RABBITMQ_QUEUE',
    'MAIL_HOST',
    'MAIL_PORT',
    'MAIL_SECURE',
    'MAIL_USER',
    'MAIL_PASSWORD',
    'MAIL_FROM',
  ];

  for (const name of required) {
    if (!env[name]) {
      throw new Error(`${name} belum diisi pada .env`);
    }
  }

  const smtpPort = Number(env.MAIL_PORT);

  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
    throw new Error('MAIL_PORT tidak valid');
  }

  const transporter = nodemailer.createTransport({
    host: env.MAIL_HOST,
    port: smtpPort,
    secure: env.MAIL_SECURE === 'true',
    auth: {
      user: env.MAIL_USER,
      pass: env.MAIL_PASSWORD,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });

  try {
    await transporter.verify();
    console.log('Koneksi SMTP berhasil');

    while (!stopping) {
      let connection;
      let channel;
      let disconnected = false;

      try {
        connection = await amqp.connect(
          env.RABBITMQ_SERVER,
          { timeout: 5000 }
        );

        connection.on('error', (error) => {
          disconnected = true;
          console.error('RabbitMQ bermasalah:', error.message);
        });

        connection.on('close', () => {
          disconnected = true;
        });

        channel = await connection.createConfirmChannel();

        channel.on('error', (error) => {
          disconnected = true;
          console.error('Channel bermasalah:', error.message);
        });

        channel.on('close', () => {
          disconnected = true;
        });

        await channel.assertQueue(queue, { durable: true });
        await channel.assertQueue(failedQueue, { durable: true });

        console.log(`Consumer siap. Antrean: ${queue}`);

        // Ambil satu pesan setiap kali agar pemrosesan berurutan.
        while (!stopping && !disconnected) {
          const message = await channel.get(queue, { noAck: false });

          if (!message) {
            await delay(1000);
            continue;
          }

          try {
            await deliver(message, transporter);
          } catch (error) {
            console.error('Pemrosesan email gagal:', error.message);

            if (error.permanent) {
              // Simpan pesan bermasalah untuk diperiksa.
              await preserveFailedMessage(channel, message);
              channel.ack(message);
              console.log(`Pesan dipindahkan ke ${failedQueue}`);
            } else {
              // Gangguan sementara: coba kembali setelah jeda.
              await delay(5000);

              if (disconnected) {
                throw error;
              }

              channel.nack(message, false, true);
            }

            continue;
          }

          channel.ack(message);
        }
      } catch (error) {
        console.error('Consumer bermasalah:', error.message);
      } finally {
        if (channel) {
          await channel.close().catch(() => {});
        }

        if (connection) {
          await connection.close().catch(() => {});
        }
      }

      if (!stopping) {
        await delay(5000);
      }
    }
  } finally {
    transporter.close();
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