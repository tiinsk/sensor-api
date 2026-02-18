/**
 * Integration tests for POST /api/devices/:id/readings
 * Tests adding readings to devices
 */

import { getApiUrl } from './test-config';
import { getAuthHeaders, RequestHeaders } from './auth-utils';
import { generateTestDeviceId, deleteTestDevices } from '../utils/device-helpers';
import { getTestDateRanges } from '../utils/test-data';

interface Reading {
  deviceId: string;
  timestamp: string;
  temperature?: number;
  humidity?: number;
  pressure?: number;
  battery?: number;
}

describe('POST /api/devices/:id/readings - Integration', () => {
  const API_URL = getApiUrl();
  let headers: RequestHeaders;
  const createdDeviceIds: string[] = [];
  const dateRanges = getTestDateRanges();

  beforeAll(async () => {
    headers = await getAuthHeaders();
  });

  afterEach(async () => {
    await deleteTestDevices(createdDeviceIds, headers);
    createdDeviceIds.length = 0;
  });

  describe('Timestamp Validation', () => {
    it('should reject timestamp in the future', async () => {
      const deviceId = generateTestDeviceId();

      await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: deviceId,
          name: 'Future Test Device',
          location: { x: 0, y: 0, type: null },
          type: 'ruuvi',
          disabled: false,
          order: 9999,
        }),
      });

      createdDeviceIds.push(deviceId);

      // Try to add reading with future timestamp (tomorrow)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await fetch(`${API_URL}/api/devices/${deviceId}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          temperature: 20.0,
          timestamp: tomorrow.toISOString()
        }),
      });

      expect(response.status).toBe(400);
      const error = await response.json() as { error: string };
      expect(error.error).toBe('Invalid request');
    });

    it('should accept reading without timestamp (uses current time)', async () => {
      const deviceId = generateTestDeviceId();

      await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: deviceId,
          name: 'Auto Timestamp Device',
          location: { x: 0, y: 0, type: null },
          type: 'ruuvi',
          disabled: false,
          order: 9998,
        }),
      });

      createdDeviceIds.push(deviceId);

      const response = await fetch(`${API_URL}/api/devices/${deviceId}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          temperature: 22.5,
          humidity: 55.0
        }),
      });

      expect(response.status).toBe(201);
      const reading = (await response.json()) as Reading;
      expect(reading.temperature).toBe(22.5);
      expect(reading.humidity).toBe(55);
      expect(reading.timestamp).toBeDefined();
    });

    it('should accept reading with past timestamp', async () => {
      const deviceId = generateTestDeviceId();

      await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: deviceId,
          name: 'Past Timestamp Device',
          location: { x: 0, y: 0, type: null },
          type: 'ruuvi',
          disabled: false,
          order: 9997,
        }),
      });

      createdDeviceIds.push(deviceId);

      const pastTimestamp = new Date(new Date(dateRanges.yesterday.start).setUTCHours(12, 0, 0, 0)).toISOString();

      const response = await fetch(`${API_URL}/api/devices/${deviceId}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          temperature: 18.0,
          humidity: 60.0,
          timestamp: pastTimestamp
        }),
      });

      expect(response.status).toBe(201);
      const reading = (await response.json()) as Reading;
      expect(reading.temperature).toBe(18);
      expect(reading.timestamp).toBe(pastTimestamp);
    });
  });

  describe('Authentication', () => {
    it('should return 401 without auth token', async () => {
      const response = await fetch(`${API_URL}/api/devices/device-001/readings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          temperature: 20.0
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Device Validation', () => {
    it('should return 404 for non-existent device', async () => {
      const response = await fetch(`${API_URL}/api/devices/nonexistent/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          temperature: 20.0
        }),
      });

      expect(response.status).toBe(404);
    });

    it('should return 404 for disabled device', async () => {
      const response = await fetch(`${API_URL}/api/devices/device-003/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          temperature: 20.0
        }),
      });

      expect(response.status).toBe(404);
    });
  });
});
