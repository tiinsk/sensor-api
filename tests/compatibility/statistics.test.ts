/**
 * Compatibility Tests: Statistics Endpoints
 *
 * Compare statistics endpoints behavior between old and new APIs
 */

import { OLD_API_URL, NEW_API_URL, verifyServersRunning } from '../utils/test-server';
import { TEST_USER, getTestDateRanges } from '../utils/test-data';
import { compareStatistics, compareNumbers } from './comparison-utils';

// Response type definitions
interface LoginSuccessResponse {
  token: string;
}

interface Statistics {
  temperature: {
    avg: number | null;
    min: number | null;
    max: number | null;
  };
  humidity: {
    avg: number | null;
    min: number | null;
    max: number | null;
  };
  pressure: {
    avg: number | null;
    min: number | null;
    max: number | null;
  };
}

interface DeviceStatistics {
  id: string;
  statistics: Statistics;
}

interface StatisticsResponse {
  count: number;
  totCount: number;
  limit: number;
  values: DeviceStatistics[];
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

describe('GET /api/statistics - Compatibility', () => {
  let oldToken: string;
  let newToken: string;
  const dateRanges = getTestDateRanges();

  beforeAll(async () => {
    await verifyServersRunning();
    const tokens = await getAuthTokens();
    oldToken = tokens.oldToken;
    newToken = tokens.newToken;
  });

  describe('Yesterday Statistics (Complete Day)', () => {
    it('should return identical statistics for yesterday', async () => {
      const startTime = dateRanges.yesterday.start.toISOString();
      const endTime = dateRanges.yesterday.end.toISOString();

      // Get from old API
      const oldResponse = await fetch(
        `${OLD_API_URL}/api/devices/statistics?startTime=${startTime}&endTime=${endTime}`,
        { headers: { 'Authorization': oldToken } }
      );

      // Get from new API
      const newResponse = await fetch(
        `${NEW_API_URL}/api/statistics?startTime=${startTime}&endTime=${endTime}`,
        { headers: { 'Authorization': `Bearer ${newToken}` } }
      );

      // Both should return 200
      expect(oldResponse.status).toBe(200);
      expect(newResponse.status).toBe(200);

      // Compare responses
      const oldData = await oldResponse.json() as StatisticsResponse;
      const newData = await newResponse.json() as StatisticsResponse;

      const comparison = compareStatistics(oldData, newData);
      if (!comparison.matches) {
        console.error('Statistics comparison failed:', comparison.differences);
      }
      expect(comparison.matches).toBe(true);
    });
  });

  describe('Current Month Statistics (Incomplete Period)', () => {
    it('should return identical statistics for current month', async () => {
      const startTime = dateRanges.currentMonth.start.toISOString();
      const endTime = dateRanges.currentMonth.end.toISOString();

      // Get from old API
      const oldResponse = await fetch(
        `${OLD_API_URL}/api/devices/statistics?startTime=${startTime}&endTime=${endTime}`,
        { headers: { 'Authorization': oldToken } }
      );

      // Get from new API
      const newResponse = await fetch(
        `${NEW_API_URL}/api/statistics?startTime=${startTime}&endTime=${endTime}`,
        { headers: { 'Authorization': `Bearer ${newToken}` } }
      );

      // Both should return 200
      expect(oldResponse.status).toBe(200);
      expect(newResponse.status).toBe(200);

      // Compare responses
      const oldData = await oldResponse.json() as StatisticsResponse;
      const newData = await newResponse.json() as StatisticsResponse;

      const comparison = compareStatistics(oldData, newData);
      if (!comparison.matches) {
        console.error('Statistics comparison failed:', comparison.differences);
      }
      expect(comparison.matches).toBe(true);
    });
  });

  describe('Complete Month Statistics', () => {
    it('should return identical statistics for January 2026', async () => {
      const startTime = dateRanges.january2026.start.toISOString();
      const endTime = dateRanges.january2026.end.toISOString();

      // Get from old API
      const oldResponse = await fetch(
        `${OLD_API_URL}/api/devices/statistics?startTime=${startTime}&endTime=${endTime}`,
        { headers: { 'Authorization': oldToken } }
      );

      // Get from new API
      const newResponse = await fetch(
        `${NEW_API_URL}/api/statistics?startTime=${startTime}&endTime=${endTime}`,
        { headers: { 'Authorization': `Bearer ${newToken}` } }
      );

      // Both should return 200
      expect(oldResponse.status).toBe(200);
      expect(newResponse.status).toBe(200);

      // Compare responses
      const oldData = await oldResponse.json() as StatisticsResponse;
      const newData = await newResponse.json() as StatisticsResponse;

      const comparison = compareStatistics(oldData, newData);
      if (!comparison.matches) {
        console.error('Statistics comparison failed:', comparison.differences);
      }
      expect(comparison.matches).toBe(true);
    });
  });

  describe('Year Statistics', () => {
    it('should return identical statistics for full year 2025', async () => {
      const startTime = dateRanges.year2025.start.toISOString();
      const endTime = dateRanges.year2025.end.toISOString();

      // Get from old API
      const oldResponse = await fetch(
        `${OLD_API_URL}/api/devices/statistics?startTime=${startTime}&endTime=${endTime}`,
        { headers: { 'Authorization': oldToken } }
      );

      // Get from new API
      const newResponse = await fetch(
        `${NEW_API_URL}/api/statistics?startTime=${startTime}&endTime=${endTime}`,
        { headers: { 'Authorization': `Bearer ${newToken}` } }
      );

      // Both should return 200
      expect(oldResponse.status).toBe(200);
      expect(newResponse.status).toBe(200);

      // Compare responses
      const oldData = await oldResponse.json() as StatisticsResponse;
      const newData = await newResponse.json() as StatisticsResponse;

      const comparison = compareStatistics(oldData, newData);
      if (!comparison.matches) {
        console.error('Statistics comparison failed:', comparison.differences);
      }
      expect(comparison.matches).toBe(true);
    });
  });

  describe('Pagination', () => {
    it('should respect limit parameter', async () => {
      const startTime = dateRanges.yesterday.start.toISOString();
      const endTime = dateRanges.yesterday.end.toISOString();

      // Get with limit=1 from old API
      const oldResponse = await fetch(
        `${OLD_API_URL}/api/devices/statistics?startTime=${startTime}&endTime=${endTime}&limit=1`,
        { headers: { 'Authorization': oldToken } }
      );

      // Get with limit=1 from new API
      const newResponse = await fetch(
        `${NEW_API_URL}/api/statistics?startTime=${startTime}&endTime=${endTime}&limit=1`,
        { headers: { 'Authorization': `Bearer ${newToken}` } }
      );

      const oldData = await oldResponse.json() as StatisticsResponse;
      const newData = await newResponse.json() as StatisticsResponse;

      // Should return exactly 1 device
      expect(oldData.count).toBe(1);
      expect(newData.count).toBe(1);
      expect(oldData.values.length).toBe(1);
      expect(newData.values.length).toBe(1);

      // But totCount should be total enabled devices
      expect(oldData.totCount).toBeGreaterThan(1);
      expect(newData.totCount).toBeGreaterThan(1);
    });
  });

  describe('Validation', () => {
    it('should return 400 for missing startTime', async () => {
      const endTime = dateRanges.yesterday.end.toISOString();

      // Try old API
      const oldResponse = await fetch(
        `${OLD_API_URL}/api/devices/statistics?endTime=${endTime}`,
        { headers: { 'Authorization': oldToken } }
      );

      // Try new API
      const newResponse = await fetch(
        `${NEW_API_URL}/api/statistics?endTime=${endTime}`,
        { headers: { 'Authorization': `Bearer ${newToken}` } }
      );

      // Both should return 400
      expect(oldResponse.status).toBe(400);
      expect(newResponse.status).toBe(400);
    });

    it('should return 400 for missing endTime', async () => {
      const startTime = dateRanges.yesterday.start.toISOString();

      // Try old API
      const oldResponse = await fetch(
        `${OLD_API_URL}/api/devices/statistics?startTime=${startTime}`,
        { headers: { 'Authorization': oldToken } }
      );

      // Try new API
      const newResponse = await fetch(
        `${NEW_API_URL}/api/statistics?startTime=${startTime}`,
        { headers: { 'Authorization': `Bearer ${newToken}` } }
      );

      // Both should return 400
      expect(oldResponse.status).toBe(400);
      expect(newResponse.status).toBe(400);
    });
  });

  describe('Authentication', () => {
    it('should return 401 without authentication', async () => {
      const startTime = dateRanges.yesterday.start.toISOString();
      const endTime = dateRanges.yesterday.end.toISOString();

      // Try old API without token
      const oldResponse = await fetch(
        `${OLD_API_URL}/api/devices/statistics?startTime=${startTime}&endTime=${endTime}`
      );

      // Try new API without token
      const newResponse = await fetch(
        `${NEW_API_URL}/api/statistics?startTime=${startTime}&endTime=${endTime}`
      );

      // Both should return 401
      expect(oldResponse.status).toBe(401);
      expect(newResponse.status).toBe(401);
    });
  });
});

describe('GET /api/devices/:id/statistics - Compatibility', () => {
  let oldToken: string;
  let newToken: string;
  const dateRanges = getTestDateRanges();

  beforeAll(async () => {
    await verifyServersRunning();
    const tokens = await getAuthTokens();
    oldToken = tokens.oldToken;
    newToken = tokens.newToken;
  });

  describe('Single Device Statistics', () => {
    it('should return identical statistics for a specific device', async () => {
      const deviceId = 'device-001';
      const startTime = dateRanges.yesterday.start.toISOString();
      const endTime = dateRanges.yesterday.end.toISOString();

      // Get from old API
      const oldResponse = await fetch(
        `${OLD_API_URL}/api/devices/${deviceId}/statistics?startTime=${startTime}&endTime=${endTime}`,
        { headers: { 'Authorization': oldToken } }
      );

      // Get from new API
      const newResponse = await fetch(
        `${NEW_API_URL}/api/devices/${deviceId}/statistics?startTime=${startTime}&endTime=${endTime}`,
        { headers: { 'Authorization': `Bearer ${newToken}` } }
      );

      // Both should return 200
      expect(oldResponse.status).toBe(200);
      expect(newResponse.status).toBe(200);

      // Compare responses
      const oldData = await oldResponse.json() as DeviceStatistics;
      const newData = await newResponse.json() as DeviceStatistics;

      expect(oldData.id).toBe(newData.id);
      expect(oldData.id).toBe(deviceId);

      // Compare temperature statistics
      expect(compareNumbers(oldData.statistics.temperature.avg, newData.statistics.temperature.avg)).toBe(true);
      expect(compareNumbers(oldData.statistics.temperature.min, newData.statistics.temperature.min)).toBe(true);
      expect(compareNumbers(oldData.statistics.temperature.max, newData.statistics.temperature.max)).toBe(true);

      // Compare humidity statistics
      expect(compareNumbers(oldData.statistics.humidity.avg, newData.statistics.humidity.avg)).toBe(true);
      expect(compareNumbers(oldData.statistics.humidity.min, newData.statistics.humidity.min)).toBe(true);
      expect(compareNumbers(oldData.statistics.humidity.max, newData.statistics.humidity.max)).toBe(true);

      // Compare pressure statistics
      expect(compareNumbers(oldData.statistics.pressure.avg, newData.statistics.pressure.avg)).toBe(true);
      expect(compareNumbers(oldData.statistics.pressure.min, newData.statistics.pressure.min)).toBe(true);
      expect(compareNumbers(oldData.statistics.pressure.max, newData.statistics.pressure.max)).toBe(true);
    });

    it('should calculate statistics correctly for different time ranges', async () => {
      const deviceId = 'device-002';
      const startTime = dateRanges.currentMonth.start.toISOString();
      const endTime = dateRanges.currentMonth.end.toISOString();

      // Get from old API
      const oldResponse = await fetch(
        `${OLD_API_URL}/api/devices/${deviceId}/statistics?startTime=${startTime}&endTime=${endTime}`,
        { headers: { 'Authorization': oldToken } }
      );

      // Get from new API
      const newResponse = await fetch(
        `${NEW_API_URL}/api/devices/${deviceId}/statistics?startTime=${startTime}&endTime=${endTime}`,
        { headers: { 'Authorization': `Bearer ${newToken}` } }
      );

      // Both should return 200
      expect(oldResponse.status).toBe(200);
      expect(newResponse.status).toBe(200);

      // Compare responses
      const oldData = await oldResponse.json() as DeviceStatistics;
      const newData = await newResponse.json() as DeviceStatistics;

      // All statistics should exist (we have data for current month)
      expect(oldData.statistics.temperature.avg).not.toBeNull();
      expect(newData.statistics.temperature.avg).not.toBeNull();
      expect(oldData.statistics.humidity.avg).not.toBeNull();
      expect(newData.statistics.humidity.avg).not.toBeNull();
      expect(oldData.statistics.pressure.avg).not.toBeNull();
      expect(newData.statistics.pressure.avg).not.toBeNull();

      // Values should match (within tolerance)
      expect(compareNumbers(oldData.statistics.temperature.avg, newData.statistics.temperature.avg, 0.01)).toBe(true);
    });

    it('should return 404 for non-existent device', async () => {
      const deviceId = 'non-existent-device';
      const startTime = dateRanges.yesterday.start.toISOString();
      const endTime = dateRanges.yesterday.end.toISOString();

      // Try old API
      const oldResponse = await fetch(
        `${OLD_API_URL}/api/devices/${deviceId}/statistics?startTime=${startTime}&endTime=${endTime}`,
        { headers: { 'Authorization': oldToken } }
      );

      // Try new API
      const newResponse = await fetch(
        `${NEW_API_URL}/api/devices/${deviceId}/statistics?startTime=${startTime}&endTime=${endTime}`,
        { headers: { 'Authorization': `Bearer ${newToken}` } }
      );

      // Both should return 404
      expect(oldResponse.status).toBe(404);
      expect(newResponse.status).toBe(404);
    });

    it('should return 404 for disabled device', async () => {
      const deviceId = 'device-003'; // Disabled in seed data
      const startTime = dateRanges.yesterday.start.toISOString();
      const endTime = dateRanges.yesterday.end.toISOString();

      // Try old API
      const oldResponse = await fetch(
        `${OLD_API_URL}/api/devices/${deviceId}/statistics?startTime=${startTime}&endTime=${endTime}`,
        { headers: { 'Authorization': oldToken } }
      );

      // Try new API
      const newResponse = await fetch(
        `${NEW_API_URL}/api/devices/${deviceId}/statistics?startTime=${startTime}&endTime=${endTime}`,
        { headers: { 'Authorization': `Bearer ${newToken}` } }
      );

      // Both should return 404 (treating disabled as not found)
      expect(oldResponse.status).toBe(404);
      expect(newResponse.status).toBe(404);
    });
  });

  describe('Statistics Values', () => {
    it('should have valid min/max/avg relationships', async () => {
      const deviceId = 'device-001';
      const startTime = dateRanges.yesterday.start.toISOString();
      const endTime = dateRanges.yesterday.end.toISOString();

      // Get from new API
      const newResponse = await fetch(
        `${NEW_API_URL}/api/devices/${deviceId}/statistics?startTime=${startTime}&endTime=${endTime}`,
        { headers: { 'Authorization': `Bearer ${newToken}` } }
      );

      const newData = await newResponse.json() as DeviceStatistics;
      const stats = newData.statistics;

      // Temperature: min <= avg <= max
      if (stats.temperature.min && stats.temperature.avg && stats.temperature.max) {
        expect(stats.temperature.min).toBeLessThanOrEqual(stats.temperature.avg);
        expect(stats.temperature.avg).toBeLessThanOrEqual(stats.temperature.max);
      }

      // Humidity: min <= avg <= max
      if (stats.humidity.min && stats.humidity.avg && stats.humidity.max) {
        expect(stats.humidity.min).toBeLessThanOrEqual(stats.humidity.avg);
        expect(stats.humidity.avg).toBeLessThanOrEqual(stats.humidity.max);
      }

      // Pressure: min <= avg <= max
      if (stats.pressure.min && stats.pressure.avg && stats.pressure.max) {
        expect(stats.pressure.min).toBeLessThanOrEqual(stats.pressure.avg);
        expect(stats.pressure.avg).toBeLessThanOrEqual(stats.pressure.max);
      }
    });
  });

  describe('Authentication', () => {
    it('should return 401 without authentication', async () => {
      const deviceId = 'device-001';
      const startTime = dateRanges.yesterday.start.toISOString();
      const endTime = dateRanges.yesterday.end.toISOString();

      // Try old API without token
      const oldResponse = await fetch(
        `${OLD_API_URL}/api/devices/${deviceId}/statistics?startTime=${startTime}&endTime=${endTime}`
      );

      // Try new API without token
      const newResponse = await fetch(
        `${NEW_API_URL}/api/devices/${deviceId}/statistics?startTime=${startTime}&endTime=${endTime}`
      );

      // Both should return 401
      expect(oldResponse.status).toBe(401);
      expect(newResponse.status).toBe(401);
    });
  });
});
