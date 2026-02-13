/**
 * Shared type definitions
 */

export interface ArrayRequestParams {
  limit: number;
  offset: number;
}

export type DeviceType = 'ruuvi' | 'sensorbug';
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
