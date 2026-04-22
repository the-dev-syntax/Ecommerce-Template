import { redis } from './redis'; 
import { Ratelimit } from '@upstash/ratelimit';
import { headers } from 'next/headers';



// Email limiter (use sliding window)
const emailResendLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(1, "5 m"),
  prefix: "v1:ratelimit:email-resend",
});

// IP limiter
const ipTokenAttemptLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "10 m"),
  prefix: "v1:ratelimit:token-attempts",
});

async function getIP() {
  const h = await headers();

  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip');

  if (!ip) {
    const ua = h.get('user-agent') ?? 'unknown';
    return `fallback:${ua}`;
  }

  return ip;
}

export async function checkAndSetEmailRateLimit(email: string) {
  const normalized = email.toLowerCase().trim();
  const { success, reset } = await emailResendLimit.limit(normalized);

  if (!success) {
    const retry = Math.ceil((reset - Date.now()) / 1000);
    throw new Error(`Please wait ${retry} seconds before requesting another email`);
  }
}

export async function incrementIPEmailTokenAttempt() {
  const ip = await getIP();
  const { success, reset } = await ipTokenAttemptLimit.limit(ip);

  if (!success) {
    const retry = Math.ceil((reset - Date.now()) / 1000 / 60);
    throw new Error(`Too many invalid attempts - try again in ${retry} minutes`);
  }
}

// optional: usually not needed
export async function resetIPAttempt() {
  const ip = await getIP();
  const keys = await redis.keys(`v1:ratelimit:token-attempts:${ip}*`);
  if (keys.length) await redis.del(...keys);
}





/*
import { redis } from './redis'; 
import { headers } from 'next/headers';

// --- Configuration ---
// 1. Limit how often a user can request a verification email (based on their email address).
// 2. Track and limit invalid verification token attempts (based on the client’s IP address).
// 3. Reset the invalid attempt counter when a verification is successful.

const EMAIL_COOLDOWN_SECONDS = 0.5 * 60; // 5 minute - period between two verification emails is 5 minute at sign-in. 
const MAX_INVALID_ATTEMPTS = 100; // Token invalidation attempts.
const IP_LOCKOUT_PERIOD_SECONDS = 0.5 * 60; // 10 minutes, locked out for invalid token attempts.


// --- Rate Limiting for Resending Emails ---

 * Checks if an email is currently in a cooldown period for resending verification. 
 * @ throws An error if the email is on cooldown.

export async function checkEmailRateLimit(email: string) {
  console.log('in checkEmailRateLimit with email:', email)
  const key = `Email-resend-limit:${email}`;
  console.log('@@@@@@@@@@@@@@@@@@@@ after key was made')
  
  const inCooldown = await redis.get(key);
  console.log('after await redis.get key')
    // Time to live
  if (inCooldown) {
    const ttl = await redis.ttl(key);
    throw new Error(`Please wait ${ttl} more seconds before requesting another email`);
  }
}


//  Sets the cooldown between two verification emails.
export async function setEmailRateLimit(email: string) {
  const key = `Email-resend-limit:${email}`;
  // The .set() method with expiry (`ex`) is also identical.
  await redis.set(key, 'sent', { ex: EMAIL_COOLDOWN_SECONDS });
}

//? --- IP Lockout for Invalid Token Attempts ---

//  Retrieves the IP address from the request headers.
//  returns The IP address as a string.
async function getIP() {
  const FALLBACK_IP_ADDRESS = '0.0.0.0';
  const headerList = await headers(); // Call it once and store it  
  const forwardedFor = headerList.get('x-forwarded-for');

  return (forwardedFor ? forwardedFor.split(',')[0] : headerList.get('x-real-ip')) ?? FALLBACK_IP_ADDRESS;
}


//  Checks and increments the invalid token attempt counter for an IP address.
//  throws An error if the IP is locked out.
export async function incrementIPEmailTokenAttempt() {
  const ip = await getIP();
  const key = `Email-attempts:${ip}`;
  
  // .get() returns null if the key doesn't exist, so `?? 0` handles that.
  // ttl = Time Till Limit
  const attemptCount = await redis.get<number>(key) ?? 0;

  if (attemptCount >= MAX_INVALID_ATTEMPTS) {
    const ttl = await redis.ttl(key);
    // this message has to be the same as a check for it in the api/email-verification/route
    throw new Error(`Too many invalid attempts - Please try again in ${Math.ceil(ttl / 60)} minutes`);
  }
  
  // .incr() increment and .expire() are standard Redis commands.
  const newCount = await redis.incr(key);
  if (newCount === 1) {
    await redis.expire(key, IP_LOCKOUT_PERIOD_SECONDS);
  }
}


 * Resets the invalid attempt counter for an IP upon successful verification.

export async function resetIPAttempt() {
  const ip = await getIP();
  const key = `Email-attempts:${ip}`;
  // .del() is the standard command for deleting a key.
  await redis.del(key);
}
*/