/**
 * Compatibility tests for GET /api/readings endpoints
 * Compare old API (Hapi.js + PostgreSQL) vs new API (Lambda + DynamoDB)
 */

import { OLD_API_URL, NEW_API_URL, verifyServersRunning } from '../utils/test-server';
import {getTestDateRanges, TEST_USER} from '../utils/test-data';
import { compareAllReadings, compareDeviceReadings } from './comparison-utils';

// Response type definitions
interface LoginSuccessResponse {
  token: string;
}

interface AggregatedReading {
  time: string;
  avg: number;
  min: number;
  max: number;
}

interface DeviceReadings {
  id: string;
  values: AggregatedReading[];
}

interface ReadingsListResponse {
  count: number;
  totCount: number;
  limit: number;
  values: DeviceReadings[];
}

interface TypeReadings {
  type: string;
  values: AggregatedReading[];
}

interface DeviceTypeReadingsResponse {
  id: string;
  values: TypeReadings[];
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

describe('GET /api/readings - Compatibility', () => {
  let oldToken: string;
  let newToken: string;
  const dateRanges = getTestDateRanges();

  beforeAll(async () => {
    await verifyServersRunning();
    const tokens = await getAuthTokens();
    oldToken = tokens.oldToken;
    newToken = tokens.newToken;
  });

  // Test all combinations of timeframe/level for temperature
  describe('Temperature readings', () => {
    const type = 'temperature';

    it('should return identical aggregated readings for yesterday with 30-minute intervals', async () => {
      const startTime = dateRanges.yesterday.start.toISOString();
      const endTime = dateRanges.yesterday.end.toISOString();
      const level = '30 minutes';

      const oldResponse = await fetch(
        `${OLD_API_URL}/api/devices/readings?startTime=${startTime}&endTime=${endTime}&type=${type}&level=${encodeURIComponent(
          level
        )}&limit=10&offset=0`,
        { headers: { Authorization: oldToken } }
      );
      const newResponse = await fetch(
        `${NEW_API_URL}/api/readings?startTime=${startTime}&endTime=${endTime}&type=${type}&level=${encodeURIComponent(
          level
        )}&limit=10&offset=0&timezone=Europe/Helsinki`,
        { headers: { Authorization: `Bearer ${newToken}` } }
      );

      expect(oldResponse.status).toBe(200);
      expect(newResponse.status).toBe(200);

      const oldData = (await oldResponse.json()) as ReadingsListResponse;
      const newData = (await newResponse.json()) as ReadingsListResponse;

      const comparison = compareAllReadings(oldData, newData, 0.01);
      if (!comparison.matches) {
        console.error(`Readings comparison failed for yesterday/${type}/30min:`);
        comparison.differences?.forEach((diff) => console.error(`  - ${diff}`));
      }
      expect(comparison.matches).toBe(true);
    });

    it('should return identical aggregated readings for current week with day level', async () => {
      const startTime = dateRanges.currentWeek.start.toISOString();
      const endTime = dateRanges.currentWeek.end.toISOString();
      const level = 'day';

      const oldResponse = await fetch(
        `${OLD_API_URL}/api/devices/readings?startTime=${startTime}&endTime=${endTime}&type=${type}&level=${level}&limit=10&offset=0`,
        { headers: { Authorization: oldToken } }
      );
      const newResponse = await fetch(
        `${NEW_API_URL}/api/readings?startTime=${startTime}&endTime=${endTime}&type=${type}&level=${level}&limit=10&offset=0&timezone=Europe/Helsinki`,
        { headers: { Authorization: `Bearer ${newToken}` } }
      );

      expect(oldResponse.status).toBe(200);
      expect(newResponse.status).toBe(200);

      const oldData = (await oldResponse.json()) as ReadingsListResponse;
      const newData = (await newResponse.json()) as ReadingsListResponse;

      const comparison = compareAllReadings(oldData, newData, 0.01);
      if (!comparison.matches) {
        console.error(`Readings comparison failed for currentWeek/${type}/day:`);
        comparison.differences?.forEach((diff) => console.error(`  - ${diff}`));
      }
      expect(comparison.matches).toBe(true);
    });

    it('should return identical aggregated readings for current month with day level', async () => {
      const startTime = dateRanges.currentMonth.start.toISOString();
      const endTime = dateRanges.currentMonth.end.toISOString();
      const level = 'day';

      const oldResponse = await fetch(
        `${OLD_API_URL}/api/devices/readings?startTime=${startTime}&endTime=${endTime}&type=${type}&level=${level}&limit=10&offset=0`,
        { headers: { Authorization: oldToken } }
      );
      const newResponse = await fetch(
        `${NEW_API_URL}/api/readings?startTime=${startTime}&endTime=${endTime}&type=${type}&level=${level}&limit=10&offset=0&timezone=Europe/Helsinki`,
        { headers: { Authorization: `Bearer ${newToken}` } }
      );

      expect(oldResponse.status).toBe(200);
      expect(newResponse.status).toBe(200);

      const oldData = (await oldResponse.json()) as ReadingsListResponse;
      const newData = (await newResponse.json()) as ReadingsListResponse;

      const comparison = compareAllReadings(oldData, newData, 0.01);
      if (!comparison.matches) {
        console.error(`Readings comparison failed for currentMonth/${type}/day:`);
        comparison.differences?.forEach((diff) => console.error(`  - ${diff}`));
      }
      expect(comparison.matches).toBe(true);
    });

    it('should return identical aggregated readings for january 2026 with week level', async () => {
      const startTime = dateRanges.january2026.start.toISOString();
      const endTime = dateRanges.january2026.end.toISOString();
      const level = 'week';

      const oldResponse = await fetch(
        `${OLD_API_URL}/api/devices/readings?startTime=${startTime}&endTime=${endTime}&type=${type}&level=${level}&limit=10&offset=0`,
        { headers: { Authorization: oldToken } }
      );
      const newResponse = await fetch(
        `${NEW_API_URL}/api/readings?startTime=${startTime}&endTime=${endTime}&type=${type}&level=${level}&limit=10&offset=0&timezone=Europe/Helsinki`,
        { headers: { Authorization: `Bearer ${newToken}` } }
      );

      expect(oldResponse.status).toBe(200);
      expect(newResponse.status).toBe(200);

      const oldData = (await oldResponse.json()) as ReadingsListResponse;
      const newData = (await newResponse.json()) as ReadingsListResponse;

      const comparison = compareAllReadings(oldData, newData, 0.01);
      if (!comparison.matches) {
        console.error(`Readings comparison failed for previousMonth/${type}/week:`);
        comparison.differences?.forEach((diff) => console.error(`  - ${diff}`));
      }
      expect(comparison.matches).toBe(true);
    });

    it('should return identical aggregated readings for current year with month level', async () => {
      const startTime = dateRanges.currentYear.start.toISOString();
      const endTime = dateRanges.currentYear.end.toISOString();
      const level = 'month';

      const oldResponse = await fetch(
        `${OLD_API_URL}/api/devices/readings?startTime=${startTime}&endTime=${endTime}&type=${type}&level=${level}&limit=10&offset=0`,
        { headers: { Authorization: oldToken } }
      );
      const newResponse = await fetch(
        `${NEW_API_URL}/api/readings?startTime=${startTime}&endTime=${endTime}&type=${type}&level=${level}&limit=10&offset=0&timezone=Europe/Helsinki`,
        { headers: { Authorization: `Bearer ${newToken}` } }
      );

      expect(oldResponse.status).toBe(200);
      expect(newResponse.status).toBe(200);

      const oldData = (await oldResponse.json()) as ReadingsListResponse;
      const newData = (await newResponse.json()) as ReadingsListResponse;

      const comparison = compareAllReadings(oldData, newData, 0.01);
      if (!comparison.matches) {
        console.error(`Readings comparison failed for currentYear/${type}/month:`);
        comparison.differences?.forEach((diff) => console.error(`  - ${diff}`));
      }
      expect(comparison.matches).toBe(true);
    });

    it('should return identical aggregated readings for year 2025 with month level', async () => {
      const startTime = dateRanges.year2025.start.toISOString();
      const endTime = dateRanges.year2025.end.toISOString();
      const level = 'month';

      const oldResponse = await fetch(
        `${OLD_API_URL}/api/devices/readings?startTime=${startTime}&endTime=${endTime}&type=${type}&level=${level}&limit=10&offset=0`,
        { headers: { Authorization: oldToken } }
      );
      const newResponse = await fetch(
        `${NEW_API_URL}/api/readings?startTime=${startTime}&endTime=${endTime}&type=${type}&level=${level}&limit=10&offset=0&timezone=Europe/Helsinki`,
        { headers: { Authorization: `Bearer ${newToken}` } }
      );

      expect(oldResponse.status).toBe(200);
      expect(newResponse.status).toBe(200);

      const oldData = (await oldResponse.json()) as ReadingsListResponse;
      const newData = (await newResponse.json()) as ReadingsListResponse;

      const comparison = compareAllReadings(oldData, newData, 0.01);
      if (!comparison.matches) {
        console.error(`Readings comparison failed for year2025/${type}/month:`);
        comparison.differences?.forEach((diff) => console.error(`  - ${diff}`));
      }
      expect(comparison.matches).toBe(true);
    });
  });

  // Test humidity readings
  describe('Humidity readings', () => {
    const type = 'humidity';

    it('should return identical aggregated humidity readings for yesterday with 30-minute intervals', async () => {
      const startTime = dateRanges.yesterday.start.toISOString();
      const endTime = dateRanges.yesterday.end.toISOString();
      const level = '30 minutes';

      const oldResponse = await fetch(
        `${OLD_API_URL}/api/devices/readings?startTime=${startTime}&endTime=${endTime}&type=${type}&level=${encodeURIComponent(
          level
        )}&limit=10&offset=0`,
        { headers: { Authorization: oldToken } }
      );
      const newResponse = await fetch(
        `${NEW_API_URL}/api/readings?startTime=${startTime}&endTime=${endTime}&type=${type}&level=${encodeURIComponent(
          level
        )}&limit=10&offset=0&timezone=Europe/Helsinki`,
        { headers: { Authorization: `Bearer ${newToken}` } }
      );

      expect(oldResponse.status).toBe(200);
      expect(newResponse.status).toBe(200);

      const oldData = (await oldResponse.json()) as ReadingsListResponse;
      const newData = (await newResponse.json()) as ReadingsListResponse;

      const comparison = compareAllReadings(oldData, newData, 0.01);
      if (!comparison.matches) {
        console.error(`Readings comparison failed for yesterday/${type}/30min:`);
        comparison.differences?.forEach((diff) => console.error(`  - ${diff}`));
      }
      expect(comparison.matches).toBe(true);
    });

    it('should return identical aggregated humidity readings for current month with day level', async () => {
      const startTime = dateRanges.currentMonth.start.toISOString();
      const endTime = dateRanges.currentMonth.end.toISOString();
      const level = 'day';

      const oldResponse = await fetch(
        `${OLD_API_URL}/api/devices/readings?startTime=${startTime}&endTime=${endTime}&type=${type}&level=${level}&limit=10&offset=0`,
        { headers: { Authorization: oldToken } }
      );
      const newResponse = await fetch(
        `${NEW_API_URL}/api/readings?startTime=${startTime}&endTime=${endTime}&type=${type}&level=${level}&limit=10&offset=0&timezone=Europe/Helsinki`,
        { headers: { Authorization: `Bearer ${newToken}` } }
      );

      expect(oldResponse.status).toBe(200);
      expect(newResponse.status).toBe(200);

      const oldData = (await oldResponse.json()) as ReadingsListResponse;
      const newData = (await newResponse.json()) as ReadingsListResponse;

      const comparison = compareAllReadings(oldData, newData, 0.01);
      if (!comparison.matches) {
        console.error(`Readings comparison failed for currentMonth/${type}/day:`);
        comparison.differences?.forEach((diff) => console.error(`  - ${diff}`));
      }
      expect(comparison.matches).toBe(true);
    });

    it('should return identical aggregated humidity readings for year 2025 with month level', async () => {
      const startTime = dateRanges.year2025.start.toISOString();
      const endTime = dateRanges.year2025.end.toISOString();
      const level = 'month';

      const oldResponse = await fetch(
        `${OLD_API_URL}/api/devices/readings?startTime=${startTime}&endTime=${endTime}&type=${type}&level=${level}&limit=10&offset=0`,
        { headers: { Authorization: oldToken } }
      );
      const newResponse = await fetch(
        `${NEW_API_URL}/api/readings?startTime=${startTime}&endTime=${endTime}&type=${type}&level=${level}&limit=10&offset=0&timezone=Europe/Helsinki`,
        { headers: { Authorization: `Bearer ${newToken}` } }
      );

      expect(oldResponse.status).toBe(200);
      expect(newResponse.status).toBe(200);

      const oldData = (await oldResponse.json()) as ReadingsListResponse;
      const newData = (await newResponse.json()) as ReadingsListResponse;

      const comparison = compareAllReadings(oldData, newData, 0.01);
      if (!comparison.matches) {
        console.error(`Readings comparison failed for year2025/${type}/month:`);
        comparison.differences?.forEach((diff) => console.error(`  - ${diff}`));
      }
      expect(comparison.matches).toBe(true);
    });
  });

  // Test pressure readings
  describe('Pressure readings', () => {
    const type = 'pressure';

    it('should return identical aggregated pressure readings for yesterday with 30-minute intervals', async () => {
      const startTime = dateRanges.yesterday.start.toISOString();
      const endTime = dateRanges.yesterday.end.toISOString();
      const level = '30 minutes';

      const oldResponse = await fetch(
        `${OLD_API_URL}/api/devices/readings?startTime=${startTime}&endTime=${endTime}&type=${type}&level=${encodeURIComponent(
          level
        )}&limit=10&offset=0`,
        { headers: { Authorization: oldToken } }
      );
      const newResponse = await fetch(
        `${NEW_API_URL}/api/readings?startTime=${startTime}&endTime=${endTime}&type=${type}&level=${encodeURIComponent(
          level
        )}&limit=10&offset=0&timezone=Europe/Helsinki`,
        { headers: { Authorization: `Bearer ${newToken}` } }
      );

      expect(oldResponse.status).toBe(200);
      expect(newResponse.status).toBe(200);

      const oldData = (await oldResponse.json()) as ReadingsListResponse;
      const newData = (await newResponse.json()) as ReadingsListResponse;

      const comparison = compareAllReadings(oldData, newData, 0.01);
      if (!comparison.matches) {
        console.error(`Readings comparison failed for yesterday/${type}/30min:`);
        comparison.differences?.forEach((diff) => console.error(`  - ${diff}`));
      }
      expect(comparison.matches).toBe(true);
    });

    it('should return identical aggregated pressure readings for current month with day level', async () => {
      const startTime = dateRanges.currentMonth.start.toISOString();
      const endTime = dateRanges.currentMonth.end.toISOString();
      const level = 'day';

      const oldResponse = await fetch(
        `${OLD_API_URL}/api/devices/readings?startTime=${startTime}&endTime=${endTime}&type=${type}&level=${level}&limit=10&offset=0`,
        { headers: { Authorization: oldToken } }
      );
      const newResponse = await fetch(
        `${NEW_API_URL}/api/readings?startTime=${startTime}&endTime=${endTime}&type=${type}&level=${level}&limit=10&offset=0&timezone=Europe/Helsinki`,
        { headers: { Authorization: `Bearer ${newToken}` } }
      );

      expect(oldResponse.status).toBe(200);
      expect(newResponse.status).toBe(200);

      const oldData = (await oldResponse.json()) as ReadingsListResponse;
      const newData = (await newResponse.json()) as ReadingsListResponse;

      const comparison = compareAllReadings(oldData, newData, 0.01);
      if (!comparison.matches) {
        console.error(`Readings comparison failed for currentMonth/${type}/day:`);
        comparison.differences?.forEach((diff) => console.error(`  - ${diff}`));
      }
      expect(comparison.matches).toBe(true);
    });

    it('should return identical aggregated pressure readings for year 2025 with month level', async () => {
      const startTime = dateRanges.year2025.start.toISOString();
      const endTime = dateRanges.year2025.end.toISOString();
      const level = 'month';

      const oldResponse = await fetch(
        `${OLD_API_URL}/api/devices/readings?startTime=${startTime}&endTime=${endTime}&type=${type}&level=${level}&limit=10&offset=0`,
        { headers: { Authorization: oldToken } }
      );
      const newResponse = await fetch(
        `${NEW_API_URL}/api/readings?startTime=${startTime}&endTime=${endTime}&type=${type}&level=${level}&limit=10&offset=0&timezone=Europe/Helsinki`,
        { headers: { Authorization: `Bearer ${newToken}` } }
      );

      expect(oldResponse.status).toBe(200);
      expect(newResponse.status).toBe(200);

      const oldData = (await oldResponse.json()) as ReadingsListResponse;
      const newData = (await newResponse.json()) as ReadingsListResponse;

      const comparison = compareAllReadings(oldData, newData, 0.01);
      if (!comparison.matches) {
        console.error(`Readings comparison failed for year2025/${type}/month:`);
        comparison.differences?.forEach((diff) => console.error(`  - ${diff}`));
      }
      expect(comparison.matches).toBe(true);
    });
  });

  // Test pagination
  describe('Pagination', () => {
    it('should support pagination with offset', async () => {
      const startTime = dateRanges.yesterday.start.toISOString();
      const endTime = dateRanges.yesterday.end.toISOString();
      const type = 'temperature';
      const level = 'day';

      const oldResponse = await fetch(
        `${OLD_API_URL}/api/devices/readings?startTime=${startTime}&endTime=${endTime}&type=${type}&level=${level}&limit=1&offset=1`,
        { headers: { Authorization: oldToken } }
      );
      const newResponse = await fetch(
        `${NEW_API_URL}/api/readings?startTime=${startTime}&endTime=${endTime}&type=${type}&level=${level}&limit=1&offset=1&timezone=Europe/Helsinki`,
        { headers: { Authorization: `Bearer ${newToken}` } }
      );

      expect(oldResponse.status).toBe(200);
      expect(newResponse.status).toBe(200);

      const oldData = (await oldResponse.json()) as ReadingsListResponse;
      const newData = (await newResponse.json()) as ReadingsListResponse;

      const comparison = compareAllReadings(oldData, newData, 0.01);
      if (!comparison.matches) {
        console.error(`Pagination readings comparison failed:`);
        comparison.differences?.forEach((diff) => console.error(`  - ${diff}`));
      }
      expect(comparison.matches).toBe(true);
      expect(newData.limit).toBe(1);
      expect(newData.values.length).toBe(1);
    });
  });

  // Test error cases
  describe('Error handling', () => {
    it('should return 401 without authentication', async () => {
      const startTime = dateRanges.yesterday.start.toISOString();
      const endTime = dateRanges.yesterday.end.toISOString();

      const oldResponse = await fetch(
        `${OLD_API_URL}/api/devices/readings?startTime=${startTime}&endTime=${endTime}&type=temperature&level=day&limit=10&offset=0`
      );
      const newResponse = await fetch(
        `${NEW_API_URL}/api/readings?startTime=${startTime}&endTime=${endTime}&type=temperature&level=day&limit=10&offset=0&timezone=Europe/Helsinki`
      );

      expect(oldResponse.status).toBe(401);
      expect(newResponse.status).toBe(401);
    });
  });
});

describe('GET /api/devices/:id/readings - Compatibility', () => {
  let oldToken: string;
  let newToken: string;
  const dateRanges = getTestDateRanges();

  beforeAll(async () => {
    await verifyServersRunning();
    const tokens = await getAuthTokens();
    oldToken = tokens.oldToken;
    newToken = tokens.newToken;
  });

  it('should return identical readings for a device with multiple types', async () => {
    const deviceId = 'device-001';
    const startTime = dateRanges.yesterday.start.toISOString();
    const endTime = dateRanges.yesterday.end.toISOString();
    const level = 'day';

    const oldResponse = await fetch(
      `${OLD_API_URL}/api/devices/${deviceId}/readings?startTime=${startTime}&endTime=${endTime}&types=temperature&types=humidity&types=pressure&level=${level}`,
      { headers: { Authorization: oldToken } }
    );
    const newResponse = await fetch(
      `${NEW_API_URL}/api/devices/${deviceId}/readings?startTime=${startTime}&endTime=${endTime}&types=temperature&types=humidity&types=pressure&level=${level}&timezone=Europe/Helsinki`,
      { headers: { Authorization: `Bearer ${newToken}` } }
    );

    expect(oldResponse.status).toBe(200);
    expect(newResponse.status).toBe(200);

    const oldData = (await oldResponse.json()) as DeviceTypeReadingsResponse;
    const newData = (await newResponse.json()) as DeviceTypeReadingsResponse;

    const comparison = compareDeviceReadings(oldData, newData, 0.01);
    if (!comparison.matches) {
      console.error(`Device readings comparison failed for ${deviceId}:`);
      comparison.differences?.forEach((diff) => console.error(`  - ${diff}`));
    }
    expect(comparison.matches).toBe(true);
  });

  it('should return 404 for non-existent device', async () => {
    const deviceId = 'device-999';
    const startTime = dateRanges.yesterday.start.toISOString();
    const endTime = dateRanges.yesterday.end.toISOString();
    const level = 'day';

    const oldResponse = await fetch(
      `${OLD_API_URL}/api/devices/${deviceId}/readings?startTime=${startTime}&endTime=${endTime}&types=temperature&level=${level}`,
      { headers: { Authorization: oldToken } }
    );
    const newResponse = await fetch(
      `${NEW_API_URL}/api/devices/${deviceId}/readings?startTime=${startTime}&endTime=${endTime}&types=temperature&level=${level}&timezone=Europe/Helsinki`,
      { headers: { Authorization: `Bearer ${newToken}` } }
    );

    expect(oldResponse.status).toBe(404);
    expect(newResponse.status).toBe(404);
  });

  it('should return 401 without authentication', async () => {
    const deviceId = 'device-001';
    const startTime = dateRanges.yesterday.start.toISOString();
    const endTime = dateRanges.yesterday.end.toISOString();
    const level = 'day';

    const oldResponse = await fetch(
      `${OLD_API_URL}/api/devices/${deviceId}/readings?startTime=${startTime}&endTime=${endTime}&types=temperature&level=${level}`
    );
    const newResponse = await fetch(
      `${NEW_API_URL}/api/devices/${deviceId}/readings?startTime=${startTime}&endTime=${endTime}&types=temperature&level=${level}`
    );

    expect(oldResponse.status).toBe(401);
    expect(newResponse.status).toBe(401);
  });
});
