/**
 * Integration tests for GET /api/readings
 * Tests aggregated readings with exact value verification
 */

import { getApiUrl } from './utils/test-config';
import { getAuthHeaders, RequestHeaders } from './utils/auth-utils';
import { generateTestDeviceId, deleteTestDevices, createTestDeviceWithReadings } from '../utils/device-helpers';
import { getTestDateRanges, toDateString } from '../utils/test-data';
import type { DeviceReadings, ReadingsResponse } from './utils/types';

describe('GET /api/readings - Integration', () => {
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

  describe('Temperature Aggregation Correctness', () => {
    it('should aggregate 3 readings into correct 30-minute bucket', async () => {
      const baseDate = dateRanges.dayBeforeYesterday.start;
      const deviceId = await createTestDeviceWithReadings({
        deviceOrder: 9999,
        deviceName: '30min Test Device',
        readings: [
          { temperature: 10.0, timestamp: new Date(new Date(baseDate).setUTCHours(12, 0, 0, 0)).toISOString() },
          { temperature: 20.0, timestamp: new Date(new Date(baseDate).setUTCHours(12, 10, 0, 0)).toISOString() },
          { temperature: 30.0, timestamp: new Date(new Date(baseDate).setUTCHours(12, 20, 0, 0)).toISOString() },
        ],
        headers,
        createdDeviceIds,
      });

      // Query with 30-minute level
      const response = await fetch(
        `${API_URL}/api/readings?startTime=${dateRanges.dayBeforeYesterday.start.toISOString()}&endTime=${dateRanges.dayBeforeYesterday.end.toISOString()}&type=temperature&level=${encodeURIComponent('30 minutes')}`,
        { headers }
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as ReadingsResponse;

      const deviceReadings = data.values.find(d => d.id === deviceId);
      expect(deviceReadings).toBeDefined();
      expect(deviceReadings!.values).toHaveLength(1); // All 3 readings in one 30-min bucket

      const bucket = deviceReadings!.values[0];
      expect(bucket.avg).toBe(20); // (10 + 20 + 30) / 3
      expect(bucket.min).toBe(10);
      expect(bucket.max).toBe(30);

      // Verify time bucket is 12:00
      expect(bucket.timestamp).toContain('12:00:00');
    });

    it('should separate readings into correct day buckets', async () => {
      const day1 = dateRanges.dayBeforeYesterday.start;
      const day2 = dateRanges.yesterday.start;
      const deviceId = await createTestDeviceWithReadings({
        deviceOrder: 9998,
        deviceName: 'Day Bucket Test Device',
        readings: [
          { temperature: 15.0, timestamp: new Date(new Date(day1).setUTCHours(12, 0, 0, 0)).toISOString() },
          { temperature: 25.0, timestamp: new Date(new Date(day2).setUTCHours(12, 0, 0, 0)).toISOString() },
        ],
        headers,
        createdDeviceIds,
      });

      // Query with day level for both days
      const startDate = toDateString(dateRanges.dayBeforeYesterday.start);
      const endDate = toDateString(dateRanges.yesterday.end);

      const response = await fetch(
        `${API_URL}/api/readings?startDate=${startDate}&endDate=${endDate}&type=temperature&level=day`,
        { headers }
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as ReadingsResponse;

      const deviceReadings = data.values.find(d => d.id === deviceId);
      expect(deviceReadings).toBeDefined();
      expect(deviceReadings!.values).toHaveLength(2); // 2 separate day buckets

      // Sort by time to ensure consistent order
      const buckets = deviceReadings!.values.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      // First day bucket
      expect(buckets[0].avg).toBe(15);
      expect(buckets[0].min).toBe(15);
      expect(buckets[0].max).toBe(15);

      // Second day bucket
      expect(buckets[1].avg).toBe(25);
      expect(buckets[1].min).toBe(25);
      expect(buckets[1].max).toBe(25);
    });

    it('should separate readings into correct month buckets', async () => {
      const deviceId = generateTestDeviceId();

      await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: deviceId,
          name: 'Month Bucket Test Device',
          location: { x: 0, y: 0, type: null },
          type: 'ruuvi',
          timezone: 'UTC',
          disabled: false,
          order: 9997,
        }),
      });

      createdDeviceIds.push(deviceId);

      // Add readings in two different months: December 2025 and January 2026
      // December: temp = 5
      await fetch(`${API_URL}/api/devices/${deviceId}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          temperature: 5.0,
          timestamp: new Date(new Date(dateRanges.december2025.start).setUTCHours(15, 0, 0, 0)).toISOString()
        }),
      });

      // January: temp = 10
      await fetch(`${API_URL}/api/devices/${deviceId}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          temperature: 10.0,
          timestamp: new Date(new Date(dateRanges.january2026.start).setUTCHours(15, 0, 0, 0)).toISOString()
        }),
      });

      // Query with month level for both months
      const startDate = toDateString(dateRanges.december2025.start);
      const endDate = toDateString(dateRanges.january2026.end);

      const response = await fetch(
        `${API_URL}/api/readings?startDate=${startDate}&endDate=${endDate}&type=temperature&level=month`,
        { headers }
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as ReadingsResponse;

      const deviceReadings = data.values.find(d => d.id === deviceId);
      expect(deviceReadings).toBeDefined();
      expect(deviceReadings!.values).toHaveLength(2); // 2 separate month buckets

      // Sort by time
      const buckets = deviceReadings!.values.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      // December bucket
      expect(buckets[0].avg).toBe(5);
      expect(buckets[0].timestamp).toContain('2025-12');

      // January bucket
      expect(buckets[1].avg).toBe(10);
      expect(buckets[1].timestamp).toContain('2026-01');
    });

    it('should return all 12 month buckets for full year 2025 seed data', async () => {
      const response = await fetch(
        `${API_URL}/api/readings?startDate=${toDateString(dateRanges.year2025.start)}&endDate=${toDateString(dateRanges.year2025.end)}&type=temperature&level=month&limit=10&offset=0`,
        { headers }
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as ReadingsResponse;
      const deviceReadings = data.values.find((d) => d.id === 'device-001');

      expect(deviceReadings).toBeDefined();
      expect(deviceReadings!.values).toHaveLength(12);
    });

    it('should separate readings into correct week buckets', async () => {
      const deviceId = generateTestDeviceId();

      await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: deviceId,
          name: 'Week Bucket Test Device',
          location: { x: 0, y: 0, type: null },
          type: 'ruuvi',
          timezone: 'UTC',
          disabled: false,
          order: 9996,
        }),
      });

      createdDeviceIds.push(deviceId);

      // Add readings in two different weeks
      // Previous week (Feb 2-8): temp = 12
      await fetch(`${API_URL}/api/devices/${deviceId}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          temperature: 12.0,
          timestamp: new Date(new Date(dateRanges.previousWeek.start).setUTCHours(12, 0, 0, 0)).toISOString()
        }),
      });

      // Current week (Feb 9-12): temp = 18
      await fetch(`${API_URL}/api/devices/${deviceId}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          temperature: 18.0,
          timestamp: new Date(new Date(dateRanges.currentWeek.start).setUTCHours(12, 0, 0, 0)).toISOString()
        }),
      });

      // Query with week level for both weeks
      const startDate = toDateString(dateRanges.previousWeek.start);
      const endDate = toDateString(dateRanges.currentWeek.end);

      const response = await fetch(
        `${API_URL}/api/readings?startDate=${startDate}&endDate=${endDate}&type=temperature&level=week`,
        { headers }
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as ReadingsResponse;

      const deviceReadings = data.values.find(d => d.id === deviceId);
      expect(deviceReadings).toBeDefined();
      expect(deviceReadings!.values).toHaveLength(2); // 2 separate week buckets

      // Sort by time
      const buckets = deviceReadings!.values.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      // Week 1
      expect(buckets[0].avg).toBe(12);

      // Week 2
      expect(buckets[1].avg).toBe(18);
    });

    it('should handle 30-minute bucket boundaries correctly', async () => {
      const deviceId = generateTestDeviceId();

      await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: deviceId,
          name: 'Bucket Boundary Test',
          location: { x: 0, y: 0, type: null },
          type: 'ruuvi',
          timezone: 'UTC',
          disabled: false,
          order: 9996,
        }),
      });

      createdDeviceIds.push(deviceId);

      const baseDate = dateRanges.dayBeforeYesterday.start;

      // Add readings at critical boundaries
      // 12:00:00 - start of bucket
      await fetch(`${API_URL}/api/devices/${deviceId}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          temperature: 10.0,
          timestamp: new Date(new Date(baseDate).setUTCHours(12, 0, 0, 0)).toISOString()
        }),
      });

      // 12:29:59 - end of first bucket
      await fetch(`${API_URL}/api/devices/${deviceId}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          temperature: 20.0,
          timestamp: new Date(new Date(baseDate).setUTCHours(12, 29, 59, 999)).toISOString()
        }),
      });

      // 12:30:00 - start of next bucket
      await fetch(`${API_URL}/api/devices/${deviceId}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          temperature: 99.0,
          timestamp: new Date(new Date(baseDate).setUTCHours(12, 30, 0, 0)).toISOString()
        }),
      });

      const response = await fetch(
        `${API_URL}/api/readings?startTime=${dateRanges.dayBeforeYesterday.start.toISOString()}&endTime=${dateRanges.dayBeforeYesterday.end.toISOString()}&type=temperature&level=${encodeURIComponent('30 minutes')}`,
        { headers }
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as ReadingsResponse;

      const deviceReadings = data.values.find(d => d.id === deviceId);
      expect(deviceReadings).toBeDefined();
      expect(deviceReadings!.values).toHaveLength(2); // 2 separate 30-min buckets

      // Sort by time
      const buckets = deviceReadings!.values.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      // First bucket (12:00-12:30): should have 10 and 20 (avg = 15)
      expect(buckets[0].avg).toBe(15); // (10 + 20) / 2
      expect(buckets[0].min).toBe(10);
      expect(buckets[0].max).toBe(20);
      expect(buckets[0].timestamp).toContain('12:00:00');

      // Second bucket (12:30-13:00): should have only 99
      expect(buckets[1].avg).toBe(99);
      expect(buckets[1].min).toBe(99);
      expect(buckets[1].max).toBe(99);
      expect(buckets[1].timestamp).toContain('12:30:00');
    });

    it('should handle day bucket boundaries correctly', async () => {
      const deviceId = generateTestDeviceId();

      await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: deviceId,
          name: 'Day Boundary Test',
          location: { x: 0, y: 0, type: null },
          type: 'ruuvi',
          timezone: 'UTC',
          disabled: false,
          order: 9995,
        }),
      });

      createdDeviceIds.push(deviceId);

      const day1 = dateRanges.dayBeforeYesterday.start;

      // 23:59:59 - end of day 1
      await fetch(`${API_URL}/api/devices/${deviceId}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          temperature: 10.0,
          timestamp: new Date(new Date(day1).setUTCHours(23, 59, 59, 999)).toISOString()
        }),
      });

      // 00:00:00 - start of day 2 (next day)
      const nextDay = new Date(day1);
      nextDay.setDate(nextDay.getDate() + 1);
      await fetch(`${API_URL}/api/devices/${deviceId}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          temperature: 20.0,
          timestamp: new Date(new Date(nextDay).setUTCHours(0, 0, 0, 0)).toISOString()
        }),
      });

      // Query both days
      const startDate = toDateString(dateRanges.dayBeforeYesterday.start);
      const endDate = toDateString(nextDay);

      const response = await fetch(
        `${API_URL}/api/readings?startDate=${startDate}&endDate=${endDate}&type=temperature&level=day`,
        { headers }
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as ReadingsResponse;

      const deviceReadings = data.values.find(d => d.id === deviceId);
      expect(deviceReadings).toBeDefined();
      expect(deviceReadings!.values).toHaveLength(2); // 2 separate day buckets

      // Sort by time
      const buckets = deviceReadings!.values.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      // Day 1: should have only 10
      expect(buckets[0].avg).toBe(10);

      // Day 2: should have only 20
      expect(buckets[1].avg).toBe(20);
    });

    it('should not mix readings from different devices', async () => {
      const device1Id = generateTestDeviceId();
      const device2Id = generateTestDeviceId();

      // Create two devices
      await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: device1Id,
          name: 'Isolation Device 1',
          location: { x: 0, y: 0, type: null },
          type: 'ruuvi',
          timezone: 'UTC',
          disabled: false,
          order: 9994,
        }),
      });

      await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: device2Id,
          name: 'Isolation Device 2',
          location: { x: 0, y: 0, type: null },
          type: 'ruuvi',
          timezone: 'UTC',
          disabled: false,
          order: 9993,
        }),
      });

      createdDeviceIds.push(device1Id, device2Id);

      const baseDate = dateRanges.dayBeforeYesterday.start;

      // Device 1: temp = 10
      await fetch(`${API_URL}/api/devices/${device1Id}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          temperature: 10.0,
          timestamp: new Date(new Date(baseDate).setUTCHours(12, 0, 0, 0)).toISOString()
        }),
      });

      // Device 2: temp = 30
      await fetch(`${API_URL}/api/devices/${device2Id}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          temperature: 30.0,
          timestamp: new Date(new Date(baseDate).setUTCHours(12, 10, 0, 0)).toISOString()
        }),
      });

      const response = await fetch(
        `${API_URL}/api/readings?startTime=${dateRanges.dayBeforeYesterday.start.toISOString()}&endTime=${dateRanges.dayBeforeYesterday.end.toISOString()}&type=temperature&level=${encodeURIComponent('30 minutes')}`,
        { headers }
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as ReadingsResponse;

      const device1Readings = data.values.find(d => d.id === device1Id);
      const device2Readings = data.values.find(d => d.id === device2Id);

      expect(device1Readings).toBeDefined();
      expect(device2Readings).toBeDefined();

      // Device 1: should have ONLY 10
      expect(device1Readings!.values[0].avg).toBe(10);
      expect(device1Readings!.values[0].min).toBe(10);
      expect(device1Readings!.values[0].max).toBe(10);

      // Device 2: should have ONLY 30
      expect(device2Readings!.values[0].avg).toBe(30);
      expect(device2Readings!.values[0].min).toBe(30);
      expect(device2Readings!.values[0].max).toBe(30);

      // Verify they're completely independent
      expect(device1Readings!.values[0].avg).not.toBe(device2Readings!.values[0].avg);
    });

    it('should return empty array for time range with no data', async () => {
      const deviceId = generateTestDeviceId();

      await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: deviceId,
          name: 'Empty Results Device',
          location: { x: 0, y: 0, type: null },
          type: 'ruuvi',
          timezone: 'UTC',
          disabled: false,
          order: 9992,
        }),
      });

      createdDeviceIds.push(deviceId);

      // Don't add any readings

      // Query for a time range with no data
      const response = await fetch(
        `${API_URL}/api/readings?startDate=${toDateString(dateRanges.dayBeforeYesterday.start)}&endDate=${toDateString(dateRanges.dayBeforeYesterday.end)}&type=temperature&level=day`,
        { headers }
      );

      expect(response.status).toBe(200); // Should succeed, not error

      const data = (await response.json()) as ReadingsResponse;

      const deviceReadings = data.values.find(d => d.id === deviceId);

      // Device might not be in results at all, or have empty values array
      if (deviceReadings) {
        expect(deviceReadings.values).toEqual([]);
      }
    });

    it('should return buckets in chronological order', async () => {
      const deviceId = generateTestDeviceId();

      await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: deviceId,
          name: 'Ordering Test Device',
          location: { x: 0, y: 0, type: null },
          type: 'ruuvi',
          timezone: 'UTC',
          disabled: false,
          order: 9991,
        }),
      });

      createdDeviceIds.push(deviceId);

      const baseDate = dateRanges.dayBeforeYesterday.start;

      // Add readings in non-chronological order
      // Add 14:00 first
      await fetch(`${API_URL}/api/devices/${deviceId}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          temperature: 20.0,
          timestamp: new Date(new Date(baseDate).setUTCHours(14, 0, 0, 0)).toISOString()
        }),
      });

      // Add 10:00 second
      await fetch(`${API_URL}/api/devices/${deviceId}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          temperature: 10.0,
          timestamp: new Date(new Date(baseDate).setUTCHours(10, 0, 0, 0)).toISOString()
        }),
      });

      // Add 12:00 third
      await fetch(`${API_URL}/api/devices/${deviceId}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          temperature: 15.0,
          timestamp: new Date(new Date(baseDate).setUTCHours(12, 0, 0, 0)).toISOString()
        }),
      });

      const response = await fetch(
        `${API_URL}/api/readings?startTime=${dateRanges.dayBeforeYesterday.start.toISOString()}&endTime=${dateRanges.dayBeforeYesterday.end.toISOString()}&type=temperature&level=${encodeURIComponent('30 minutes')}`,
        { headers }
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as ReadingsResponse;

      const deviceReadings = data.values.find(d => d.id === deviceId);
      expect(deviceReadings).toBeDefined();
      expect(deviceReadings!.values).toHaveLength(3);

      // Verify buckets are in chronological order (10:00, 12:00, 14:00)
      expect(deviceReadings!.values[0].avg).toBe(10); // 10:00
      expect(deviceReadings!.values[1].avg).toBe(15); // 12:00
      expect(deviceReadings!.values[2].avg).toBe(20); // 14:00

      // Verify times are ascending
      expect(deviceReadings!.values[0].timestamp < deviceReadings!.values[1].timestamp).toBe(true);
      expect(deviceReadings!.values[1].timestamp < deviceReadings!.values[2].timestamp).toBe(true);
    });

    it('should not include readings outside time range', async () => {
      const deviceId = generateTestDeviceId();

      await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: deviceId,
          name: 'Time Filter Test Device',
          location: { x: 0, y: 0, type: null },
          type: 'ruuvi',
          timezone: 'UTC',
          disabled: false,
          order: 9997,
        }),
      });

      createdDeviceIds.push(deviceId);

      // Add reading yesterday
      await fetch(`${API_URL}/api/devices/${deviceId}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          temperature: 15.0,
          timestamp: new Date(new Date(dateRanges.yesterday.start).setUTCHours(12, 0, 0, 0)).toISOString()
        }),
      });

      // Add reading day before yesterday (outside our query range)
      await fetch(`${API_URL}/api/devices/${deviceId}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          temperature: 99.0,
          timestamp: new Date(new Date(dateRanges.dayBeforeYesterday.start).setUTCHours(12, 0, 0, 0)).toISOString()
        }),
      });

      // Query ONLY yesterday
      const response = await fetch(
        `${API_URL}/api/readings?startDate=${toDateString(dateRanges.yesterday.start)}&endDate=${toDateString(dateRanges.yesterday.end)}&type=temperature&level=day`,
        { headers }
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as ReadingsResponse;

      const deviceReadings = data.values.find(d => d.id === deviceId);
      expect(deviceReadings).toBeDefined();
      expect(deviceReadings!.values).toHaveLength(1); // Only yesterday

      // Should NOT include the 99.0 reading from day before yesterday
      expect(deviceReadings!.values[0].avg).toBe(15);
      expect(deviceReadings!.values[0].min).toBe(15);
      expect(deviceReadings!.values[0].max).toBe(15);
    });
  });

  describe('Humidity Aggregation', () => {
    it('should correctly aggregate humidity readings', async () => {
      const deviceId = generateTestDeviceId();

      await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: deviceId,
          name: 'Humidity Test Device',
          location: { x: 0, y: 0, type: null },
          type: 'ruuvi',
          timezone: 'UTC',
          disabled: false,
          order: 9996,
        }),
      });

      createdDeviceIds.push(deviceId);

      // Add humidity readings
      const baseDate = dateRanges.dayBeforeYesterday.start;
      const readings = [40, 50, 60];

      for (let i = 0; i < readings.length; i++) {
        await fetch(`${API_URL}/api/devices/${deviceId}/readings`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            humidity: readings[i],
            timestamp: new Date(new Date(baseDate).setUTCHours(12, i * 10, 0, 0)).toISOString()
          }),
        });
      }

      const response = await fetch(
        `${API_URL}/api/readings?startTime=${dateRanges.dayBeforeYesterday.start.toISOString()}&endTime=${dateRanges.dayBeforeYesterday.end.toISOString()}&type=humidity&level=${encodeURIComponent('30 minutes')}`,
        { headers }
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as ReadingsResponse;

      const deviceReadings = data.values.find(d => d.id === deviceId);
      expect(deviceReadings).toBeDefined();

      const bucket = deviceReadings!.values[0];
      expect(bucket.avg).toBe(50); // (40 + 50 + 60) / 3
      expect(bucket.min).toBe(40);
      expect(bucket.max).toBe(60);
    });
  });

  describe('Pressure Aggregation', () => {
    it('should correctly aggregate pressure readings', async () => {
      const deviceId = generateTestDeviceId();

      await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: deviceId,
          name: 'Pressure Test Device',
          location: { x: 0, y: 0, type: null },
          type: 'ruuvi',
          timezone: 'UTC',
          disabled: false,
          order: 9995,
        }),
      });

      createdDeviceIds.push(deviceId);

      // Add pressure readings
      const baseDate = dateRanges.dayBeforeYesterday.start;
      const readings = [1000, 1010, 1020];

      for (let i = 0; i < readings.length; i++) {
        await fetch(`${API_URL}/api/devices/${deviceId}/readings`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            pressure: readings[i],
            timestamp: new Date(new Date(baseDate).setUTCHours(12, i * 10, 0, 0)).toISOString()
          }),
        });
      }

      const response = await fetch(
        `${API_URL}/api/readings?startTime=${dateRanges.dayBeforeYesterday.start.toISOString()}&endTime=${dateRanges.dayBeforeYesterday.end.toISOString()}&type=pressure&level=${encodeURIComponent('30 minutes')}`,
        { headers }
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as ReadingsResponse;

      const deviceReadings = data.values.find(d => d.id === deviceId);
      expect(deviceReadings).toBeDefined();

      const bucket = deviceReadings!.values[0];
      expect(bucket.avg).toBe(1010); // (1000 + 1010 + 1020) / 3
      expect(bucket.min).toBe(1000);
      expect(bucket.max).toBe(1020);
    });
  });

  describe('Integration with Seed Data', () => {
    it('should return readings for yesterday', async () => {
      const response = await fetch(
        `${API_URL}/api/readings?startDate=${toDateString(dateRanges.yesterday.start)}&endDate=${toDateString(dateRanges.yesterday.end)}&type=temperature&level=day`,
        { headers }
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as ReadingsResponse;

      expect(data.count).toBeGreaterThan(0);
      expect(Array.isArray(data.values)).toBe(true);

      // Verify structure and mathematical correctness
      data.values.forEach((deviceReadings) => {
        deviceReadings.values.forEach((reading) => {
          expect(reading.min).toBeLessThanOrEqual(reading.avg);
          expect(reading.avg).toBeLessThanOrEqual(reading.max);
        });
      });
    });
  });

  describe('Validation', () => {
    it('should return 400 for missing startDate', async () => {
      const response = await fetch(
        `${API_URL}/api/readings?endDate=${toDateString(dateRanges.yesterday.end)}&type=temperature&level=day`,
        { headers }
      );

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing endDate', async () => {
      const response = await fetch(
        `${API_URL}/api/readings?startDate=${toDateString(dateRanges.yesterday.start)}&type=temperature&level=day`,
        { headers }
      );

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing type', async () => {
      const response = await fetch(
        `${API_URL}/api/readings?startDate=${toDateString(dateRanges.yesterday.start)}&endDate=${toDateString(dateRanges.yesterday.end)}&level=day`,
        { headers }
      );

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing level', async () => {
      const response = await fetch(
        `${API_URL}/api/readings?startTime=${dateRanges.yesterday.start.toISOString()}&endTime=${dateRanges.yesterday.end.toISOString()}&type=temperature`,
        { headers }
      );

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid type', async () => {
      const response = await fetch(
        `${API_URL}/api/readings?startDate=${toDateString(dateRanges.yesterday.start)}&endDate=${toDateString(dateRanges.yesterday.end)}&type=invalid&level=day`,
        { headers }
      );

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid level', async () => {
      const response = await fetch(
        `${API_URL}/api/readings?startTime=${dateRanges.yesterday.start.toISOString()}&endTime=${dateRanges.yesterday.end.toISOString()}&type=temperature&level=invalid`,
        { headers }
      );

      expect(response.status).toBe(400);
    });

    it('should return 400 when startTime > endTime', async () => {
      const response = await fetch(
        `${API_URL}/api/readings?startDate=2026-02-12&endDate=2026-02-09&type=temperature&level=day`,
        { headers }
      );

      expect(response.status).toBe(400);
    });
  });

  describe('Pagination', () => {
    it('should support limit parameter', async () => {
      const response = await fetch(
        `${API_URL}/api/readings?startDate=${toDateString(dateRanges.yesterday.start)}&endDate=${toDateString(dateRanges.yesterday.end)}&type=temperature&level=day&limit=1`,
        { headers }
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as ReadingsResponse;

      expect(data.count).toBe(1);
      expect(data.values).toHaveLength(1);
    });
  });

  describe('Authentication', () => {
    it('should return 401 without auth token', async () => {
      const response = await fetch(
        `${API_URL}/api/readings?startDate=${toDateString(dateRanges.yesterday.start)}&endDate=${toDateString(dateRanges.yesterday.end)}&type=temperature&level=day`
      );

      expect(response.status).toBe(401);
    });
  });


  describe('Partial Sensor Data (null values)', () => {
    it('temperature-only reading returns no bucket for type=humidity — not an error', async () => {
      const deviceId = await createTestDeviceWithReadings({
        deviceOrder: 9968,
        readings: [
          {
            // Only temperature posted — humidity omitted entirely
            timestamp: new Date(new Date(dateRanges.dayBeforeYesterday.start).setUTCHours(10, 0, 0, 0)).toISOString(),
            temperature: 21.0,
          },
        ],
        headers,
        createdDeviceIds,
      });

      const response = await fetch(
        `${API_URL}/api/readings?startDate=${toDateString(dateRanges.dayBeforeYesterday.start)}&endDate=${toDateString(dateRanges.dayBeforeYesterday.end)}&type=humidity&level=day`,
        { headers }
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as ReadingsResponse;

      // The device appears in the response but has no humidity buckets — values is empty
      const device = data.values.find((d) => d.id === deviceId);
      if (device !== undefined) {
        expect(device.values).toHaveLength(0);
      }
      // If device is absent from the response entirely that is also acceptable
    });

    it('temperature-only reading is still included in type=temperature bucket correctly', async () => {
      const deviceId = await createTestDeviceWithReadings({
        deviceOrder: 9967,
        readings: [
          {
            timestamp: new Date(new Date(dateRanges.dayBeforeYesterday.start).setUTCHours(10, 30, 0, 0)).toISOString(),
            temperature: 15.5,
          },
        ],
        headers,
        createdDeviceIds,
      });

      const response = await fetch(
        `${API_URL}/api/readings?startDate=${toDateString(dateRanges.dayBeforeYesterday.start)}&endDate=${toDateString(dateRanges.dayBeforeYesterday.end)}&type=temperature&level=day`,
        { headers }
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as ReadingsResponse;
      const device = data.values.find((d) => d.id === deviceId);

      expect(device).toBeDefined();
      expect(device!.values).toHaveLength(1);
      expect(device!.values[0].avg).toBe(15.5);
    });
  });
});
