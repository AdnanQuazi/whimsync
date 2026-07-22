import Redis, { type RedisOptions } from "ioredis";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error(
    "Missing required environment variable: REDIS_URL inside apps/worker. Please ensure your .env file is loaded.",
  );
}

export const redisOptions: RedisOptions = {
  maxRetriesPerRequest: null, // Required by BullMQ workers
  lazyConnect: true, // Connect only when commands are issued or worker starts
};

export const redisConnection = new Redis(redisUrl, redisOptions);
