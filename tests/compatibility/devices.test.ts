/**
 * Compatibility Tests: Device Endpoints
 *
 * Compare device endpoints behavior between old and new APIs
 */

import { OLD_API_URL, NEW_API_URL, verifyServersRunning } from '../utils/test-server';
import { getAuthHeaders, ApiAuthHeaders } from './auth-utils';
import { compareDevices } from './comparison-utils';

// Response type definitions

interface Device {
  id: string;
  name: string;
  type: 'ruuvi' | 'sensorbug';
  order: number;
  disabled: boolean;
  location: {
    x: number;
    y: number;
    type: 'inside' | 'outside' | null;
  };
}

interface DeviceListResponse {
  count: number;
  totCount: number;
  limit: number;
  values: Device[];
}


describe('GET /api/devices - Compatibility', () => {
  let auth: ApiAuthHeaders;

  beforeAll(async () => {
    await verifyServersRunning();
    auth = await getAuthHeaders();
  });

  describe('Get All Devices (default parameters)', () => {
    it('should return identical device lists from both APIs', async () => {
      // Get devices from old API
      const oldResponse = await fetch(`${OLD_API_URL}/api/devices`, {
        headers: auth.oldHeaders,
      });

      // Get devices from new API
      const newResponse = await fetch(`${NEW_API_URL}/api/devices`, {
        headers: auth.newHeaders,
      });

      // Both should return 200
      expect(oldResponse.status).toBe(200);
      expect(newResponse.status).toBe(200);

      // Compare responses
      const oldData = await oldResponse.json() as DeviceListResponse;
      const newData = await newResponse.json() as DeviceListResponse;

      const comparison = compareDevices(oldData, newData);
      if (!comparison.matches) {
        console.error('Device comparison failed:', comparison.differences);
      }
      expect(comparison.matches).toBe(true);

      // Should return only enabled devices (not disabled)
      expect(newData.values.every(d => !d.disabled)).toBe(true);
    });
  });

  describe('Get All Devices with includeDisabled=true', () => {
    it('should return all devices including disabled ones', async () => {
      // Get devices from old API
      const oldResponse = await fetch(`${OLD_API_URL}/api/devices?includeDisabled=true`, {
        headers: auth.oldHeaders,
      });

      // Get devices from new API
      const newResponse = await fetch(`${NEW_API_URL}/api/devices?includeDisabled=true`, {
        headers: auth.newHeaders,
      });

      // Both should return 200
      expect(oldResponse.status).toBe(200);
      expect(newResponse.status).toBe(200);

      // Compare responses
      const oldData = await oldResponse.json() as DeviceListResponse;
      const newData = await newResponse.json() as DeviceListResponse;

      const comparison = compareDevices(oldData, newData);
      if (!comparison.matches) {
        console.error('Device comparison failed:', comparison.differences);
      }
      expect(comparison.matches).toBe(true);

      // Should include at least one disabled device (device-003 from seed)
      const hasDisabled = newData.values.some(d => d.disabled);
      expect(hasDisabled).toBe(true);
    });
  });

  describe('Pagination with limit and offset', () => {
    it('should respect limit parameter', async () => {
      // Get devices with limit=1 from old API
      const oldResponse = await fetch(`${OLD_API_URL}/api/devices?limit=1&includeDisabled=true`, {
        headers: auth.oldHeaders,
      });

      // Get devices with limit=1 from new API
      const newResponse = await fetch(`${NEW_API_URL}/api/devices?limit=1&includeDisabled=true`, {
        headers: auth.newHeaders,
      });

      // Both should return 200
      expect(oldResponse.status).toBe(200);
      expect(newResponse.status).toBe(200);

      // Compare responses
      const oldData = await oldResponse.json() as DeviceListResponse;
      const newData = await newResponse.json() as DeviceListResponse;

      // Should return exactly 1 device
      expect(oldData.count).toBe(1);
      expect(newData.count).toBe(1);
      expect(oldData.values.length).toBe(1);
      expect(newData.values.length).toBe(1);

      // But totCount should be total number of devices
      expect(oldData.totCount).toBeGreaterThan(1);
      expect(newData.totCount).toBeGreaterThan(1);
    });

    it('should respect offset parameter', async () => {
      // Get first device (offset=0)
      const oldFirst = await fetch(`${OLD_API_URL}/api/devices?limit=1&offset=0&includeDisabled=true`, {
        headers: auth.oldHeaders,
      });
      const newFirst = await fetch(`${NEW_API_URL}/api/devices?limit=1&offset=0&includeDisabled=true`, {
        headers: auth.newHeaders,
      });

      const oldFirstData = await oldFirst.json() as DeviceListResponse;
      const newFirstData = await newFirst.json() as DeviceListResponse;

      // Get second device (offset=1)
      const oldSecond = await fetch(`${OLD_API_URL}/api/devices?limit=1&offset=1&includeDisabled=true`, {
        headers: auth.oldHeaders,
      });
      const newSecond = await fetch(`${NEW_API_URL}/api/devices?limit=1&offset=1&includeDisabled=true`, {
        headers: auth.newHeaders,
      });

      const oldSecondData = await oldSecond.json() as DeviceListResponse;
      const newSecondData = await newSecond.json() as DeviceListResponse;

      // Devices should be different
      expect(oldFirstData.values[0].id).not.toBe(oldSecondData.values[0].id);
      expect(newFirstData.values[0].id).not.toBe(newSecondData.values[0].id);

      // Both APIs should return same devices in same order
      expect(oldFirstData.values[0].id).toBe(newFirstData.values[0].id);
      expect(oldSecondData.values[0].id).toBe(newSecondData.values[0].id);
    });
  });

  describe('Device ordering', () => {
    it('should return devices in same order (sorted by order field)', async () => {
      // Get all devices
      const oldResponse = await fetch(`${OLD_API_URL}/api/devices?includeDisabled=true`, {
        headers: auth.oldHeaders,
      });
      const newResponse = await fetch(`${NEW_API_URL}/api/devices?includeDisabled=true`, {
        headers: auth.newHeaders,
      });

      const oldData = await oldResponse.json() as DeviceListResponse;
      const newData = await newResponse.json() as DeviceListResponse;

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
});

describe('GET /api/devices/:id - Compatibility', () => {
  let auth: ApiAuthHeaders;

  beforeAll(async () => {
    await verifyServersRunning();
    auth = await getAuthHeaders();

  });

  describe('Get Single Device', () => {
    it('should return identical device data for enabled device', async () => {
      const deviceId = 'device-001';

      // Get device from old API
      const oldResponse = await fetch(`${OLD_API_URL}/api/devices/${deviceId}`, {
        headers: auth.oldHeaders,
      });

      // Get device from new API
      const newResponse = await fetch(`${NEW_API_URL}/api/devices/${deviceId}`, {
        headers: auth.newHeaders,
      });

      // Both should return 200
      expect(oldResponse.status).toBe(200);
      expect(newResponse.status).toBe(200);

      // Compare responses
      const oldData = await oldResponse.json() as Device;
      const newData = await newResponse.json() as Device;

      // Check all fields match
      expect(oldData.id).toBe(newData.id);
      expect(oldData.name).toBe(newData.name);
      expect(oldData.type).toBe(newData.type);
      expect(oldData.order).toBe(newData.order);
      expect(oldData.disabled).toBe(newData.disabled);
      expect(oldData.location).toEqual(newData.location);
    });

    it('should return 404 for non-existent device', async () => {
      const deviceId = 'non-existent-device';

      // Try old API
      const oldResponse = await fetch(`${OLD_API_URL}/api/devices/${deviceId}`, {
        headers: auth.oldHeaders,
      });

      // Try new API
      const newResponse = await fetch(`${NEW_API_URL}/api/devices/${deviceId}`, {
        headers: auth.newHeaders,
      });

      // Both should return 404
      expect(oldResponse.status).toBe(404);
      expect(newResponse.status).toBe(404);
    });

    it('should return 404 for disabled device (without includeDisabled)', async () => {
      const deviceId = 'device-003'; // This device is disabled in seed data

      // Try old API
      const oldResponse = await fetch(`${OLD_API_URL}/api/devices/${deviceId}`, {
        headers: auth.oldHeaders,
      });

      // Try new API
      const newResponse = await fetch(`${NEW_API_URL}/api/devices/${deviceId}`, {
        headers: auth.newHeaders,
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
      const oldResponse = await fetch(`${OLD_API_URL}/api/devices/${deviceId}`);

      // Try new API without token
      const newResponse = await fetch(`${NEW_API_URL}/api/devices/${deviceId}`);

      // Both should return 401
      expect(oldResponse.status).toBe(401);
      expect(newResponse.status).toBe(401);
    });
  });
});
