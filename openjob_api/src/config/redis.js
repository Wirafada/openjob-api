const { createClient } = require('redis');

const redis = createClient({
  url: process.env.REDIS_HOST
    ? undefined
    : process.env.REDIS_URL,
  socket: {
    ...(process.env.REDIS_HOST ? {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT || 6379),
    } : {}),
    connectTimeout: 5000,
    reconnectStrategy: false,
  },
});

redis.on('error', (error) => {
  console.error('Redis error:', error.message);
});

let connecting;

async function connectRedis() {
  if (redis.isReady) return redis;

  if (!connecting) {
    connecting = redis.connect()
      .then(() => redis)
      .finally(() => {
        connecting = undefined;
      });
  }

  return connecting;
}

module.exports = { redis, connectRedis };