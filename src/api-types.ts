import type { Reading } from './db-types';

export interface ArrayRequestParams {
  limit: number;
  offset: number;
}

export const readingSensorFields = [
  'temperature',
  'humidity',
  'pressure',
  'battery',
  'pm25',
  'co2',
  'voc',
  'nox',
] as const;

export const sensorTypes = [...readingSensorFields, 'airQuality'] as const;

export type ReadingSensorField = typeof readingSensorFields[number];
export type SensorType = typeof sensorTypes[number];

export type TimeLevel = '30 minutes' | 'day' | 'week' | 'month';
export type DateLevel = Exclude<TimeLevel, '30 minutes'>;

export type ReadingRange =
  | {
      level: '30 minutes';
      startTime: string;
      endTime: string;
    }
  | {
      level: DateLevel;
      startDate: string;
      endDate: string;
    };

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
