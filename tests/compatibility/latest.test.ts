/**
 * Compatibility Tests: Latest Readings Endpoints
 *
 * Compare latest readings endpoints behavior between old and new APIs
 */

import { OLD_API_URL, NEW_API_URL, verifyServersRunning } from '../utils/test-server';
import { TEST_USER } from '../utils/test-data';
import {compareLatestReadings, compareNumbers} from './comparison-utils';

// Response type definitions
interface LoginSuccessResponse {
  token: string;
}

interface Reading {
  id?: string;
  battery: number | null;
  created_at?: string;
  timestamp?: string;
  humidity: number | null;
  pressure: number | null;
  temperature: number | null;
}

interface LatestDevice {
  id: string;
  name: string;
  order: number;
  reading: Reading | null;
  location_type?: string;
  sensor_info?: any;
}

interface LatestReadingsResponse {
  count: number;
  totCount: number;
  limit: number;
  values: LatestDevice[];
}

// Helper function to get auth tokens
async function getAuthTokens() {
  const oldLoginRes = await fetch(`${OLD_API_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: TEST_USER.username, password: TEST_USER.password }),
  });
  const oldToken = await oldLoginRes.text();

  const newLoginRes = await fetch(`${NEW_API_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: TEST_USER.username, password: TEST_USER.password }),
  });
  const newData = await newLoginRes.json() as LoginSuccessResponse;
  const newToken = newData.token;

  return { oldToken, newToken };
}

describe('GET /api/latest - Compatibility', () => {
  let oldToken: string;
  let newToken: string;

  beforeAll(async () => {
    await verifyServersRunning();
    const tokens = await getAuthTokens();
    oldToken = tokens.oldToken;
    newToken = tokens.newToken;
  });

  describe('Get All Latest Readings', () => {
    it('should return identical latest readings for all devices', async () => {
      // Get from old API
      const oldResponse = await fetch(`${OLD_API_URL}/api/devices/latest-readings`, {
        headers: { 'Authorization': oldToken },
      });

      // Get from new API
      const newResponse = await fetch(`${NEW_API_URL}/api/latest`, {
        headers: { 'Authorization': `Bearer ${newToken}` },
      });

      // Both should return 200
      expect(oldResponse.status).toBe(200);
      expect(newResponse.status).toBe(200);

      // Compare responses
      const oldData = await oldResponse.json() as LatestReadingsResponse;
      const newData = await newResponse.json() as LatestReadingsResponse;

      const comparison = compareLatestReadings(oldData, newData);
      if (!comparison.matches) {
        console.error('Latest readings comparison failed:', comparison.differences);
      }
      expect(comparison.matches).toBe(true);

      // Should return only enabled devices
      expect(oldData.count).toBeGreaterThan(0);
      expect(newData.count).toBeGreaterThan(0);
      expect(oldData.values.length).toBe(newData.values.length);

      // Each device should have a reading (from seed data)
      oldData.values.forEach(device => {
        expect(device.reading).not.toBeNull();
        expect(device.reading?.temperature).toBeDefined();
      });
    });

    it('should respect pagination with limit parameter', async () => {
      // Get with limit=1 from old API
      const oldResponse = await fetch(`${OLD_API_URL}/api/devices/latest-readings?limit=1`, {
        headers: { 'Authorization': oldToken },
      });

      // Get with limit=1 from new API
      const newResponse = await fetch(`${NEW_API_URL}/api/latest?limit=1`, {
        headers: { 'Authorization': `Bearer ${newToken}` },
      });

      const oldData = await oldResponse.json() as LatestReadingsResponse;
      const newData = await newResponse.json() as LatestReadingsResponse;

      // Should return exactly 1 device
      expect(oldData.count).toBe(1);
      expect(newData.count).toBe(1);
      expect(oldData.values.length).toBe(1);
      expect(newData.values.length).toBe(1);

      // But totCount should be total enabled devices
      expect(oldData.totCount).toBeGreaterThan(1);
      expect(newData.totCount).toBeGreaterThan(1);
    });

    it('should respect pagination with offset parameter', async () => {
      // Get first device (offset=0)
      const oldFirst = await fetch(`${OLD_API_URL}/api/devices/latest-readings?limit=1&offset=0`, {
        headers: { 'Authorization': oldToken },
      });
      const newFirst = await fetch(`${NEW_API_URL}/api/latest?limit=1&offset=0`, {
        headers: { 'Authorization': `Bearer ${newToken}` },
      });

      const oldFirstData = await oldFirst.json() as LatestReadingsResponse;
      const newFirstData = await newFirst.json() as LatestReadingsResponse;

      // Get second device (offset=1)
      const oldSecond = await fetch(`${OLD_API_URL}/api/devices/latest-readings?limit=1&offset=1`, {
        headers: { 'Authorization': oldToken },
      });
      const newSecond = await fetch(`${NEW_API_URL}/api/latest?limit=1&offset=1`, {
        headers: { 'Authorization': `Bearer ${newToken}` },
      });

      const oldSecondData = await oldSecond.json() as LatestReadingsResponse;
      const newSecondData = await newSecond.json() as LatestReadingsResponse;

      // Devices should be different
      expect(oldFirstData.values[0].id).not.toBe(oldSecondData.values[0].id);
      expect(newFirstData.values[0].id).not.toBe(newSecondData.values[0].id);

      // Both APIs should return same devices in same order
      expect(oldFirstData.values[0].id).toBe(newFirstData.values[0].id);
      expect(oldSecondData.values[0].id).toBe(newSecondData.values[0].id);
    });

    it('should order devices consistently', async () => {
      // Get all devices
      const oldResponse = await fetch(`${OLD_API_URL}/api/devices/latest-readings`, {
        headers: { 'Authorization': oldToken },
      });
      const newResponse = await fetch(`${NEW_API_URL}/api/latest`, {
        headers: { 'Authorization': `Bearer ${newToken}` },
      });

      const oldData = await oldResponse.json() as LatestReadingsResponse;
      const newData = await newResponse.json() as LatestReadingsResponse;

      // Extract device IDs in order
      const oldIds = oldData.values.map(d => d.id);
      const newIds = newData.values.map(d => d.id);

      // Should be in same order
      expect(oldIds).toEqual(newIds);

      // Should be sorted by order field
      const orders = newData.values.map(d => d.order);
      const sortedOrders = [...orders].sort((a, b) => a - b);
      expect(orders).toEqual(sortedOrders);
    });
  });

  describe('Authentication', () => {
    it('should return 401 without authentication', async () => {
      // Try old API without token
      const oldResponse = await fetch(`${OLD_API_URL}/api/devices/latest-readings`);

      // Try new API without token
      const newResponse = await fetch(`${NEW_API_URL}/api/latest`);

      // Both should return 401
      expect(oldResponse.status).toBe(401);
      expect(newResponse.status).toBe(401);
    });
  });
});

describe('GET /api/devices/:id/latest - Compatibility', () => {
  let oldToken: string;
  let newToken: string;

  beforeAll(async () => {
    await verifyServersRunning();
    const tokens = await getAuthTokens();
    oldToken = tokens.oldToken;
    newToken = tokens.newToken;
  });

  describe('Get Single Device Latest Reading', () => {
    it('should return identical latest reading for specific device', async () => {
      const deviceId = 'device-001';

      // Get from old API
      const oldResponse = await fetch(`${OLD_API_URL}/api/devices/${deviceId}/latest-readings`, {
        headers: { 'Authorization': oldToken },
      });

      // Get from new API
      const newResponse = await fetch(`${NEW_API_URL}/api/devices/${deviceId}/latest`, {
        headers: { 'Authorization': `Bearer ${newToken}` },
      });

      // Both should return 200
      expect(oldResponse.status).toBe(200);
      expect(newResponse.status).toBe(200);

      // Compare responses
      const oldData = await oldResponse.json() as LatestDevice;
      const newData = await newResponse.json() as LatestDevice;

      // Check device properties match
      expect(oldData.id).toBe(newData.id);
      expect(oldData.name).toBe(newData.name);

      // Check reading exists and values match
      expect(oldData.reading).not.toBeNull();
      expect(newData.reading).not.toBeNull();

      if (oldData.reading && newData.reading) {
        expect(compareNumbers(oldData.reading.temperature, newData.reading.temperature)).toBe(true);
        expect(compareNumbers(oldData.reading.humidity, newData.reading.humidity)).toBe(true);
        expect(compareNumbers(oldData.reading.pressure, newData.reading.pressure)).toBe(true);
        expect(compareNumbers(oldData.reading.battery, newData.reading.battery)).toBe(true);
      }
    });

    it('should return 404 for non-existent device', async () => {
      const deviceId = 'non-existent-device';

      // Try old API
      const oldResponse = await fetch(`${OLD_API_URL}/api/devices/${deviceId}/latest-readings`, {
        headers: { 'Authorization': oldToken },
      });

      // Try new API
      const newResponse = await fetch(`${NEW_API_URL}/api/devices/${deviceId}/latest`, {
        headers: { 'Authorization': `Bearer ${newToken}` },
      });

      // Both should return 404
      expect(oldResponse.status).toBe(404);
      expect(newResponse.status).toBe(404);
    });

    it('should return 404 for disabled device', async () => {
      const deviceId = 'device-003'; // This device is disabled in seed data

      // Try old API
      const oldResponse = await fetch(`${OLD_API_URL}/api/devices/${deviceId}/latest-readings`, {
        headers: { 'Authorization': oldToken },
      });

      // Try new API
      const newResponse = await fetch(`${NEW_API_URL}/api/devices/${deviceId}/latest`, {
        headers: { 'Authorization': `Bearer ${newToken}` },
      });

      // Both should return 404 (treating disabled as not found)
      expect(oldResponse.status).toBe(404);
      expect(newResponse.status).toBe(404);
    });
  });

  describe('Authentication', () => {
    it('should return 401 without authentication', async () => {
      const deviceId = 'device-001';

      // Try old API without token
      const oldResponse = await fetch(`${OLD_API_URL}/api/devices/${deviceId}/latest-readings`);

      // Try new API without token
      const newResponse = await fetch(`${NEW_API_URL}/api/devices/${deviceId}/latest`);

      // Both should return 401
      expect(oldResponse.status).toBe(401);
      expect(newResponse.status).toBe(401);
    });
  });
});
