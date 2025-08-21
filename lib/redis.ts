import { Redis } from '@upstash/redis';

// This single line reads the environment variables `UPSTASH_REDIS_REST_URL`
// and `UPSTASH_REDIS_REST_TOKEN` that Vercel provides.
export const redis = Redis.fromEnv();