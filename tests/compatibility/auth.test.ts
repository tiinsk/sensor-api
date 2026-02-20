/**
 * Compatibility Tests: Authentication (Login)
 *
 * Compare login endpoint behavior between old and new APIs
 */

import { OLD_API_URL, NEW_API_URL, verifyServersRunning } from './utils/test-server';
import { TEST_USER } from '../utils/test-data';

// Response type definitions
interface LoginSuccessResponse {
  token: string;
}

describe('POST /api/login - Compatibility', () => {
  beforeAll(async () => {
    await verifyServersRunning();
  });

  describe('Successful Login', () => {
    it('should return a valid JWT token from both APIs', async () => {
      // Login to old API
      const oldResponse = await fetch(`${OLD_API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: TEST_USER.username,
          password: TEST_USER.password,
        }),
      });

      // Login to new API
      const newResponse = await fetch(`${NEW_API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: TEST_USER.username,
          password: TEST_USER.password,
        }),
      });

      // Both should return 200
      expect(oldResponse.status).toBe(200);
      expect(newResponse.status).toBe(200);

      // Get response bodies
      const oldToken = await oldResponse.text();
      const newData = await newResponse.json() as LoginSuccessResponse;
      const newToken = newData.token;

      // Both should have tokens
      expect(oldToken).toBeDefined();
      expect(newToken).toBeDefined();
      expect(typeof oldToken).toBe('string');
      expect(typeof newToken).toBe('string');

      // Tokens should be JWT format (3 parts separated by dots)
      expect(oldToken.split('.').length).toBe(3);
      expect(newToken.split('.').length).toBe(3);

      // Decode JWT payloads (without verification, just for comparison)
      const oldPayload = JSON.parse(Buffer.from(oldToken.split('.')[1], 'base64').toString());
      const newPayload = JSON.parse(Buffer.from(newToken.split('.')[1], 'base64').toString());

      // Both should contain username
      expect(oldPayload.username).toBe(TEST_USER.username);
      expect(newPayload.username).toBe(TEST_USER.username);
    });

    it('should accept the token from each API in subsequent requests', async () => {
      // Get token from old API
      const oldLoginResponse = await fetch(`${OLD_API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: TEST_USER.username,
          password: TEST_USER.password,
        }),
      });
      const oldToken = await oldLoginResponse.text();

      // Get token from new API
      const newLoginResponse = await fetch(`${NEW_API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: TEST_USER.username,
          password: TEST_USER.password,
        }),
      });
      const newData = await newLoginResponse.json() as LoginSuccessResponse;
      const newToken = newData.token;

      // Test old token with old API
      const oldDevicesResponse = await fetch(`${OLD_API_URL}/api/devices`, {
        headers: { 'Authorization': oldToken },
      });
      expect(oldDevicesResponse.status).toBe(200);

      // Test new token with new API
      const newDevicesResponse = await fetch(`${NEW_API_URL}/api/devices`, {
        headers: { 'Authorization': `Bearer ${newToken}` },
      });
      expect(newDevicesResponse.status).toBe(200);
    });
  });

  describe('Failed Login - Invalid Credentials', () => {
    it('should return 401 from both APIs for wrong password', async () => {
      const credentials = {
        username: TEST_USER.username,
        password: 'wrongpassword',
      };

      // Try old API
      const oldResponse = await fetch(`${OLD_API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      // Try new API
      const newResponse = await fetch(`${NEW_API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      // Both should return 401
      expect(oldResponse.status).toBe(401);
      expect(newResponse.status).toBe(401);
    });

    it('should return 401 from both APIs for non-existent user', async () => {
      const credentials = {
        username: 'nonexistentuser',
        password: 'anypassword',
      };

      // Try old API
      const oldResponse = await fetch(`${OLD_API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      // Try new API
      const newResponse = await fetch(`${NEW_API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      // Both should return 401
      expect(oldResponse.status).toBe(401);
      expect(newResponse.status).toBe(401);
    });
  });

  describe('Failed Login - Missing Fields', () => {
    it('should return 400 from both APIs for missing username', async () => {
      // Try old API
      const oldResponse = await fetch(`${OLD_API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: TEST_USER.password }),
      });

      // Try new API
      const newResponse = await fetch(`${NEW_API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: TEST_USER.password }),
      });

      // Both should return 400 (bad request)
      expect(oldResponse.status).toBe(400);
      expect(newResponse.status).toBe(400);
    });

    it('should return 400 from both APIs for missing password', async () => {
      // Try old API
      const oldResponse = await fetch(`${OLD_API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: TEST_USER.username }),
      });

      // Try new API
      const newResponse = await fetch(`${NEW_API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: TEST_USER.username }),
      });

      // Both should return 400 (bad request)
      expect(oldResponse.status).toBe(400);
      expect(newResponse.status).toBe(400);
    });
  });
});
