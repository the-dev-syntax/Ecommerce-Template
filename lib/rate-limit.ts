import { redis } from './redis'; 
import { Ratelimit } from '@upstash/ratelimit';
import { headers } from 'next/headers';
import { formatSeconds, normalizeEmail } from './utils';



// IP-based Auth Action Limiter (5 requests per 1 minute)
const authActionLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 m"),
  prefix: "v1:ratelimit:auth-action",
});

/**
 * Rapid-fire protection: Prevents an IP from hammering Auth actions 
 * (Register, Update Email, Resend Email) before any DB work is done.
 */
export async function limitAuthActionsByIP() {
  const ip = await getIP();
  const { success, reset } = await authActionLimiter.limit(ip);

  if (!success) {
    const retrySeconds = Math.ceil((reset - Date.now()) / 1000);
    throw new Error(`Too many requests. Please wait ${formatSeconds(retrySeconds)}`);
  }
}

// Public, unauthenticated actions that still touch the database. These are
// deliberately generous: they only need to stop scripted abuse, not normal
// cart interaction.
const cartPricingIpLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1 m'),
  prefix: 'v1:ratelimit:cart-pricing',
})

/** Limit cart repricing triggered from the client store. */
export async function limitCartPricingByIP() {
  const ip = await getIP()
  const { success } = await cartPricingIpLimit.limit(ip)

  if (!success)
    throw new Error('Too many cart updates. Please wait a moment.')
}

const currencyIpLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: 'v1:ratelimit:currency',
})

/** Limit currency-switch writes (one cookie write per change). */
export async function limitCurrencyChangesByIP() {
  const ip = await getIP()
  const { success } = await currencyIpLimit.limit(ip)

  if (!success)
    throw new Error('Too many currency changes. Please wait a moment.')
}

// Credential sign-in limiters: slow down brute force and credential stuffing.
// Per-IP catches distributed email guessing; per-email catches many IPs
// targeting one account. Successful sign-ins count too, so keep the windows
// high enough for normal use.
const signInIpLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "10 m"),
  prefix: "v1:ratelimit:sign-in-ip",
});

const signInEmailLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "10 m"),
  prefix: "v1:ratelimit:sign-in-email",
});

export async function limitSignInAttempts(email: string) {
  const ip = await getIP();
  const normalized = normalizeEmail(email);

  const [byIp, byEmail] = await Promise.all([
    signInIpLimit.limit(ip),
    signInEmailLimit.limit(normalized),
  ]);

  if (!byIp.success || !byEmail.success) {
    const reset = Math.max(byIp.reset, byEmail.reset);
    const retrySeconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    throw new Error(
      `Too many sign-in attempts. Please wait ${formatSeconds(retrySeconds)}`
    );
  }
}

// Password reset request limiters: stop inbox flooding and email probing.
const passwordResetIpLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "15 m"),
  prefix: "v1:ratelimit:password-reset-ip",
});

const passwordResetEmailLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "15 m"),
  prefix: "v1:ratelimit:password-reset-email",
});

const passwordResetConfirmIpLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "15 m"),
  prefix: "v1:ratelimit:password-reset-confirm-ip",
});

export async function limitPasswordResetRequests(email: string) {
  const ip = await getIP();
  const normalized = normalizeEmail(email);

  const [byIp, byEmail] = await Promise.all([
    passwordResetIpLimit.limit(ip),
    passwordResetEmailLimit.limit(normalized),
  ]);

  if (!byIp.success || !byEmail.success) {
    const reset = Math.max(byIp.reset, byEmail.reset);
    const retrySeconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    throw new Error(
      `Too many reset requests. Please wait ${formatSeconds(retrySeconds)}`
    );
  }
}

export async function limitPasswordResetConfirm() {
  const ip = await getIP();
  const { success, reset } = await passwordResetConfirmIpLimit.limit(ip);

  if (!success) {
    const retrySeconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    throw new Error(
      `Too many attempts. Please wait ${formatSeconds(retrySeconds)}`
    );
  }
}

// Email limiter (use sliding window) ==> 3 attempts per 5 minutes per email address
const emailResendLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "5 m"),
  prefix: "v1:ratelimit:email-resend",
});

// IP limiter (use sliding window) ==> 10 attempts per 10 minutes per IP address
const ipTokenAttemptLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(8, "20 m"),
  prefix: "v1:ratelimit:token-attempts",
});

// ua = user-agent (browser id) as a fallback when IP is not found.
async function getIP() {
  const h = await headers()

  // Only trust a header that the deployment's edge/proxy sets (or
  // overwrites). The left-most X-Forwarded-For entry is client-controlled:
  // anyone can prepend an arbitrary address there, which defeats every
  // limiter in this file. Set TRUSTED_IP_HEADER when the deployment uses a
  // proxy/header this code does not know about (e.g. cf-connecting-ip).
  const configuredHeader = process.env.TRUSTED_IP_HEADER?.trim().toLowerCase()
  const candidates = [
    configuredHeader,
    'x-vercel-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip',
  ].filter(Boolean) as string[]

  for (const headerName of candidates) {
    const value = h.get(headerName)
    if (!value) continue
    const first = value.split(',')[0]?.trim()
    if (first) return first
  }

  const forwardedFor = h.get('x-forwarded-for')
  if (forwardedFor) {
    // The right-most value is the one added by the nearest proxy; without an
    // explicit TRUSTED_IP_HEADER this is the safest available fallback.
    const parts = forwardedFor
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
    if (parts.length) return parts[parts.length - 1]
  }

  const ua = h.get('user-agent') ?? 'unknown'
  return `fallback:${ua}`
}

export async function checkAndSetEmailRateLimit(email: string) {
  
  const normalized = email.toLowerCase().trim();
  const { success, reset } = await emailResendLimit.limit(normalized);

  if (!success) {
    const retry = Math.ceil((reset - Date.now()) / 1000);
    throw new Error(`Please wait ${formatSeconds(retry)} before requesting another email`);
  }
}

export async function incrementIPEmailTokenAttempt() {
  const ip = await getIP();
  const { success, reset } = await ipTokenAttemptLimit.limit(ip);

  if (!success) {
    const retry = Math.ceil((reset - Date.now()) / 1000);
    throw new Error(`Too many invalid attempts - try again in ${formatSeconds(retry)}`);
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