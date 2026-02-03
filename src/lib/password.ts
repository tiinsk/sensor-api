/**
 * Password hashing utilities using SHA512 with salt
 */

import crypto from 'crypto';

/**
 * Generate a random string of specified length
 */
export function genRandomString(length: number): string {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

/**
 * Hash a password with a given salt using SHA512
 */
export function sha512(password: string, salt: string): {
  salt: string;
  passwordHash: string;
} {
  const hash = crypto.createHmac('sha512', salt);
  hash.update(password);
  const passwordHash = hash.digest('hex');
  return {
    salt,
    passwordHash,
  };
}

/**
 * Generate salt and hash password
 */
export function saltHashPassword(password: string): {
  salt: string;
  passwordHash: string;
} {
  const salt = genRandomString(16);
  return sha512(password, salt);
}

/**
 * Verify a password against a stored hash and salt
 */
export function verifyPassword(
  password: string,
  storedHash: string,
  salt: string
): boolean {
  const { passwordHash } = sha512(password, salt);
  return passwordHash === storedHash;
}
