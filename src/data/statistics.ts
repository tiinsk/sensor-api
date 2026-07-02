import {
  AllStatisticsResponse,
  ArrayRequestParams,
  DeviceStatistics,
  StatisticsRange,
} from '../api-types';
import { getAllDevices, getDevice } from './devices';
import { queryStatisticsFromRollups } from './reading-rollups';

/**
 * Get statistics for all devices within a time range
 */
const toStatisticsRange = (params: {
  startTime?: string;
  endTime?: string;
  startDate?: string;
  endDate?: string;
}): StatisticsRange =>
  params.startTime && params.endTime
    ? { startTime: params.startTime, endTime: params.endTime }
    : { startDate: params.startDate!, endDate: params.endDate! };

export async function getAllStatistics(
  params: {
    startTime?: string;
    endTime?: string;
    startDate?: string;
    endDate?: string;
  } & ArrayRequestParams
): Promise<AllStatisticsResponse> {
  const { limit, offset } = params;
  const range = toStatisticsRange(params);

  try {
    const devicesResult = await getAllDevices({ limit, offset, includeDisabled: false });

    const statisticsResults = await Promise.all(
      devicesResult.values.map(async (device): Promise<DeviceStatistics> => {
        const statistics = await queryStatisticsFromRollups({
          deviceId: device.id,
          ...range,
        });

        return {
          id: device.id,
          statistics,
        };
      })
    );

    return {
      count: statisticsResults.length,
      totCount: devicesResult.totCount,
      limit,
      values: statisticsResults,
    };
  } catch (error) {
    console.error('Failed to get all statistics:', error);
    throw error;
  }
}

/**
 * Get statistics for a single device within a time range
 */
export async function getDeviceStatistics(params: {
  startTime?: string;
  endTime?: string;
  startDate?: string;
  endDate?: string;
  deviceId: string;
}): Promise<DeviceStatistics> {
  const { deviceId } = params;
  const range = toStatisticsRange(params);

  await getDevice(params.deviceId);

  try {
    const statistics = await queryStatisticsFromRollups({
      deviceId,
      ...range,
    });

    return {
      id: deviceId,
      statistics,
    };
  } catch (error) {
    console.error(`Failed to get statistics for device ${deviceId}:`, error);
    throw error;
  }
}
