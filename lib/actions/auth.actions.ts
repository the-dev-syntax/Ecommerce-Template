"use server"

import { AuthenticatedUser } from '@/types/next-auth'
import { redis } from '../redis'
import { cache } from 'react';


// GET CACHED USER 
export async function getCachedUserByKey(kvKey: string): Promise<AuthenticatedUser | null>  {

  console.log(`--- Fetching user ${kvKey} from Redis ---`); // For debugging

  if (!kvKey) {
    return null;
  }

  try {    

    const upstashUser = await redis.get(kvKey);
    console.log('CACHE FUNCTION :upstashUser:()()()()()()()()()()',upstashUser)

    if (!upstashUser) {
      console.warn(`User with ID ${kvKey} not found in Redis cache.`);
    //   await redis.del(kvKey);
      // fallback

      return null;
    }
    console.log('CACHE FUNCTION :upstashUser before parsing ', upstashUser);

    const user: AuthenticatedUser = JSON.parse(JSON.stringify(upstashUser));
   
    console.log('CACHE FUNCTION :upstashUser after parsing ()()()()()()()()()() ', user);

    return user;
  } catch (error) {
    console.error('Failed to fetch user from Redis:', error);
    
    return null;
  }


};

export const cachedGetUserByKey = cache(async (kvKey: string) => {
    console.log(`--- getCachedUserByKey called for: ${kvKey} ---`); 
    const user = await getCachedUserByKey(kvKey);
    return user;
}, );