/**
 * Integration tests for GET /api/devices/:id/readings
 * Tests aggregated readings for a specific device
 */

import { getApiUrl } from './utils/test-config';
import { getAuthHeaders, RequestHeaders } from './utils/auth-utils';
import { generateTestDeviceId, deleteTestDevices, createTestDeviceWithReadings } from '../utils/device-helpers';
import { getTestDateRanges } from '../utils/test-data';
import type { DeviceReadingsResponse } from './utils/types';

describe('GET /api/devices/:id/readings - Integration', () => {
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

  describe('Multiple Sensor Types', () => {
    it('should return readings for multiple sensor types', async () => {
      const baseDate = dateRanges.dayBeforeYesterday.start;
      const deviceId = await createTestDeviceWithReadings({
        deviceOrder: 9999,
        deviceName: 'Multi-Type Test Device',
        readings: [{
          temperature: 20.0,
          humidity: 50.0,
          pressure: 1013.0,
          timestamp: new Date(new Date(baseDate).setUTCHours(12, 0, 0, 0)).toISOString(),
        }],
        headers,
        createdDeviceIds,
      });

      // Query for all three types
      const types = 'temperature,humidity,pressure';
      const response = await fetch(
        `${API_URL}/api/devices/${deviceId}/readings?startTime=${dateRanges.dayBeforeYesterday.start.toISOString()}&endTime=${dateRanges.dayBeforeYesterday.end.toISOString()}&types=${types}&level=day`,
        { headers }
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as DeviceReadingsResponse;

      expect(data.id).toBe(deviceId);
      expect(data.values).toHaveLength(3); // 3 sensor types

      // Find each sensor type
      const tempReadings = data.values.find(v => v.type === 'temperature');
      const humidityReadings = data.values.find(v => v.type === 'humidity');
      const pressureReadings = data.values.find(v => v.type === 'pressure');

      expect(tempReadings).toBeDefined();
      expect(humidityReadings).toBeDefined();
      expect(pressureReadings).toBeDefined();

      // Verify values
      expect(tempReadings!.values[0].avg).toBe(20);
      expect(humidityReadings!.values[0].avg).toBe(50);
      expect(pressureReadings!.values[0].avg).toBe(1013);
    });

    it('should correctly aggregate multiple readings per sensor type', async () => {
      const baseDate = dateRanges.dayBeforeYesterday.start;
      const deviceId = await createTestDeviceWithReadings({
        deviceOrder: 9998,
        deviceName: 'Aggregation Test Device',
        readings: [
          { temperature: 10, humidity: 40, timestamp: new Date(new Date(baseDate).setUTCHours(12, 0, 0, 0)).toISOString() },
          { temperature: 20, humidity: 50, timestamp: new Date(new Date(baseDate).setUTCHours(12, 10, 0, 0)).toISOString() },
          { temperature: 30, humidity: 60, timestamp: new Date(new Date(baseDate).setUTCHours(12, 20, 0, 0)).toISOString() },
        ],
        headers,
        createdDeviceIds,
      });

      const types = 'temperature,humidity';
      const response = await fetch(
        `${API_URL}/api/devices/${deviceId}/readings?startTime=${dateRanges.dayBeforeYesterday.start.toISOString()}&endTime=${dateRanges.dayBeforeYesterday.end.toISOString()}&types=${types}&level=${encodeURIComponent('30 minutes')}`,
        { headers }
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as DeviceReadingsResponse;

      const tempReadings = data.values.find(v => v.type === 'temperature');
      const humidityReadings = data.values.find(v => v.type === 'humidity');

      // Temperature: (10 + 20 + 30) / 3 = 20
      expect(tempReadings!.values[0].avg).toBe(20);
      expect(tempReadings!.values[0].min).toBe(10);
      expect(tempReadings!.values[0].max).toBe(30);

      // Humidity: (40 + 50 + 60) / 3 = 50
      expect(humidityReadings!.values[0].avg).toBe(50);
      expect(humidityReadings!.values[0].min).toBe(40);
      expect(humidityReadings!.values[0].max).toBe(60);
    });

    it('should return sparse rollup data without inventing buckets for missing sensor fields', async () => {
      const baseDate = dateRanges.dayBeforeYesterday.start;
      const deviceId = await createTestDeviceWithReadings({
        deviceOrder: 9997,
        deviceName: 'Sparse Rollup Test Device',
        readings: [
          {
            temperature: 20,
            humidity: 40,
            timestamp: new Date(new Date(baseDate).setUTCHours(12, 0, 0, 0)).toISOString(),
          },
          {
            temperature: 24,
            timestamp: new Date(new Date(baseDate).setUTCHours(12, 10, 0, 0)).toISOString(),
          },
        ],
        headers,
        createdDeviceIds,
      });

      const response = await fetch(
        `${API_URL}/api/devices/${deviceId}/readings?startTime=${dateRanges.dayBeforeYesterday.start.toISOString()}&endTime=${dateRanges.dayBeforeYesterday.end.toISOString()}&types=temperature,humidity,pressure&level=${encodeURIComponent('30 minutes')}`,
        { headers }
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as DeviceReadingsResponse;
      const temperatureReadings = data.values.find((value) => value.type === 'temperature');
      const humidityReadings = data.values.find((value) => value.type === 'humidity');
      const pressureReadings = data.values.find((value) => value.type === 'pressure');

      expect(temperatureReadings).toBeDefined();
      expect(humidityReadings).toBeDefined();
      expect(pressureReadings).toBeDefined();

      expect(temperatureReadings!.values).toEqual([
        expect.objectContaining({
          avg: 22,
          min: 20,
          max: 24,
        }),
      ]);
      expect(humidityReadings!.values).toEqual([
        expect.objectContaining({
          avg: 40,
          min: 40,
          max: 40,
        }),
      ]);
      expect(pressureReadings!.values).toEqual([]);
    });
  });

  describe('Time Bucketing', () => {
    it('should correctly bucket readings by day', async () => {
      const day1 = dateRanges.dayBeforeYesterday.start;
      const day2 = dateRanges.yesterday.start;
      const deviceId = await createTestDeviceWithReadings({
        deviceOrder: 9997,
        deviceName: 'Day Bucket Device',
        readings: [
          { temperature: 15.0, timestamp: new Date(new Date(day1).setUTCHours(12, 0, 0, 0)).toISOString() },
          { temperature: 25.0, timestamp: new Date(new Date(day2).setUTCHours(12, 0, 0, 0)).toISOString() },
        ],
        headers,
        createdDeviceIds,
      });

      const startTime = dateRanges.dayBeforeYesterday.start.toISOString();
      const endTime = dateRanges.yesterday.end.toISOString();

      const response = await fetch(
        `${API_URL}/api/devices/${deviceId}/readings?startTime=${startTime}&endTime=${endTime}&types=temperature&level=day`,
        { headers }
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as DeviceReadingsResponse;

      const tempReadings = data.values.find(v => v.type === 'temperature');
      expect(tempReadings).toBeDefined();
      expect(tempReadings!.values).toHaveLength(2); // 2 day buckets

      // Sort by time
      const buckets = tempReadings!.values.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      expect(buckets[0].avg).toBe(15);
      expect(buckets[1].avg).toBe(25);
    });
  });

  describe('Integration with Seed Data', () => {
    it('should return readings for device-001 with yesterday data', async () => {
      const deviceId = 'device-001';

      const response = await fetch(
        `${API_URL}/api/devices/${deviceId}/readings?startTime=${dateRanges.yesterday.start.toISOString()}&endTime=${dateRanges.yesterday.end.toISOString()}&types=temperature,humidity&level=day`,
        { headers }
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as DeviceReadingsResponse;

      expect(data.id).toBe(deviceId);
      expect(data.values.length).toBeGreaterThan(0);

      // Verify structure
      data.values.forEach((typeReadings) => {
        expect(typeReadings).toHaveProperty('type');
        expect(typeReadings).toHaveProperty('values');

        // Verify mathematical correctness
        typeReadings.values.forEach((reading) => {
          expect(reading.min).toBeLessThanOrEqual(reading.avg);
          expect(reading.avg).toBeLessThanOrEqual(reading.max);
        });
      });
    });
  });

  describe('Validation', () => {
    it('should return 404 for non-existent device', async () => {
      const response = await fetch(
        `${API_URL}/api/devices/nonexistent/readings?startTime=${dateRanges.yesterday.start.toISOString()}&endTime=${dateRanges.yesterday.end.toISOString()}&types=temperature&level=day`,
        { headers }
      );

      expect(response.status).toBe(404);
    });

    it('should return 404 for disabled device', async () => {
      const response = await fetch(
        `${API_URL}/api/devices/device-003/readings?startTime=${dateRanges.yesterday.start.toISOString()}&endTime=${dateRanges.yesterday.end.toISOString()}&types=temperature&level=day`,
        { headers }
      );

      expect(response.status).toBe(404);
    });

    it('should return 400 for missing startTime', async () => {
      const response = await fetch(
        `${API_URL}/api/devices/device-001/readings?endTime=${dateRanges.yesterday.end.toISOString()}&types=temperature&level=day`,
        { headers }
      );

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing endTime', async () => {
      const response = await fetch(
        `${API_URL}/api/devices/device-001/readings?startTime=${dateRanges.yesterday.start.toISOString()}&types=temperature&level=day`,
        { headers }
      );

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing types', async () => {
      const response = await fetch(
        `${API_URL}/api/devices/device-001/readings?startTime=${dateRanges.yesterday.start.toISOString()}&endTime=${dateRanges.yesterday.end.toISOString()}&level=day`,
        { headers }
      );

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing level', async () => {
      const response = await fetch(
        `${API_URL}/api/devices/device-001/readings?startTime=${dateRanges.yesterday.start.toISOString()}&endTime=${dateRanges.yesterday.end.toISOString()}&types=temperature`,
        { headers }
      );

      expect(response.status).toBe(400);
    });

    it('should return 400 when startTime > endTime', async () => {
      const response = await fetch(
        `${API_URL}/api/devices/device-001/readings?startTime=2026-02-12T10:00:00.000Z&endTime=2026-02-09T00:00:00.000Z&types=temperature&level=day`,
        { headers }
      );

      expect(response.status).toBe(400);
    });
  });

  describe('Authentication', () => {
    it('should return 401 without auth token', async () => {
      const response = await fetch(
        `${API_URL}/api/devices/device-001/readings?startTime=${dateRanges.yesterday.start.toISOString()}&endTime=${dateRanges.yesterday.end.toISOString()}&types=temperature&level=day`
      );

      expect(response.status).toBe(401);
    });
  });
});
