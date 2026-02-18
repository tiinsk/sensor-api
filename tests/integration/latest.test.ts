/**
 * Integration tests for latest readings endpoints
 * GET /api/latest and GET /api/devices/:id/latest
 */

import { getApiUrl } from './test-config';
import { getAuthHeaders, RequestHeaders } from './auth-utils';
import { generateTestDeviceId, deleteTestDevices } from '../utils/device-helpers';

interface Reading {
  timestamp: string;
  battery: number | null;
  humidity: number | null;
  pressure: number | null;
  temperature: number | null;
}

interface LatestDevice {
  id: string;
  name: string;
  order: number;
  reading: Reading | null;
}

interface LatestReadingsResponse {
  count: number;
  totCount: number;
  limit: number;
  values: LatestDevice[];
}

describe('Latest Readings - Integration', () => {
  const API_URL = getApiUrl();
  let headers: RequestHeaders;
  const createdDeviceIds: string[] = [];

  beforeAll(async () => {
    headers = await getAuthHeaders();
  });

  afterEach(async () => {
    await deleteTestDevices(createdDeviceIds, headers);
    createdDeviceIds.length = 0;
  });

  describe('GET /api/latest', () => {
    it('should return latest readings for all enabled devices', async () => {
      const response = await fetch(`${API_URL}/api/latest`, {
        headers,
      });

      expect(response.status).toBe(200);

      const data = (await response.json()) as LatestReadingsResponse;

      // Should return latest for 2 enabled devices (device-003 is disabled)
      expect(data.count).toBe(2);
      expect(data.values).toHaveLength(2);

      // Verify device-001 latest reading
      const device001Latest = data.values.find((r) => r.id === 'device-001');
      expect(device001Latest).toBeDefined();
      expect(device001Latest?.name).toBe('Living Room Sensor');
      expect(device001Latest?.reading?.temperature).not.toBeNull();
      expect(device001Latest?.reading?.humidity).not.toBeNull();
      expect(device001Latest?.reading?.timestamp).toBeDefined();

      // Verify device-002 latest reading
      const device002Latest = data.values.find((r) => r.id === 'device-002');
      expect(device002Latest).toBeDefined();
      expect(device002Latest?.name).toBe('Balcony Sensor');
      expect(device002Latest?.reading?.temperature).not.toBeNull();
      expect(device002Latest?.reading?.humidity).not.toBeNull();
    });

    it('should support pagination with limit', async () => {
      const response = await fetch(`${API_URL}/api/latest?limit=1`, {
        headers,
      });

      expect(response.status).toBe(200);

      const data = (await response.json()) as LatestReadingsResponse;

      expect(data.count).toBe(1);
      expect(data.values).toHaveLength(1);
    });

    it('should support pagination with offset', async () => {
      // Get first device
      const firstResponse = await fetch(`${API_URL}/api/latest?limit=1&offset=0`, {
        headers,
      });
      const firstData = (await firstResponse.json()) as LatestReadingsResponse;

      // Get second device
      const secondResponse = await fetch(`${API_URL}/api/latest?limit=1&offset=1`, {
        headers,
      });
      const secondData = (await secondResponse.json()) as LatestReadingsResponse;

      // Devices should be different
      expect(firstData.values[0].id).not.toBe(secondData.values[0].id);
    });

    it('should order devices by device order field', async () => {
      const response = await fetch(`${API_URL}/api/latest`, {
        headers,
      });

      const data = (await response.json()) as LatestReadingsResponse;

      // Should return devices in order: device-001 (order 1), device-002 (order 2)
      expect(data.values[0].id).toBe('device-001');
      expect(data.values[1].id).toBe('device-002');
    });

    it('should return valid timestamp format', async () => {
      const response = await fetch(`${API_URL}/api/latest`, {
        headers,
      });

      const data = (await response.json()) as LatestReadingsResponse;

      data.values.forEach((value) => {
        // Verify ISO 8601 timestamp
        expect(value.reading?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

        // Verify parseable as date
        const date = new Date(value.reading?.timestamp || '');
        expect(date.toString()).not.toBe('Invalid Date');
      });
    });

    it('should return 401 without auth token', async () => {
      const response = await fetch(`${API_URL}/api/latest`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/devices/:id/latest', () => {
    it('should return latest reading for specific device', async () => {
      const response = await fetch(`${API_URL}/api/devices/device-001/latest`, {
        headers,
      });

      expect(response.status).toBe(200);

      const device = (await response.json()) as LatestDevice;

      expect(device.id).toBe('device-001');
      expect(device.name).toBe('Living Room Sensor');
      expect(device.reading?.temperature).not.toBeNull();
      expect(device.reading?.humidity).not.toBeNull();
      expect(typeof device.reading?.temperature).toBe('number');
      expect(typeof device.reading?.humidity).toBe('number');
      expect(device.reading?.timestamp).toBeDefined();
    });

    it('should return device without readings', async () => {
      // Create a device without readings
      const testDeviceId = generateTestDeviceId();

      await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: testDeviceId,
          name: 'Empty Device',
          location: { x: 0, y: 0, type: null },
          type: 'ruuvi',
          disabled: false,
          order: 999,
        }),
      });

      createdDeviceIds.push(testDeviceId);

      const response = await fetch(`${API_URL}/api/devices/${testDeviceId}/latest`, {
        headers,
      });

      expect(response.status).toBe(200);

      const device = (await response.json()) as LatestDevice;

      expect(device.id).toBe(testDeviceId);
      expect(device.name).toBe('Empty Device');
      expect(device.reading?.temperature).toBeUndefined();
      expect(device.reading?.humidity).toBeUndefined();
      expect(device.reading?.timestamp).toBeUndefined();
    });

    it('should return 404 for non-existent device', async () => {
      const response = await fetch(`${API_URL}/api/devices/nonexistent/latest`, {
        headers,
      });

      expect(response.status).toBe(404);
    });

    it('should return 404 for disabled device', async () => {
      const response = await fetch(`${API_URL}/api/devices/device-003/latest`, {
        headers,
      });

      expect(response.status).toBe(404);
    });

    it('should return 401 without auth token', async () => {
      const response = await fetch(`${API_URL}/api/devices/device-001/latest`);

      expect(response.status).toBe(401);
    });
  });

  describe('Latest reading accuracy', () => {
    let testDeviceId: string;

    beforeEach(async () => {
      // Create test device
      testDeviceId = generateTestDeviceId();

      await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: testDeviceId,
          name: 'Test Latest Device',
          location: { x: 0, y: 0, type: null },
          type: 'ruuvi',
          disabled: false,
          order: 998,
        }),
      });

      createdDeviceIds.push(testDeviceId);
    });

    it('should update after new reading is added', async () => {
      // Add first reading
      await fetch(`${API_URL}/api/devices/${testDeviceId}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          temperature: 18.0,
          humidity: 35.0,
        }),
      });

      // Get first latest
      const firstResponse = await fetch(`${API_URL}/api/devices/${testDeviceId}/latest`, {
        headers,
      });
      const firstDevice = (await firstResponse.json()) as LatestDevice;

      expect(firstDevice.reading?.temperature).toBe(18.0);
      expect(firstDevice.reading?.humidity).toBe(35.0);

      // Wait and add new reading
      await new Promise((resolve) => setTimeout(resolve, 100));

      await fetch(`${API_URL}/api/devices/${testDeviceId}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          temperature: 22.0,
          humidity: 50.0,
        }),
      });

      // Get updated latest
      const secondResponse = await fetch(`${API_URL}/api/devices/${testDeviceId}/latest`, {
        headers,
      });
      const secondDevice = (await secondResponse.json()) as LatestDevice;

      // Should return the new reading
      expect(secondDevice.reading?.temperature).toBe(22.0);
      expect(secondDevice.reading?.humidity).toBe(50.0);
      expect(secondDevice.reading?.timestamp).not.toBe(firstDevice.reading?.timestamp);
    });

    it('should appear in GET /api/latest after adding reading', async () => {
      // Add reading
      await fetch(`${API_URL}/api/devices/${testDeviceId}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          temperature: 21.0,
          humidity: 45.0,
        }),
      });

      // Get all latest readings
      const response = await fetch(`${API_URL}/api/latest`, {
        headers,
      });

      const data = (await response.json()) as LatestReadingsResponse;

      const deviceReading = data.values.find((r) => r.id === testDeviceId);
      expect(deviceReading).toBeDefined();
      expect(deviceReading?.reading?.temperature).toBe(21.0);
      expect(deviceReading?.reading?.humidity).toBe(45.0);
    });
  });
});
