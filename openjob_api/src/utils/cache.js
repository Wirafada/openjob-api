const { connectRedis } = require('../config/redis');

const TTL = 3600;

async function getCache(key) {
  const client = await connectRedis();
  const value = await client.get(key);

  return value === null ? null : JSON.parse(value);
}

async function setCache(key, data) {
  const client = await connectRedis();

  await client.set(key, JSON.stringify(data), {
    EX: TTL,
  });
}

async function deleteCache(...keys) {
  if (keys.length === 0) return;

  const client = await connectRedis();
  await client.del(keys);
}

module.exports = {
  getCache,
  setCache,
  deleteCache,
};