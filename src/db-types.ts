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
  timezone: string;
  disabled: boolean;
  sensorInfo?: string;
  latestReadingId?: string; // Timestamp of the most recent reading
}

export interface Reading {
  deviceId: string;
  timestamp: string;
  temperature?: number;
  humidity?: number;
  pressure?: number;
  lux?: number;
  battery?: number;
  pm25?: number;
  co2?: number;
  voc?: number;
  nox?: number;
}

export interface User {
  username: string;
  passwordHash: string;
  disabled: boolean;
}

export interface ApiKey {
  apiKey: string;
  description: string;
}
