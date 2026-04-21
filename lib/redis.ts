import { Redis } from '@upstash/redis';

// This single line reads the environment variables `UPSTASH_REDIS_REST_URL`
// and `UPSTASH_REDIS_REST_TOKEN` that Vercel provides.
export const redis = Redis.fromEnv();


/*
test in cli:
? copy them normally ctrl c  but to paste it just right click in the terminal
curl https://correct-mammal-93922.upstash.io -H "Authorization: Bearer gQAAAAAAAW7iAAIgcDI2ZWRiNDdmOTk5Y2Q0NzY5YWM5NTU2ODljNzBhMTg3OA" -d '["SET", "test-cli", "works"]'
curl https://correct-mammal-93922.upstash.io -H "Authorization: Bearer gQAAAAAAAW7iAAIgcDI2ZWRiNDdmOTk5Y2Q0NzY5YWM5NTU2ODljNzBhMTg3OA" -d '["GET", "test-cli"]'
*/