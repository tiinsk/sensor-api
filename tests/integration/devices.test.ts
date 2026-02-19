/**
 * Integration tests for GET /api/devices endpoints
 * Tests new API against known seed data
 */

import { getApiUrl } from './test-config';
import { getAuthHeaders, RequestHeaders } from './auth-utils';

interface Device {
  id: string;
  name: string;
  location: {
    x: number;
    y: number;
    type: 'inside' | 'outside' | null;
  };
  disabled: boolean;
  order: number;
  type: 'ruuvi' | 'sensorbug';
}

interface DeviceListResponse {
  count: number;
  totCount: number;
  limit: number;
  values: Device[];
}

describe('GET /api/devices - Integration', () => {
  const API_URL = getApiUrl();
  let headers: RequestHeaders;

  beforeAll(async () => {
    headers = await getAuthHeaders();
  });

  describe('GET /api/devices', () => {
    it('should return all enabled devices by default', async () => {
      const response = await fetch(`${API_URL}/api/devices`, {
        headers,
      });

      expect(response.status).toBe(200);

      const data = (await response.json()) as DeviceListResponse;

      // Should return 2 enabled devices (device-003 is disabled)
      expect(data.count).toBe(2);
      expect(data.totCount).toBe(2);
      expect(data.values).toHaveLength(2);

      // Verify devices are sorted by order
      expect(data.values[0].id).toBe('device-001');
      expect(data.values[0].order).toBe(1);
      expect(data.values[1].id).toBe('device-002');
      expect(data.values[1].order).toBe(2);
    });

    it('should return all devices when includeDisabled=true', async () => {
      const response = await fetch(`${API_URL}/api/devices?includeDisabled=true`, {
        headers,
      });

      expect(response.status).toBe(200);

      const data = (await response.json()) as DeviceListResponse;

      // Should return all 3 devices
      expect(data.count).toBe(3);
      expect(data.totCount).toBe(3);
      expect(data.values).toHaveLength(3);

      // Verify device-003 is included and marked as disabled
      const device003 = data.values.find((d) => d.id === 'device-003');
      expect(device003).toBeDefined();
      expect(device003?.disabled).toBe(true);
    });

    it('should support pagination with limit', async () => {
      const response = await fetch(`${API_URL}/api/devices?limit=1`, {
        headers,
      });

      expect(response.status).toBe(200);

      const data = (await response.json()) as DeviceListResponse;

      expect(data.count).toBe(1);
      expect(data.totCount).toBe(2); // Total enabled devices
      expect(data.limit).toBe(1);
      expect(data.values).toHaveLength(1);
      expect(data.values[0].id).toBe('device-001');
    });

    it('should support pagination with offset', async () => {
      const response = await fetch(`${API_URL}/api/devices?limit=10&offset=1`, {
        headers,
      });

      expect(response.status).toBe(200);

      const data = (await response.json()) as DeviceListResponse;

      // Should return 1 device (device-002, skipping device-001)
      expect(data.count).toBe(1);
      expect(data.totCount).toBe(2);
      expect(data.values).toHaveLength(1);
      expect(data.values[0].id).toBe('device-002');
    });

    describe('Pagination boundaries', () => {
      it('offset > totalCount returns 200 with empty values array (not error)', async () => {
        // Seed has 2 enabled devices; offset 10 is beyond total
        const response = await fetch(`${API_URL}/api/devices?limit=10&offset=10`, {
          headers,
        });

        expect(response.status).toBe(200);

        const data = (await response.json()) as DeviceListResponse;
        expect(data.values).toEqual([]);
        expect(data.count).toBe(0);
        expect(data.totCount).toBe(2);
        expect(data.limit).toBe(10);
      });

      it('negative offset returns 400', async () => {
        const response = await fetch(`${API_URL}/api/devices?limit=10&offset=-1`, {
          headers,
        });

        expect(response.status).toBe(400);
      });

      it('negative limit returns 400', async () => {
        const response = await fetch(`${API_URL}/api/devices?limit=-1&offset=0`, {
          headers,
        });

        expect(response.status).toBe(400);
      });

      it('limit > 100 returns 400 (API max limit is 100)', async () => {
        const response = await fetch(`${API_URL}/api/devices?limit=101&offset=0`, {
          headers,
        });

        expect(response.status).toBe(400);
      });
    });

    it('should return 401 without auth token', async () => {
      const response = await fetch(`${API_URL}/api/devices`);

      expect(response.status).toBe(401);

      const data = (await response.json()) as { error: string };
      expect(data).toHaveProperty('error');
    });

    it('should verify device properties match seed data', async () => {
      const response = await fetch(`${API_URL}/api/devices`, {
        headers,
      });

      const data = (await response.json()) as DeviceListResponse;

      // Verify device-001 properties (Living Room Sensor)
      const device001 = data.values.find((d) => d.id === 'device-001');
      expect(device001).toEqual({
        id: 'device-001',
        name: 'Living Room Sensor',
        location: {
          x: 100,
          y: 200,
          type: 'inside',
        },
        type: 'ruuvi',
        disabled: false,
        order: 1,
      });

      // Verify device-002 properties (Balcony Sensor)
      const device002 = data.values.find((d) => d.id === 'device-002');
      expect(device002).toEqual({
        id: 'device-002',
        name: 'Balcony Sensor',
        location: {
          x: 300,
          y: 50,
          type: 'outside',
        },
        type: 'ruuvi',
        disabled: false,
        order: 2,
      });
    });
  });

  describe('GET /api/devices/:id', () => {
    it('should return specific device by id', async () => {
      const response = await fetch(`${API_URL}/api/devices/device-001`, {
        headers,
      });

      expect(response.status).toBe(200);

      const device = (await response.json()) as Device;

      expect(device.id).toBe('device-001');
      expect(device.name).toBe('Living Room Sensor');
      expect(device.location).toEqual({
        x: 100,
        y: 200,
        type: 'inside',
      });
      expect(device.type).toBe('ruuvi');
      expect(device.disabled).toBe(false);
      expect(device.order).toBe(1);
    });

    it('should return 404 for non-existent device', async () => {
      const response = await fetch(`${API_URL}/api/devices/nonexistent`, {
        headers,
      });

      expect(response.status).toBe(404);

      const data = (await response.json()) as { error: string };
      expect(data).toHaveProperty('error');
    });

    it('should return 404 for disabled device by default', async () => {
      const response = await fetch(`${API_URL}/api/devices/device-003`, {
        headers,
      });

      expect(response.status).toBe(404);
    });
  });
});
