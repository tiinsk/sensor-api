/**
 * Shared type definitions for integration tests
 * API response shapes and request payloads
 */

export interface Device {
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
  latestReadingId?: string;
}

export interface DeviceListResponse {
  count: number;
  totCount: number;
  limit: number;
  values: Device[];
}

export interface DeleteResponse {
  message: string;
}

// --- Readings (GET /api/readings aggregated) ---
export interface AggregatedReading {
  timestamp: string;
  avg: number;
  min: number;
  max: number;
}

export interface DeviceReadings {
  id: string;
  values: AggregatedReading[];
}

export interface ReadingsResponse {
  count: number;
  totCount: number;
  limit: number;
  values: DeviceReadings[];
}

// --- Device-specific readings (GET /api/devices/:id/readings) ---
export interface TypeReadings {
  type: string;
  values: AggregatedReading[];
}

export interface DeviceReadingsResponse {
  id: string;
  values: TypeReadings[];
}

// --- Statistics ---
export interface Statistics {
  avg: number | null;
  min: number | null;
  max: number | null;
}

export interface DeviceStatistics {
  id: string;
  statistics: {
    temperature: Statistics;
    humidity: Statistics;
    pressure: Statistics;
  };
}

export interface StatisticsResponse {
  count: number;
  totCount: number;
  limit: number;
  values: DeviceStatistics[];
}

export interface SingleDeviceStatistics {
  id: string;
  statistics: {
    temperature: Statistics;
    humidity: Statistics;
    pressure: Statistics;
  };
}

// --- Latest readings ---
export interface LatestReading {
  timestamp: string;
  battery: number | null;
  humidity: number | null;
  pressure: number | null;
  temperature: number | null;
}

export interface LatestDevice {
  id: string;
  name: string;
  order: number;
  reading: LatestReading | null;
}

export interface LatestReadingsResponse {
  count: number;
  totCount: number;
  limit: number;
  values: LatestDevice[];
}

// --- POST /api/devices/:id/readings response ---
export interface PostedReading {
  deviceId: string;
  timestamp: string;
  temperature?: number;
  humidity?: number;
  pressure?: number;
  battery?: number;
}
