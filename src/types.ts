/**
 * Shared type definitions
 */

export interface ArrayRequestParams {
  limit: number;
  offset: number;
}

export type DeviceType = 'ruuvi' | 'sensorbug' | 'ruuvi-air';
export type LocationType = 'inside' | 'outside' | null;

export interface DeviceLocation {
  x: number;
  y: number;
  type: LocationType;
}

export interface Device {
  id: string;
  order: number;
  name: string;
  type: DeviceType;
  location: DeviceLocation;
  disabled: boolean;
  sensorInfo?: string;
  latestReadingId?: string; // Timestamp of the most recent reading
}

export interface Reading {
  timestamp: string; // ISO 8601 timestamp (used as sort key)
  temperature: number | null;
  humidity: number | null;
  pressure: number | null;
  battery: number | null;
  pm25?: number | null;
  co2?: number | null;
  voc?: number | null;
  nox?: number | null;
  airQuality?: number | null;
}

export interface User {
  username: string;
  passwordHash: string;
  salt: string;
  disabled: boolean;
}

export interface ApiKey {
  apiKey: string;
  deviceId?: string | null;
  description: string;
}
