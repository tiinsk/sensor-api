/**
 * Integration tests for POST /api/devices/:id/readings
 * Tests adding readings to devices
 */

import { getApiUrl } from './utils/test-config';
import { getAuthHeaders, RequestHeaders } from './utils/auth-utils';
import { generateTestDeviceId, deleteTestDevices, createTestDeviceWithReadings } from '../utils/device-helpers';
import { getTestDateRanges } from '../utils/test-data';
import type { PostedReading } from './utils/types';
import { airQualityFromPm25Co2 } from '../../src/utils/air-quality';

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
      const reading = (await response.json()) as PostedReading;
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
      const reading = (await response.json()) as PostedReading;
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

  describe('Reading Propagation', () => {
    it('posted reading appears in /latest, /statistics, and /readings', async () => {
      const deviceId = generateTestDeviceId();

      await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: deviceId,
          name: 'Propagation Test Device',
          location: { x: 0, y: 0, type: null },
          type: 'ruuvi',
          disabled: false,
          order: 9996,
        }),
      });

      createdDeviceIds.push(deviceId);

      // Known values posted at a fixed past timestamp (yesterday noon UTC)
      const timestamp = new Date(new Date(dateRanges.yesterday.start).setUTCHours(12, 0, 0, 0)).toISOString();
      const posted = { temperature: 21.5, humidity: 55.0, pressure: 1012.5 };

      const postResponse = await fetch(`${API_URL}/api/devices/${deviceId}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...posted, timestamp }),
      });

      expect(postResponse.status).toBe(201);

      // --- 1. GET /api/devices/:id/latest ---
      // The reading should be the latest (and only) reading for this device
      const latestResponse = await fetch(`${API_URL}/api/devices/${deviceId}/latest`, { headers });
      expect(latestResponse.status).toBe(200);

      const latest = await latestResponse.json() as { reading: { temperature: number; humidity: number; pressure: number; timestamp: string } };
      expect(latest.reading.temperature).toBe(posted.temperature);
      expect(latest.reading.humidity).toBe(posted.humidity);
      expect(latest.reading.pressure).toBe(posted.pressure);
      expect(latest.reading.timestamp).toBe(timestamp);

      // --- 2. GET /api/devices/:id/statistics ---
      // Single reading: avg = min = max = the posted value
      const statsResponse = await fetch(
        `${API_URL}/api/devices/${deviceId}/statistics?startTime=${dateRanges.yesterday.start.toISOString()}&endTime=${dateRanges.yesterday.end.toISOString()}`,
        { headers }
      );
      expect(statsResponse.status).toBe(200);

      const stats = await statsResponse.json() as {
        statistics: {
          temperature: { avg: number; min: number; max: number };
          humidity: { avg: number; min: number; max: number };
          pressure: { avg: number; min: number; max: number };
        };
      };
      expect(stats.statistics.temperature.avg).toBe(posted.temperature);
      expect(stats.statistics.temperature.min).toBe(posted.temperature);
      expect(stats.statistics.temperature.max).toBe(posted.temperature);
      expect(stats.statistics.humidity.avg).toBe(posted.humidity);
      expect(stats.statistics.pressure.avg).toBe(posted.pressure);

      // --- 3. GET /api/readings ---
      // The reading should appear in the day bucket for yesterday
      const readingsResponse = await fetch(
        `${API_URL}/api/readings?startTime=${dateRanges.yesterday.start.toISOString()}&endTime=${dateRanges.yesterday.end.toISOString()}&type=temperature&level=day`,
        { headers }
      );
      expect(readingsResponse.status).toBe(200);

      const readings = await readingsResponse.json() as { values: Array<{ id: string; values: Array<{ avg: number }> }> };
      const deviceBucket = readings.values.find((d) => d.id === deviceId);
      expect(deviceBucket).toBeDefined();
      expect(deviceBucket!.values).toHaveLength(1);
      expect(deviceBucket!.values[0].avg).toBe(posted.temperature);
    });
  });

  describe('Sensor value 0', () => {
    const baseTime = () => new Date(new Date(dateRanges.dayBeforeYesterday.start).setUTCHours(10, 0, 0, 0)).toISOString();

    it('temperature 0 (falsy) is stored and reflected in /latest and /statistics', async () => {
      const deviceId = await createTestDeviceWithReadings({
        deviceOrder: 9995,
        deviceName: 'Zero Temp Device',
        readings: [{ temperature: 0, timestamp: baseTime() }],
        headers,
        createdDeviceIds,
      });

      const latestRes = await fetch(`${API_URL}/api/devices/${deviceId}/latest`, { headers });
      expect(latestRes.status).toBe(200);
      const latest = (await latestRes.json()) as { reading: { temperature: number } };
      expect(latest.reading.temperature).toBe(0);

      const statsRes = await fetch(
        `${API_URL}/api/devices/${deviceId}/statistics?startTime=${dateRanges.dayBeforeYesterday.start.toISOString()}&endTime=${dateRanges.dayBeforeYesterday.end.toISOString()}`,
        { headers }
      );
      expect(statsRes.status).toBe(200);
      const stats = (await statsRes.json()) as { statistics: { temperature: { avg: number; min: number; max: number } } };
      expect(stats.statistics.temperature.avg).toBe(0);
      expect(stats.statistics.temperature.min).toBe(0);
      expect(stats.statistics.temperature.max).toBe(0);
    });

    it('battery 0 is stored and reflected in /latest', async () => {
      const deviceId = await createTestDeviceWithReadings({
        deviceOrder: 9992,
        deviceName: 'Battery Zero Device',
        readings: [{ temperature: 21, battery: 0, timestamp: baseTime() }],
        headers,
        createdDeviceIds,
      });

      const latestRes = await fetch(`${API_URL}/api/devices/${deviceId}/latest`, { headers });
      expect(latestRes.status).toBe(200);
      const latest = (await latestRes.json()) as { reading: { battery: number } };
      expect(latest.reading.battery).toBe(0);
    });
  });

  describe('Ruuvi-air readings', () => {
    it('stores and returns ruuvi-air metrics in latest and aggregated readings', async () => {
      const deviceId = generateTestDeviceId();
      const timestamp = new Date(new Date(dateRanges.yesterday.start).setUTCHours(13, 0, 0, 0)).toISOString();

      await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: deviceId,
          name: 'Ruuvi Air Device',
          location: { x: 0, y: 0, type: null },
          type: 'ruuvi-air',
          disabled: false,
          order: 9991,
        }),
      });

      createdDeviceIds.push(deviceId);

      const payload = {
        temperature: 24.65,
        humidity: 30.2,
        pressure: 1029.08,
        pm25: 0.4,
        co2: 917,
        voc: 45,
        nox: 1,
        timestamp,
      };
      const expectedAirQuality = airQualityFromPm25Co2(payload.pm25, payload.co2);

      const postResponse = await fetch(`${API_URL}/api/devices/${deviceId}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      expect(postResponse.status).toBe(201);
      const posted = (await postResponse.json()) as PostedReading;
      expect(posted.pm25).toBe(payload.pm25);
      expect(posted.co2).toBe(payload.co2);
      expect(posted.voc).toBe(payload.voc);
      expect(posted.nox).toBe(payload.nox);
      expect(posted.airQuality).toBe(expectedAirQuality);

      const latestResponse = await fetch(`${API_URL}/api/devices/${deviceId}/latest`, { headers });
      expect(latestResponse.status).toBe(200);
      const latest = (await latestResponse.json()) as {
        reading: { pm25: number; co2: number; voc: number; nox: number; airQuality: number };
      };
      expect(latest.reading.pm25).toBe(payload.pm25);
      expect(latest.reading.co2).toBe(payload.co2);
      expect(latest.reading.voc).toBe(payload.voc);
      expect(latest.reading.nox).toBe(payload.nox);
      expect(latest.reading.airQuality).toBe(expectedAirQuality);

      const readingsResponse = await fetch(
        `${API_URL}/api/devices/${deviceId}/readings?startTime=${dateRanges.yesterday.start.toISOString()}&endTime=${dateRanges.yesterday.end.toISOString()}&types=co2,airQuality&level=day`,
        { headers }
      );
      expect(readingsResponse.status).toBe(200);
      const readings = (await readingsResponse.json()) as {
        id: string;
        values: Array<{ type: string; values: Array<{ avg: number; min: number; max: number }> }>;
      };

      const co2Series = readings.values.find((item) => item.type === 'co2');
      const airQualitySeries = readings.values.find((item) => item.type === 'airQuality');
      expect(co2Series?.values[0].avg).toBe(payload.co2);
      expect(co2Series?.values[0].min).toBe(payload.co2);
      expect(co2Series?.values[0].max).toBe(payload.co2);
      expect(airQualitySeries?.values[0].avg).toBe(expectedAirQuality);
      expect(airQualitySeries?.values[0].min).toBe(expectedAirQuality);
      expect(airQualitySeries?.values[0].max).toBe(expectedAirQuality);
    });
  });
});
