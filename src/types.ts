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
}

export interface DeviceError {
  error: string;
  statusCode: number;
}
