'use server';
import { redis } from '@/lib/redis';

// INVALIDATE All SESSIONS FOR A USER
export async function invalidateUserSessions(userId: string) {
  if (!userId) return;

  try {
    // The @next-auth/upstash-redis-adapter stores a set of session tokens for each user.
    // The key for this set is in the format: `user:sessions:<userId>`
    const sessionKeys = await redis.smembers(`user:sessions:${userId}`);

    if (sessionKeys.length === 0) {
      return; // No sessions to delete
    }

    const pipeline = redis.pipeline();

    // The sessionKeys are just the tokens, not the full Redis keys.
    // The full session keys are `user:session:<session_token>`.
    const fullSessionKeys = sessionKeys.map(token => `user:session:${token}`);
    
    // Delete all the actual session objects
    pipeline.del(...fullSessionKeys);
    
    // Delete the set that links the user to their sessions
    pipeline.del(`user:sessions:${userId}`);
    
    await pipeline.exec();
    
    console.log(`Invalidated ${sessionKeys.length} sessions for user ${userId}`);
  } catch (error) {
    console.error(`Failed to invalidate sessions for user ${userId}:`, error);
  }
}