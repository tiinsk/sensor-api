import type { Reading } from './db-types';

export interface ArrayRequestParams {
  limit: number;
  offset: number;
}

export type SensorType =
  | 'temperature'
  | 'humidity'
  | 'pressure'
  | 'lux'
  | 'battery'
  | 'pm25'
  | 'co2'
  | 'voc'
  | 'nox'
  | 'airQuality';

export type TimeLevel = '30 minutes' | 'day' | 'week' | 'month';

export interface TimedAvgMinMax {
  timestamp: string;
  avg: number;
  min: number;
  max: number;
}

export interface SensorReadings {
  type: SensorType;
  values: TimedAvgMinMax[];
}

export interface DeviceReadingsResponse {
  id: string;
  values: SensorReadings[];
}

export interface AllReadingsResponse {
  count: number;
  totCount: number;
  limit: number;
  values: {
    id: string;
    values: TimedAvgMinMax[];
  }[];
}

export type CreatedReadingResponse = Reading & {
  airQuality?: number;
};

export type LatestReading = Omit<Reading, 'deviceId'> & {
  airQuality?: number;
};

export interface AvgMinMax {
  avg: number | null;
  min: number | null;
  max: number | null;
}

export interface SensorStatistics {
  temperature: AvgMinMax;
  humidity: AvgMinMax;
  pressure: AvgMinMax;
  pm25: AvgMinMax;
  co2: AvgMinMax;
  voc: AvgMinMax;
  nox: AvgMinMax;
  airQuality: AvgMinMax;
}

export interface DeviceStatistics {
  id: string;
  statistics: SensorStatistics;
}

export interface AllStatisticsResponse {
  count: number;
  totCount: number;
  limit: number;
  values: DeviceStatistics[];
}
