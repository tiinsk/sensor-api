/**
 * Authentication utilities for tests
 */

import { OLD_API_URL, NEW_API_URL } from '../utils/test-server';
import { TEST_USER } from '../utils/test-data';

interface LoginSuccessResponse {
  token: string;
  username: string;
}

export interface ApiAuthHeaders {
  oldHeaders: { Authorization: string };
  newHeaders: { Authorization: string };
}

/**
 * Get authentication headers for both old and new APIs
 * Ready to use in fetch requests
 */
export async function getAuthHeaders(): Promise<ApiAuthHeaders> {
  // Get old API token
  const oldLoginRes = await fetch(`${OLD_API_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: TEST_USER.username, password: TEST_USER.password }),
  });
  const oldToken = await oldLoginRes.text();

  // Get new API token
  const newLoginRes = await fetch(`${NEW_API_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: TEST_USER.username, password: TEST_USER.password }),
  });
  const newData = (await newLoginRes.json()) as LoginSuccessResponse;
  const newToken = newData.token;

  return {
    oldHeaders: { Authorization: oldToken },
    newHeaders: { Authorization: `Bearer ${newToken}` },
  };
}
