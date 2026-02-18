/**
 * Authentication utilities for integration tests
 */

import { getApiUrl, TEST_USER } from './test-config';

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

