/**
 * Authentication utilities for integration tests
 */

import jwt from 'jsonwebtoken';
import { getApiUrl, TEST_USER } from './test-config';

// Must match JWT_SECRET used by the running server (.env.local default)
const TEST_JWT_SECRET = process.env.JWT_SECRET || '';

interface LoginResponse {
  token: string;
}

export type RequestHeaders = Record<string, string>;

/**
 * Get authentication headers for integration tests
 * Includes both Authorization and Content-Type headers
 */
export async function getAuthHeaders(): Promise<RequestHeaders> {
  const API_URL = getApiUrl();

  const loginResponse = await fetch(`${API_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: TEST_USER.username,
      password: TEST_USER.password,
    }),
  });

  if (!loginResponse.ok) {
    throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
  }

  const loginData = (await loginResponse.json()) as LoginResponse;

  return {
    Authorization: `Bearer ${loginData.token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Build Authorization headers using an API key JWT.
 * The Raspberry Pi authenticates this way — it holds a pre-signed JWT whose
 * payload is { apiKey: '<key>' } rather than { username: '<user>' }.
 */
export function getApiKeyAuthHeaders(apiKey: string): RequestHeaders {
  const token = jwt.sign(
    { apiKey, iat: Math.floor(Date.now() / 1000) },
    TEST_JWT_SECRET,
    { expiresIn: '1h' }
  );
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

