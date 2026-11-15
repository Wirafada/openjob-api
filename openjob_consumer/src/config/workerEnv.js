const env = { ...process.env };

for (const field of ['HOST', 'PORT', 'USER', 'PASSWORD', 'SECURE']) {
  env[`MAIL_${field}`] = env[`MAIL_${field}`] || env[`SMTP_${field}`];
}
if (!env.MAIL_SECURE) env.MAIL_SECURE = String(env.MAIL_PORT === '465');

if (env.AMQP_URL) {
  env.RABBITMQ_SERVER = env.AMQP_URL;
} else if (env.RABBITMQ_HOST) {
  const user = encodeURIComponent(env.RABBITMQ_USER || 'guest');
  const password = encodeURIComponent(env.RABBITMQ_PASSWORD || 'guest');
  const port = env.RABBITMQ_PORT || '5672';
  env.RABBITMQ_SERVER = `amqp://${user}:${password}@${env.RABBITMQ_HOST}:${port}`;
}
module.exports = env;
