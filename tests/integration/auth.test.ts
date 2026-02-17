/**
 * Integration tests for POST /api/login endpoint
 */

import { getApiUrl, TEST_USER } from './test-config';

interface LoginSuccessResponse {
  token: string;
  username: string;
}

interface LoginErrorResponse {
  error: string;
}

describe('POST /api/login - Integration', () => {
  const API_URL = getApiUrl();
  it('should successfully login with valid credentials and return JWT token', async () => {
    const response = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: TEST_USER.username,
        password: TEST_USER.password,
      }),
    });

    expect(response.status).toBe(200);

    const data = (await response.json()) as LoginSuccessResponse;

    // Verify response structure
    expect(data).toHaveProperty('token');

    // Verify token is a JWT (has 3 parts separated by dots)
    expect(typeof data.token).toBe('string');
    expect(data.token.split('.').length).toBe(3);
    expect(data.token.length).toBeGreaterThan(20);
  });

  it('should return 401 for invalid username', async () => {
    const response = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'nonexistentuser',
        password: TEST_USER.password,
      }),
    });

    expect(response.status).toBe(401);

    const data = (await response.json()) as LoginErrorResponse;
    expect(data).toHaveProperty('error');
    expect(typeof data.error).toBe('string');
  });

  it('should return 401 for invalid password', async () => {
    const response = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: TEST_USER.username,
        password: 'wrongpassword',
      }),
    });

    expect(response.status).toBe(401);

    const data = (await response.json()) as LoginErrorResponse;
    expect(data).toHaveProperty('error');
  });

  it('should return 400 for missing username', async () => {
    const response = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: TEST_USER.password,
      }),
    });

    expect(response.status).toBe(400);

    const data = (await response.json()) as LoginErrorResponse;
    expect(data).toHaveProperty('error');
  });

  it('should return 400 for missing password', async () => {
    const response = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: TEST_USER.username,
      }),
    });

    expect(response.status).toBe(400);

    const data = (await response.json()) as LoginErrorResponse;
    expect(data).toHaveProperty('error');
  });

  it('should return 400 for empty request body', async () => {
    const response = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);

    const data = (await response.json()) as LoginErrorResponse;
    expect(data).toHaveProperty('error');
  });

  it('should return valid token that can be used for authenticated requests', async () => {
    // Login
    const loginResponse = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: TEST_USER.username,
        password: TEST_USER.password,
      }),
    });

    const loginData = (await loginResponse.json()) as LoginSuccessResponse;
    const token = loginData.token;

    // Use token to access protected endpoint
    const devicesResponse = await fetch(`${API_URL}/api/devices`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(devicesResponse.status).toBe(200);
  });
});
