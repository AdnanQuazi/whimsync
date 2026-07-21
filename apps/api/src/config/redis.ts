import Redis, { type RedisOptions } from "ioredis";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error(
    "Missing required environment variable: REDIS_URL. Please ensure your .env file is loaded.",
  );
}

export const redisOptions: RedisOptions = {
  maxRetriesPerRequest: null, // Required by BullMQ
  lazyConnect: true, // Connect only when commands are issued to avoid eager connection errors during boot/tests
};

export const redisConnection = new Redis(redisUrl, redisOptions);
