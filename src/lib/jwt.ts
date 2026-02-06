/**
 * JWT utilities for token generation and verification
 */

import jwt from 'jsonwebtoken';
import { env } from './env';

const JWT_SECRET = env.JWT_SECRET;

// Token expiration times (in seconds)
const API_KEY_TOKEN_EXPIRATION = 60 * 60 * 24 * 60; // 60 days
const USER_TOKEN_EXPIRATION = 60 * 60 * 24 * 60; // 60 days

export interface UserTokenPayload {
  username: string;
  iat: number;
}

export interface ApiKeyTokenPayload {
  apiKey: string;
  deviceId?: string;
  iat: number;
}

export type TokenPayload = UserTokenPayload | ApiKeyTokenPayload;

/**
 * Sign a JWT token for a user
 */
export function signUserToken(username: string): string {
  const payload: UserTokenPayload = {
    username,
    iat: Math.floor(Date.now() / 1000), // JWT standard uses seconds
  };
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: USER_TOKEN_EXPIRATION,
  });
}

/**
 * Sign a JWT token for an API key
 */
export function signApiKeyToken(apiKey: string, deviceId?: string): string {
  const payload: ApiKeyTokenPayload = {
    apiKey,
    deviceId,
    iat: Math.floor(Date.now() / 1000),
  };
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: API_KEY_TOKEN_EXPIRATION,
  });
}

/**
 * Verify and decode a JWT token
 * Returns the decoded payload or null if invalid
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    // Token is invalid or expired
    return null;
  }
}

/**
 * Check if a token payload is a user token
 */
export function isUserToken(payload: TokenPayload): payload is UserTokenPayload {
  return 'username' in payload;
}

/**
 * Check if a token payload is an API key token
 */
export function isApiKeyToken(payload: TokenPayload): payload is ApiKeyTokenPayload {
  return 'apiKey' in payload;
}
