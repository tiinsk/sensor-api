/**
 * Integration tests for GET /api/readings
 * Tests aggregated readings with exact value verification
 */

import { getApiUrl } from './test-config';
import { getAuthHeaders, RequestHeaders } from './auth-utils';
import { generateTestDeviceId, deleteTestDevices } from '../utils/device-helpers';
import { getTestDateRanges } from '../utils/test-data';

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

interface ReadingsResponse {
  count: number;
  totCount: number;
  limit: number;
  values: DeviceReadings[];
}

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
      const deviceId = generateTestDeviceId();

      // Create device
      await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: deviceId,
          name: '30min Test Device',
          location: { x: 0, y: 0, type: null },
          type: 'ruuvi',
          disabled: false,
          order: 9999,
        }),
      });

      createdDeviceIds.push(deviceId);

      // Add 3 readings within same 30-min window (12:00-12:30)
      const baseDate = dateRanges.dayBeforeYesterday.start;
      await fetch(`${API_URL}/api/devices/${deviceId}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          temperature: 10.0,
          timestamp: new Date(new Date(baseDate).setUTCHours(12, 0, 0, 0)).toISOString()
        }),
      });

      await fetch(`${API_URL}/api/devices/${deviceId}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          temperature: 20.0,
          timestamp: new Date(new Date(baseDate).setUTCHours(12, 10, 0, 0)).toISOString()
        }),
      });

      await fetch(`${API_URL}/api/devices/${deviceId}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          temperature: 30.0,
          timestamp: new Date(new Date(baseDate).setUTCHours(12, 20, 0, 0)).toISOString()
        }),
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
      expect(bucket.time).toContain('12:00:00');
    });

    it('should separate readings into correct day buckets', async () => {
      const deviceId = generateTestDeviceId();

      await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: deviceId,
          name: 'Day Bucket Test Device',
          location: { x: 0, y: 0, type: null },
          type: 'ruuvi',
          disabled: false,
          order: 9998,
        }),
      });

      createdDeviceIds.push(deviceId);

      // Add readings on two different days
      const day1 = dateRanges.dayBeforeYesterday.start;
      const day2 = dateRanges.yesterday.start;

      // Day 1: temp = 15
      await fetch(`${API_URL}/api/devices/${deviceId}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          temperature: 15.0,
          timestamp: new Date(new Date(day1).setUTCHours(12, 0, 0, 0)).toISOString()
        }),
      });

      // Day 2: temp = 25
      await fetch(`${API_URL}/api/devices/${deviceId}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          temperature: 25.0,
          timestamp: new Date(new Date(day2).setUTCHours(12, 0, 0, 0)).toISOString()
        }),
      });

      // Query with day level for both days
      const startTime = dateRanges.dayBeforeYesterday.start.toISOString();
      const endTime = dateRanges.yesterday.end.toISOString();

      const response = await fetch(
        `${API_URL}/api/readings?startTime=${startTime}&endTime=${endTime}&type=temperature&level=day`,
        { headers }
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as ReadingsResponse;

      const deviceReadings = data.values.find(d => d.id === deviceId);
      expect(deviceReadings).toBeDefined();
      expect(deviceReadings!.values).toHaveLength(2); // 2 separate day buckets

      // Sort by time to ensure consistent order
      const buckets = deviceReadings!.values.sort((a, b) => a.time.localeCompare(b.time));

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
      const startTime = dateRanges.december2025.start.toISOString();
      const endTime = dateRanges.january2026.end.toISOString();

      const response = await fetch(
        `${API_URL}/api/readings?startTime=${startTime}&endTime=${endTime}&type=temperature&level=month`,
        { headers }
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as ReadingsResponse;

      const deviceReadings = data.values.find(d => d.id === deviceId);
      expect(deviceReadings).toBeDefined();
      expect(deviceReadings!.values).toHaveLength(2); // 2 separate month buckets

      // Sort by time
      const buckets = deviceReadings!.values.sort((a, b) => a.time.localeCompare(b.time));

      // December bucket
      expect(buckets[0].avg).toBe(5);
      expect(buckets[0].time).toContain('2025-12');

      // January bucket
      expect(buckets[1].avg).toBe(10);
      expect(buckets[1].time).toContain('2026-01');
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
      const startTime = dateRanges.previousWeek.start.toISOString();
      const endTime = dateRanges.currentWeek.end.toISOString();

      const response = await fetch(
        `${API_URL}/api/readings?startTime=${startTime}&endTime=${endTime}&type=temperature&level=week`,
        { headers }
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as ReadingsResponse;

      const deviceReadings = data.values.find(d => d.id === deviceId);
      expect(deviceReadings).toBeDefined();
      expect(deviceReadings!.values).toHaveLength(2); // 2 separate week buckets

      // Sort by time
      const buckets = deviceReadings!.values.sort((a, b) => a.time.localeCompare(b.time));

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
      const buckets = deviceReadings!.values.sort((a, b) => a.time.localeCompare(b.time));

      // First bucket (12:00-12:30): should have 10 and 20 (avg = 15)
      expect(buckets[0].avg).toBe(15); // (10 + 20) / 2
      expect(buckets[0].min).toBe(10);
      expect(buckets[0].max).toBe(20);
      expect(buckets[0].time).toContain('12:00:00');

      // Second bucket (12:30-13:00): should have only 99
      expect(buckets[1].avg).toBe(99);
      expect(buckets[1].min).toBe(99);
      expect(buckets[1].max).toBe(99);
      expect(buckets[1].time).toContain('12:30:00');
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
      const startTime = dateRanges.dayBeforeYesterday.start.toISOString();
      const endTime = new Date(new Date(nextDay).setUTCHours(23, 59, 59, 999)).toISOString();

      const response = await fetch(
        `${API_URL}/api/readings?startTime=${startTime}&endTime=${endTime}&type=temperature&level=day`,
        { headers }
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as ReadingsResponse;

      const deviceReadings = data.values.find(d => d.id === deviceId);
      expect(deviceReadings).toBeDefined();
      expect(deviceReadings!.values).toHaveLength(2); // 2 separate day buckets

      // Sort by time
      const buckets = deviceReadings!.values.sort((a, b) => a.time.localeCompare(b.time));

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
          disabled: false,
          order: 9992,
        }),
      });

      createdDeviceIds.push(deviceId);

      // Don't add any readings

      // Query for a time range with no data
      const response = await fetch(
        `${API_URL}/api/readings?startTime=${dateRanges.dayBeforeYesterday.start.toISOString()}&endTime=${dateRanges.dayBeforeYesterday.end.toISOString()}&type=temperature&level=day`,
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
      expect(deviceReadings!.values[0].time < deviceReadings!.values[1].time).toBe(true);
      expect(deviceReadings!.values[1].time < deviceReadings!.values[2].time).toBe(true);
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
        `${API_URL}/api/readings?startTime=${dateRanges.yesterday.start.toISOString()}&endTime=${dateRanges.yesterday.end.toISOString()}&type=temperature&level=day`,
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
        `${API_URL}/api/readings?startTime=${dateRanges.yesterday.start.toISOString()}&endTime=${dateRanges.yesterday.end.toISOString()}&type=temperature&level=day`,
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
    it('should return 400 for missing startTime', async () => {
      const response = await fetch(
        `${API_URL}/api/readings?endTime=${dateRanges.yesterday.end.toISOString()}&type=temperature&level=day`,
        { headers }
      );

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing endTime', async () => {
      const response = await fetch(
        `${API_URL}/api/readings?startTime=${dateRanges.yesterday.start.toISOString()}&type=temperature&level=day`,
        { headers }
      );

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing type', async () => {
      const response = await fetch(
        `${API_URL}/api/readings?startTime=${dateRanges.yesterday.start.toISOString()}&endTime=${dateRanges.yesterday.end.toISOString()}&level=day`,
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
        `${API_URL}/api/readings?startTime=${dateRanges.yesterday.start.toISOString()}&endTime=${dateRanges.yesterday.end.toISOString()}&type=invalid&level=day`,
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
        `${API_URL}/api/readings?startTime=2026-02-12T10:00:00.000Z&endTime=2026-02-09T00:00:00.000Z&type=temperature&level=day`,
        { headers }
      );

      expect(response.status).toBe(400);
    });
  });

  describe('Pagination', () => {
    it('should support limit parameter', async () => {
      const response = await fetch(
        `${API_URL}/api/readings?startTime=${dateRanges.yesterday.start.toISOString()}&endTime=${dateRanges.yesterday.end.toISOString()}&type=temperature&level=day&limit=1`,
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
        `${API_URL}/api/readings?startTime=${dateRanges.yesterday.start.toISOString()}&endTime=${dateRanges.yesterday.end.toISOString()}&type=temperature&level=day`
      );

      expect(response.status).toBe(401);
    });
  });

  // Helsinki is UTC+2 in winter (EET). Midnight Helsinki = 22:00 UTC previous day.
  // These tests verify that the timezone parameter shifts day/week/month bucket boundaries
  // to align with Helsinki time, not UTC.
  describe('Helsinki Timezone Bucketing (Europe/Helsinki)', () => {
    // Two readings that straddle the Helsinki day boundary (22:00 UTC = 00:00 EET):
    // Reading A: 2026-02-10T21:59:59Z = Feb 10 23:59:59 EET → Helsinki day: Feb 10
    // Reading B: 2026-02-10T22:00:00Z = Feb 11 00:00:00 EET → Helsinki day: Feb 11
    // Without Helsinki tz both are in the same UTC day (Feb 10 UTC).
    const HELSINKI_FEB_10 = '2026-02-10T21:59:59.000Z'; // 23:59:59 EET Feb 10
    const HELSINKI_FEB_11 = '2026-02-10T22:00:00.000Z'; // 00:00:00 EET Feb 11

    async function createDeviceWithTwoReadings(opts: {
      deviceOrder: number;
      readings: [
        { timestamp: string; temperature: number },
        { timestamp: string; temperature: number },
      ];
    }): Promise<string> {
      const deviceId = generateTestDeviceId();
      await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: deviceId,
          name: 'TZ Test Device',
          location: { x: 0, y: 0, type: null },
          type: 'ruuvi',
          disabled: false,
          order: opts.deviceOrder,
        }),
      });
      createdDeviceIds.push(deviceId);

      for (const reading of opts.readings) {
        await fetch(`${API_URL}/api/devices/${deviceId}/readings`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ temperature: reading.temperature, timestamp: reading.timestamp }),
        });
      }

      return deviceId;
    }

    it('day level: readings on same UTC day fall into separate Helsinki day buckets', async () => {
      const deviceId = await createDeviceWithTwoReadings({
        deviceOrder: 9880,
        readings: [
          { timestamp: HELSINKI_FEB_10, temperature: 10 }, // 23:59:59 EET Feb 10 → Helsinki day Feb 10
          { timestamp: HELSINKI_FEB_11, temperature: 20 }, // 00:00:00 EET Feb 11 → Helsinki day Feb 11
        ],
      });

      // Wide query range that includes both readings
      const response = await fetch(
        `${API_URL}/api/readings?startTime=2026-02-09T22:00:00.000Z&endTime=2026-02-11T21:59:59.999Z&type=temperature&level=day&timezone=Europe%2FHelsinki`,
        { headers }
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as ReadingsResponse;
      const device = data.values.find((d) => d.id === deviceId);
      expect(device).toBeDefined();

      // Must be 2 separate day buckets (Feb 10 and Feb 11 Helsinki)
      expect(device!.values).toHaveLength(2);

      const buckets = device!.values.sort((a, b) => a.time.localeCompare(b.time));

      // Feb 10 Helsinki bucket starts at 22:00 UTC Feb 9
      expect(buckets[0].time).toBe('2026-02-09T22:00:00.000Z');
      expect(buckets[0].avg).toBe(10);

      // Feb 11 Helsinki bucket starts at 22:00 UTC Feb 10
      expect(buckets[1].time).toBe('2026-02-10T22:00:00.000Z');
      expect(buckets[1].avg).toBe(20);
    });

    it('day level: without timezone both readings fall into the same UTC day bucket', async () => {
      const deviceId = await createDeviceWithTwoReadings({
        deviceOrder: 9879,
        readings: [
          { timestamp: HELSINKI_FEB_10, temperature: 10 }, // 23:59:59 EET Feb 10
          { timestamp: HELSINKI_FEB_11, temperature: 20 }, // 00:00:00 EET Feb 11
        ],
      });

      // Same query but no timezone parameter (defaults to UTC)
      const response = await fetch(
        `${API_URL}/api/readings?startTime=2026-02-09T22:00:00.000Z&endTime=2026-02-11T21:59:59.999Z&type=temperature&level=day`,
        { headers }
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as ReadingsResponse;
      const device = data.values.find((d) => d.id === deviceId);
      expect(device).toBeDefined();

      // Both in the same UTC day bucket (Feb 10 UTC)
      expect(device!.values).toHaveLength(1);
      expect(device!.values[0].time).toBe('2026-02-10T00:00:00.000Z');
      expect(device!.values[0].avg).toBe(15); // (10 + 20) / 2
    });

    it('week level: readings on same UTC Sunday fall into separate Helsinki week buckets', async () => {
      // Feb 8 is a Sunday.
      // Reading A: 2026-02-08T21:59:59Z = Sun Feb 8 23:59:59 EET → Helsinki week: Mon Feb 2
      // Reading B: 2026-02-08T22:00:00Z = Mon Feb 9 00:00:00 EET → Helsinki week: Mon Feb 9
      // Without Helsinki tz: Feb 8 22:00 UTC is still Sunday UTC → both in week of Mon Feb 2

      const deviceId = await createDeviceWithTwoReadings({
        deviceOrder: 9878,
        readings: [
          { timestamp: '2026-02-08T21:59:59.000Z', temperature: 10 }, // 23:59:59 EET Sun Feb 8 → week of Mon Feb 2
          { timestamp: '2026-02-08T22:00:00.000Z', temperature: 20 }, // 00:00:00 EET Mon Feb 9 → week of Mon Feb 9
        ],
      });

      const response = await fetch(
        `${API_URL}/api/readings?startTime=2026-02-01T00:00:00.000Z&endTime=2026-02-15T00:00:00.000Z&type=temperature&level=week&timezone=Europe%2FHelsinki`,
        { headers }
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as ReadingsResponse;
      const device = data.values.find((d) => d.id === deviceId);
      expect(device).toBeDefined();

      // Must be 2 separate week buckets
      expect(device!.values).toHaveLength(2);

      const buckets = device!.values.sort((a, b) => a.time.localeCompare(b.time));

      // Week of Mon Feb 2 (Helsinki) starts at Sun Feb 1 22:00 UTC
      expect(buckets[0].time).toBe('2026-02-01T22:00:00.000Z');
      expect(buckets[0].avg).toBe(10);

      // Week of Mon Feb 9 (Helsinki) starts at Sun Feb 8 22:00 UTC
      expect(buckets[1].time).toBe('2026-02-08T22:00:00.000Z');
      expect(buckets[1].avg).toBe(20);
    });

    it('week level: without timezone both Sunday readings fall into the same UTC week bucket', async () => {
      const deviceId = await createDeviceWithTwoReadings({
        deviceOrder: 9877,
        readings: [
          { timestamp: '2026-02-08T21:59:59.000Z', temperature: 10 }, // 23:59:59 EET Sun Feb 8
          { timestamp: '2026-02-08T22:00:00.000Z', temperature: 20 }, // 00:00:00 EET Mon Feb 9
        ],
      });

      const response = await fetch(
        `${API_URL}/api/readings?startTime=2026-02-01T00:00:00.000Z&endTime=2026-02-15T00:00:00.000Z&type=temperature&level=week`,
        { headers }
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as ReadingsResponse;
      const device = data.values.find((d) => d.id === deviceId);
      expect(device).toBeDefined();

      // Both on Sunday Feb 8 UTC → same week (Mon Feb 2 UTC)
      expect(device!.values).toHaveLength(1);
      expect(device!.values[0].time).toBe('2026-02-02T00:00:00.000Z');
      expect(device!.values[0].avg).toBe(15); // (10 + 20) / 2
    });

    it('month level: readings on same UTC Jan 31 fall into separate Helsinki month buckets', async () => {
      // Reading A: 2026-01-31T21:59:59Z = Jan 31 23:59:59 EET → Helsinki month: January
      // Reading B: 2026-01-31T22:00:00Z = Feb 1  00:00:00 EET → Helsinki month: February
      // Without Helsinki tz: both are Jan 31 UTC → same January bucket

      const deviceId = await createDeviceWithTwoReadings({
        deviceOrder: 9876,
        readings: [
          { timestamp: '2026-01-31T21:59:59.000Z', temperature: 10 }, // 23:59:59 EET Jan 31 → Helsinki month January
          { timestamp: '2026-01-31T22:00:00.000Z', temperature: 20 }, // 00:00:00 EET Feb 1  → Helsinki month February
        ],
      });

      const response = await fetch(
        `${API_URL}/api/readings?startTime=2025-12-31T22:00:00.000Z&endTime=2026-02-28T22:00:00.000Z&type=temperature&level=month&timezone=Europe%2FHelsinki`,
        { headers }
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as ReadingsResponse;
      const device = data.values.find((d) => d.id === deviceId);
      expect(device).toBeDefined();

      // Must be 2 separate month buckets (January and February Helsinki)
      expect(device!.values).toHaveLength(2);

      const buckets = device!.values.sort((a, b) => a.time.localeCompare(b.time));

      // January Helsinki bucket starts at Dec 31 22:00 UTC
      expect(buckets[0].time).toBe('2025-12-31T22:00:00.000Z');
      expect(buckets[0].avg).toBe(10);

      // February Helsinki bucket starts at Jan 31 22:00 UTC
      expect(buckets[1].time).toBe('2026-01-31T22:00:00.000Z');
      expect(buckets[1].avg).toBe(20);
    });

    it('month level: without timezone both readings fall into the same UTC January bucket', async () => {
      const deviceId = await createDeviceWithTwoReadings({
        deviceOrder: 9875,
        readings: [
          { timestamp: '2026-01-31T21:59:59.000Z', temperature: 10 }, // 23:59:59 EET Jan 31
          { timestamp: '2026-01-31T22:00:00.000Z', temperature: 20 }, // 00:00:00 EET Feb 1
        ],
      });

      const response = await fetch(
        `${API_URL}/api/readings?startTime=2025-12-31T22:00:00.000Z&endTime=2026-02-28T22:00:00.000Z&type=temperature&level=month`,
        { headers }
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as ReadingsResponse;
      const device = data.values.find((d) => d.id === deviceId);
      expect(device).toBeDefined();

      // Both on Jan 31 UTC → same January UTC bucket
      expect(device!.values).toHaveLength(1);
      expect(device!.values[0].time).toBe('2026-01-01T00:00:00.000Z');
      expect(device!.values[0].avg).toBe(15); // (10 + 20) / 2
    });
  });
});
