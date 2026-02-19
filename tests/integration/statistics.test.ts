/**
 * Integration tests for GET /api/statistics
 * Tests aggregated statistics with focus on calculation correctness
 */

import { getApiUrl } from './test-config';
import { getAuthHeaders, RequestHeaders } from './auth-utils';
import { deleteTestDevices, createTestDeviceWithReadings } from '../utils/device-helpers';
import { getTestDateRanges } from '../utils/test-data';
import type {
  Statistics,
  DeviceStatistics,
  StatisticsResponse,
  SingleDeviceStatistics,
} from './types';

describe('GET /api/statistics - Integration', () => {
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

  describe('Calculation Correctness', () => {
    it('should calculate exact statistics for 3 readings', async () => {
      const deviceId = await createTestDeviceWithReadings({
        deviceOrder: 9990,
        deviceName: 'Calculation Test Device',
        readings: [
          { temperature: 10.0, humidity: 30.0, timestamp: new Date(new Date(dateRanges.dayBeforeYesterday.start).setUTCHours(12, 0, 0, 0)).toISOString() },
          { temperature: 20.0, humidity: 50.0, timestamp: new Date(new Date(dateRanges.dayBeforeYesterday.start).setUTCHours(12, 10, 0, 0)).toISOString() },
          { temperature: 30.0, humidity: 70.0, timestamp: new Date(new Date(dateRanges.dayBeforeYesterday.start).setUTCHours(12, 20, 0, 0)).toISOString() },
        ],
        headers,
        createdDeviceIds,
      });

      const response = await fetch(
        `${API_URL}/api/statistics?startTime=${dateRanges.dayBeforeYesterday.start.toISOString()}&endTime=${dateRanges.dayBeforeYesterday.end.toISOString()}`,
        { headers }
      );

      const data = (await response.json()) as StatisticsResponse;

      const deviceStats = data.values.find((s) => s.id === deviceId);
      expect(deviceStats).toBeDefined();

      // EXACT temperature calculations: (10 + 20 + 30) / 3 = 20
      expect(deviceStats!.statistics.temperature.min).toBe(10);
      expect(deviceStats!.statistics.temperature.max).toBe(30);
      expect(deviceStats!.statistics.temperature.avg).toBe(20);

      // EXACT humidity calculations: (30 + 50 + 70) / 3 = 50
      expect(deviceStats!.statistics.humidity.min).toBe(30);
      expect(deviceStats!.statistics.humidity.max).toBe(70);
      expect(deviceStats!.statistics.humidity.avg).toBe(50);
    });

    it('should calculate statistics for 1 reading (min=avg=max)', async () => {
      const deviceId = await createTestDeviceWithReadings({
        deviceOrder: 9989,
        deviceName: 'Single Reading Device',
        readings: [
          { temperature: 25.5, humidity: 45.5, timestamp: new Date(new Date(dateRanges.dayBeforeYesterday.start).setUTCHours(14, 0, 0, 0)).toISOString() },
        ],
        headers,
        createdDeviceIds,
      });

      const response = await fetch(
        `${API_URL}/api/statistics?startTime=${dateRanges.dayBeforeYesterday.start.toISOString()}&endTime=${dateRanges.dayBeforeYesterday.end.toISOString()}`,
        { headers }
      );

      const data = (await response.json()) as StatisticsResponse;
      const deviceStats = data.values.find((s) => s.id === deviceId);

      // For single reading: min = avg = max = value
      expect(deviceStats!.statistics.temperature.min).toBe(25.5);
      expect(deviceStats!.statistics.temperature.avg).toBe(25.5);
      expect(deviceStats!.statistics.temperature.max).toBe(25.5);
    });

    it('should handle negative temperatures correctly', async () => {
      const deviceId = await createTestDeviceWithReadings({
        deviceOrder: 9987,
        deviceName: 'Negative Temp Device',
        readings: [
          { temperature: -10, timestamp: new Date(new Date(dateRanges.dayBeforeYesterday.start).setUTCHours(16, 0, 0, 0)).toISOString() },
          { temperature: 0, timestamp: new Date(new Date(dateRanges.dayBeforeYesterday.start).setUTCHours(16, 10, 0, 0)).toISOString() },
          { temperature: 10, timestamp: new Date(new Date(dateRanges.dayBeforeYesterday.start).setUTCHours(16, 20, 0, 0)).toISOString() },
        ],
        headers,
        createdDeviceIds,
      });

      const response = await fetch(
        `${API_URL}/api/statistics?startTime=${dateRanges.dayBeforeYesterday.start.toISOString()}&endTime=${dateRanges.dayBeforeYesterday.end.toISOString()}`,
        { headers }
      );

      const data = (await response.json()) as StatisticsResponse;
      const deviceStats = data.values.find((s) => s.id === deviceId);

      // (-10 + 0 + 10) / 3 = 0
      expect(deviceStats!.statistics.temperature.min).toBe(-10);
      expect(deviceStats!.statistics.temperature.avg).toBe(0);
      expect(deviceStats!.statistics.temperature.max).toBe(10);
    });
  });

  describe('Device Isolation', () => {
    it('should calculate Device-1 stats independent of Device-2', async () => {
      const device1Id = await createTestDeviceWithReadings({
        deviceOrder: 9985,
        deviceName: 'Device 1',
        readings: [
          { temperature: 10.0, humidity: 30.0, timestamp: new Date(new Date(dateRanges.dayBeforeYesterday.start).setUTCHours(18, 0, 0, 0)).toISOString() },
        ],
        headers,
        createdDeviceIds,
      });

      const device2Id = await createTestDeviceWithReadings({
        deviceOrder: 9984,
        deviceName: 'Device 2',
        readings: [
          { temperature: 30.0, humidity: 70.0, timestamp: new Date(new Date(dateRanges.dayBeforeYesterday.start).setUTCHours(18, 10, 0, 0)).toISOString() },
        ],
        headers,
        createdDeviceIds,
      });

      const response = await fetch(
        `${API_URL}/api/statistics?startTime=${dateRanges.dayBeforeYesterday.start.toISOString()}&endTime=${dateRanges.dayBeforeYesterday.end.toISOString()}`,
        { headers }
      );

      const data = (await response.json()) as StatisticsResponse;

      const device1Stats = data.values.find((s) => s.id === device1Id);
      const device2Stats = data.values.find((s) => s.id === device2Id);

      // Device 1: EXACT values
      expect(device1Stats!.statistics.temperature.avg).toBe(10);
      expect(device1Stats!.statistics.temperature.min).toBe(10);
      expect(device1Stats!.statistics.temperature.max).toBe(10);
      expect(device1Stats!.statistics.humidity.avg).toBe(30);

      // Device 2: EXACT values
      expect(device2Stats!.statistics.temperature.avg).toBe(30);
      expect(device2Stats!.statistics.temperature.min).toBe(30);
      expect(device2Stats!.statistics.temperature.max).toBe(30);
      expect(device2Stats!.statistics.humidity.avg).toBe(70);

      // Verify they're completely independent
      expect(device1Stats!.statistics.temperature.avg).not.toBe(device2Stats!.statistics.temperature.avg);
    });
  });

  describe('Integration with Seed Data', () => {
    it('should return null values for future dates', async () => {
      const startTime = '2030-01-01T00:00:00.000Z';
      const endTime = '2030-01-02T00:00:00.000Z';

      const response = await fetch(
        `${API_URL}/api/statistics?startTime=${startTime}&endTime=${endTime}`,
        { headers }
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as StatisticsResponse;

      data.values.forEach((deviceStats) => {
        expect(deviceStats.statistics.temperature.avg).toBeNull();
        expect(deviceStats.statistics.humidity.avg).toBeNull();
        expect(deviceStats.statistics.pressure.avg).toBeNull();
      });
    });
  });

  describe('GET /api/devices/:id/statistics', () => {
    it('should return same statistics for yesterday reading in both yesterday and month queries', async () => {
      const deviceId = await createTestDeviceWithReadings({
        deviceOrder: 9983,
        deviceName: 'Time Range Test Device',
        readings: [
          { temperature: 18.5, humidity: 65.0, timestamp: new Date(new Date(dateRanges.yesterday.start).setUTCHours(12, 0, 0, 0)).toISOString() },
        ],
        headers,
        createdDeviceIds,
      });

      // Query for yesterday only
      const yesterdayResponse = await fetch(
        `${API_URL}/api/devices/${deviceId}/statistics?startTime=${dateRanges.yesterday.start.toISOString()}&endTime=${dateRanges.yesterday.end.toISOString()}`,
        { headers }
      );

      expect(yesterdayResponse.status).toBe(200);
      const yesterdayData = (await yesterdayResponse.json()) as SingleDeviceStatistics;

      // Query for current month (which includes yesterday)
      const monthResponse = await fetch(
        `${API_URL}/api/devices/${deviceId}/statistics?startTime=${dateRanges.currentMonth.start.toISOString()}&endTime=${dateRanges.currentMonth.end.toISOString()}`,
        { headers }
      );

      expect(monthResponse.status).toBe(200);
      const monthData = (await monthResponse.json()) as SingleDeviceStatistics;

      // Both should return the exact same statistics (same single reading)
      expect(yesterdayData.statistics.temperature.avg).toBe(18.5);
      expect(monthData.statistics.temperature.avg).toBe(18.5);
      expect(yesterdayData.statistics.temperature.min).toBe(18.5);
      expect(monthData.statistics.temperature.min).toBe(18.5);
      expect(yesterdayData.statistics.temperature.max).toBe(18.5);
      expect(monthData.statistics.temperature.max).toBe(18.5);

      expect(yesterdayData.statistics.humidity.avg).toBe(65);
      expect(monthData.statistics.humidity.avg).toBe(65);
    });

    it('should return 404 for non-existent device', async () => {
      const startTime = dateRanges.yesterday.start.toISOString();
      const endTime = dateRanges.yesterday.end.toISOString();

      const response = await fetch(
        `${API_URL}/api/devices/nonexistent/statistics?startTime=${startTime}&endTime=${endTime}`,
        { headers }
      );

      expect(response.status).toBe(404);
    });

    it('should return 400 for missing startTime', async () => {
      const endTime = dateRanges.yesterday.end.toISOString();

      const response = await fetch(
        `${API_URL}/api/statistics?endTime=${endTime}`,
        { headers }
      );

      expect(response.status).toBe(400);
    });

    it('should return 404 for disabled device (GET /api/devices/device-003/statistics)', async () => {
      const startTime = dateRanges.yesterday.start.toISOString();
      const endTime = dateRanges.yesterday.end.toISOString();

      const response = await fetch(
        `${API_URL}/api/devices/device-003/statistics?startTime=${startTime}&endTime=${endTime}`,
        { headers }
      );

      expect(response.status).toBe(404);
    });

    it('should return 400 for missing endTime', async () => {
      const startTime = dateRanges.yesterday.start.toISOString();

      const response = await fetch(
        `${API_URL}/api/statistics?startTime=${startTime}`,
        { headers }
      );

      expect(response.status).toBe(400);
    });

    it('should return 400 with invalid date format', async () => {
      const response = await fetch(
        `${API_URL}/api/statistics?startTime=invalid&endTime=2026-02-12T10:00:00.000Z`,
        { headers }
      );

      expect(response.status).toBe(400);
    });

    it('should return 400 when startTime > endTime', async () => {
      const response = await fetch(
        `${API_URL}/api/statistics?startTime=2026-02-12T10:00:00.000Z&endTime=2026-02-09T00:00:00.000Z`,
        { headers }
      );

      expect(response.status).toBe(400);
    });
  });

  describe('Pagination', () => {
    it('should support limit parameter', async () => {
      const startTime = dateRanges.yesterday.start.toISOString();
      const endTime = dateRanges.yesterday.end.toISOString();

      const response = await fetch(
        `${API_URL}/api/statistics?startTime=${startTime}&endTime=${endTime}&limit=1`,
        { headers }
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as StatisticsResponse;

      expect(data.count).toBe(1);
      expect(data.values).toHaveLength(1);
    });
  });

  describe('Authentication', () => {
    it('should return 401 without auth token', async () => {
      const startTime = dateRanges.yesterday.start.toISOString();
      const endTime = dateRanges.yesterday.end.toISOString();

      const response = await fetch(
        `${API_URL}/api/statistics?startTime=${startTime}&endTime=${endTime}`
      );

      expect(response.status).toBe(401);
    });
  });

  describe('Partial Sensor Data (null values)', () => {
    it('reading with temperature only returns null for humidity and pressure stats — not NaN', async () => {
      const deviceId = await createTestDeviceWithReadings({
        deviceOrder: 9970,
        deviceName: 'Partial Data Device',
        readings: [
          { temperature: 21.0, timestamp: new Date(new Date(dateRanges.dayBeforeYesterday.start).setUTCHours(10, 0, 0, 0)).toISOString() },
        ],
        headers,
        createdDeviceIds,
      });

      const response = await fetch(
        `${API_URL}/api/statistics?startTime=${dateRanges.dayBeforeYesterday.start.toISOString()}&endTime=${dateRanges.dayBeforeYesterday.end.toISOString()}`,
        { headers }
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as StatisticsResponse;
      const deviceStats = data.values.find((s) => s.id === deviceId);
      expect(deviceStats).toBeDefined();

      // Temperature should have real values
      expect(deviceStats!.statistics.temperature.avg).toBe(21.0);
      expect(deviceStats!.statistics.temperature.min).toBe(21.0);
      expect(deviceStats!.statistics.temperature.max).toBe(21.0);

      // Humidity and pressure must be null, not NaN or 0
      expect(deviceStats!.statistics.humidity.avg).toBeNull();
      expect(deviceStats!.statistics.humidity.min).toBeNull();
      expect(deviceStats!.statistics.humidity.max).toBeNull();
      expect(deviceStats!.statistics.pressure.avg).toBeNull();
      expect(deviceStats!.statistics.pressure.min).toBeNull();
      expect(deviceStats!.statistics.pressure.max).toBeNull();
    });

    it('average is computed only from readings that have the field — readings without it are excluded', async () => {
      const base = dateRanges.dayBeforeYesterday.start;

      const deviceId = await createTestDeviceWithReadings({
        deviceOrder: 9969,
        deviceName: 'Mixed Data Device',
        readings: [
          { temperature: 10.0, timestamp: new Date(new Date(base).setUTCHours(11, 0, 0, 0)).toISOString() },
          { temperature: 20.0, humidity: 50.0, timestamp: new Date(new Date(base).setUTCHours(11, 10, 0, 0)).toISOString() },
        ],
        headers,
        createdDeviceIds,
      });

      const response = await fetch(
        `${API_URL}/api/devices/${deviceId}/statistics?startTime=${dateRanges.dayBeforeYesterday.start.toISOString()}&endTime=${dateRanges.dayBeforeYesterday.end.toISOString()}`,
        { headers }
      );

      const deviceStats = (await response.json()) as SingleDeviceStatistics;
      expect(deviceStats).toBeDefined();

      // Temperature avg uses both readings: (10 + 20) / 2 = 15
      expect(deviceStats!.statistics.temperature.avg).toBe(15);
      expect(deviceStats!.statistics.temperature.min).toBe(10);
      expect(deviceStats!.statistics.temperature.max).toBe(20);

      // Humidity avg uses only reading B (reading A had no humidity): avg = 50
      expect(deviceStats!.statistics.humidity.avg).toBe(50);
      expect(deviceStats!.statistics.humidity.min).toBe(50);
      expect(deviceStats!.statistics.humidity.max).toBe(50);

      // Pressure: neither reading had pressure → all null
      expect(deviceStats!.statistics.pressure.avg).toBeNull();
    });
  });

  describe('Device with zero readings in queried range', () => {
    it('GET /api/statistics returns null stats for device with no readings in range — not error or NaN', async () => {
      const deviceId = await createTestDeviceWithReadings({
        deviceOrder: 9966,
        deviceName: 'No Readings Device',
        readings: [], // device exists but has no readings
        headers,
        createdDeviceIds,
      });

      const response = await fetch(
        `${API_URL}/api/statistics?startTime=${dateRanges.dayBeforeYesterday.start.toISOString()}&endTime=${dateRanges.dayBeforeYesterday.end.toISOString()}`,
        { headers }
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as StatisticsResponse;
      const deviceStats = data.values.find((s) => s.id === deviceId);
      expect(deviceStats).toBeDefined();

      expect(deviceStats!.statistics.temperature.avg).toBeNull();
      expect(deviceStats!.statistics.temperature.min).toBeNull();
      expect(deviceStats!.statistics.temperature.max).toBeNull();
      expect(deviceStats!.statistics.humidity.avg).toBeNull();
      expect(deviceStats!.statistics.humidity.min).toBeNull();
      expect(deviceStats!.statistics.humidity.max).toBeNull();
      expect(deviceStats!.statistics.pressure.avg).toBeNull();
      expect(deviceStats!.statistics.pressure.min).toBeNull();
      expect(deviceStats!.statistics.pressure.max).toBeNull();
    });

    it('GET /api/devices/:id/statistics returns 200 with null stats when device has no readings in range', async () => {
      const deviceId = await createTestDeviceWithReadings({
        deviceOrder: 9965,
        deviceName: 'No Readings Device Single',
        readings: [],
        headers,
        createdDeviceIds,
      });

      const response = await fetch(
        `${API_URL}/api/devices/${deviceId}/statistics?startTime=${dateRanges.dayBeforeYesterday.start.toISOString()}&endTime=${dateRanges.dayBeforeYesterday.end.toISOString()}`,
        { headers }
      );


      expect(response.status).toBe(200);

      const deviceStats = (await response.json()) as SingleDeviceStatistics;
      expect(deviceStats.id).toBe(deviceId);
      expect(deviceStats.statistics.temperature.avg).toBeNull();
      expect(deviceStats.statistics.temperature.min).toBeNull();
      expect(deviceStats.statistics.temperature.max).toBeNull();
      expect(deviceStats.statistics.humidity.avg).toBeNull();
      expect(deviceStats.statistics.humidity.min).toBeNull();
      expect(deviceStats.statistics.humidity.max).toBeNull();
      expect(deviceStats.statistics.pressure.avg).toBeNull();
      expect(deviceStats.statistics.pressure.min).toBeNull();
      expect(deviceStats.statistics.pressure.max).toBeNull();
    });
  });
});
