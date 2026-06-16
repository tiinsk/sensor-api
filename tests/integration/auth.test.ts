/**
 * Integration tests for POST /api/login endpoint and API key authentication
 */

import jwt from 'jsonwebtoken';
import { getApiUrl, TEST_USER } from './utils/test-config';
import { getApiKeyAuthHeaders, TEST_JWT_SECRET } from './utils/auth-utils';
import { TEST_API_KEY } from '../utils/test-data';

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

  describe('POST /api/session/extend', () => {
    it('returns a renewed token for a valid user JWT', async () => {
      const loginResponse = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: TEST_USER.username,
          password: TEST_USER.password,
        }),
      });

      const { token: originalToken } =
        (await loginResponse.json()) as LoginSuccessResponse;

      await new Promise(resolve => setTimeout(resolve, 1100));

      const extendResponse = await fetch(`${API_URL}/api/session/extend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${originalToken}` },
      });

      expect(extendResponse.status).toBe(200);

      const { token: renewedToken } =
        (await extendResponse.json()) as LoginSuccessResponse;

      expect(typeof renewedToken).toBe('string');
      expect(renewedToken.split('.').length).toBe(3);
      expect(renewedToken).not.toBe(originalToken);

      const devicesResponse = await fetch(`${API_URL}/api/devices`, {
        headers: { Authorization: `Bearer ${renewedToken}` },
      });

      expect(devicesResponse.status).toBe(200);
    });

    it('returns 401 without a token', async () => {
      const response = await fetch(`${API_URL}/api/session/extend`, {
        method: 'POST',
      });

      expect(response.status).toBe(401);
    });

    it('returns 403 for an API key token', async () => {
      const headers = getApiKeyAuthHeaders(TEST_API_KEY);

      const response = await fetch(`${API_URL}/api/session/extend`, {
        method: 'POST',
        headers,
      });

      expect(response.status).toBe(403);

      const data = (await response.json()) as LoginErrorResponse;
      expect(data.error).toBe('User token required');
    });
  });

  describe('JWT edge cases', () => {
    it('expired JWT token returns 401', async () => {
      const token = jwt.sign(
        { username: TEST_USER.username, iat: Math.floor(Date.now() / 1000) - 3600 },
        TEST_JWT_SECRET,
        { expiresIn: '-1s' }
      );

      const response = await fetch(`${API_URL}/api/devices`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(401);
    });

    it('malformed token (e.g. not a valid JWT) returns 401', async () => {
      const response = await fetch(`${API_URL}/api/devices`, {
        headers: { Authorization: 'Bearer not.a.jwt' },
      });

      expect(response.status).toBe(401);
    });

    it('token signed with wrong secret returns 401', async () => {
      const token = jwt.sign(
        { username: TEST_USER.username, iat: Math.floor(Date.now() / 1000) },
        'wrong-secret-not-the-server-secret',
        { expiresIn: '1h' }
      );

      const response = await fetch(`${API_URL}/api/devices`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(401);
    });
  });
});

describe('POST /api/token', () => {
  const API_URL = getApiUrl();

  it('returns a token and expiresIn for a valid API key', async () => {
    const response = await fetch(`${API_URL}/api/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: TEST_API_KEY }),
    });

    expect(response.status).toBe(200);

    const data = (await response.json()) as { token: string; expiresIn: number };

    expect(typeof data.token).toBe('string');
    expect(data.token.split('.').length).toBe(3);
    expect(data.expiresIn).toBe(60 * 60 * 24 * 60);

    const devicesResponse = await fetch(`${API_URL}/api/devices`, {
      headers: { Authorization: `Bearer ${data.token}` },
    });

    expect(devicesResponse.status).toBe(200);
  });

  it('returns 401 for an unknown API key', async () => {
    const response = await fetch(`${API_URL}/api/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: 'nonexistent-api-key-xyz' }),
    });

    expect(response.status).toBe(401);
  });

  it('returns 400 when apiKey is missing', async () => {
    const response = await fetch(`${API_URL}/api/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });
});

describe('API Key Authentication', () => {
  const API_URL = getApiUrl();

  it('valid API key token is accepted on GET /api/devices', async () => {
    const headers = getApiKeyAuthHeaders(TEST_API_KEY);

    const response = await fetch(`${API_URL}/api/devices`, { headers });

    expect(response.status).toBe(200);
  });

  it('JWT containing unknown API key returns 401', async () => {
    // Valid JWT signature, but the apiKey value is not in the database
    const headers = getApiKeyAuthHeaders('nonexistent-api-key-xyz');

    const response = await fetch(`${API_URL}/api/devices`, { headers });

    expect(response.status).toBe(401);
  });

  it('raw API key string (not a JWT) returns 401', async () => {
    // Sending the raw key string directly — it is not a valid JWT
    const response = await fetch(`${API_URL}/api/devices`, {
      headers: { Authorization: `Bearer ${TEST_API_KEY}` },
    });

    expect(response.status).toBe(401);
  });
});
