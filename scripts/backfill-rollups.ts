import {
  BatchWriteCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { sensorTypes } from '../src/api-types';
import { TABLES, DEFAULT_DEVICE_TIMEZONE } from '../src/config/constants';
import {
  getRollupBucketKey,
  getRollupBucketStart,
  mergeRollupStats,
} from '../src/data/reading-rollups';
import type {
  Device,
  Reading,
  ReadingRollup,
  ReadingRollupLevel,
} from '../src/db-types';
import { createDynamoDBClient } from '../src/lib/db-client';
import { airQualityFromPm25Co2 } from '../src/utils/air-quality';

const docClient = createDynamoDBClient();
const rollupLevels: ReadingRollupLevel[] = ['30m', 'day'];
const WRITE_BATCH_SIZE = 25;
const BATCH_RETRY_DELAY_MS = 200;
const READ_PROGRESS_INTERVAL = 10_000;

interface BackfillDeviceStats {
  readingCount: number;
  rollupCount: number;
  pageCount: number;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

type ActiveRollups = Partial<Record<ReadingRollupLevel, ReadingRollup>>;
type PendingWrites = Map<string, ReadingRollup>;

const formatDuration = (startedAt: number): string => {
  const seconds = Math.round((Date.now() - startedAt) / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) return `${seconds}s`;

  return `${minutes}m ${remainingSeconds}s`;
};

const getAllDevices = async (): Promise<Device[]> => {
  const devices: Device[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLES.DEVICES,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    devices.push(...((result.Items || []) as Device[]));
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return devices;
};

const getPendingWriteKey = (rollup: ReadingRollup): string =>
  `${rollup.deviceId}#${rollup.bucketKey}`;

const getSensorValue = (
  reading: Reading,
  type: typeof sensorTypes[number]
): number | undefined => {
  if (type === 'airQuality') {
    return airQualityFromPm25Co2(reading.pm25, reading.co2);
  }

  return reading[type];
};

const mergeReadingToRollup = (
  rollup: ReadingRollup,
  reading: Reading
): ReadingRollup => {
  return sensorTypes.reduce<ReadingRollup>((nextRollup, type) => {
    const value = getSensorValue(reading, type);
    if (value === undefined) return nextRollup;

    return {
      ...nextRollup,
      [type]: mergeRollupStats(nextRollup[type], {
        avg: value,
        min: value,
        max: value,
        count: 1,
      }),
    };
  }, rollup);
};

const mergeRollups = (
  existing: ReadingRollup,
  next: ReadingRollup
): ReadingRollup => {
  return sensorTypes.reduce<ReadingRollup>((rollup, type) => {
    const nextStats = next[type];
    if (!nextStats) return rollup;

    return {
      ...rollup,
      [type]: mergeRollupStats(rollup[type], nextStats),
    };
  }, existing);
};

const addPendingWrite = (
  pendingWrites: PendingWrites,
  rollup: ReadingRollup
): void => {
  const key = getPendingWriteKey(rollup);
  const existing = pendingWrites.get(key);

  pendingWrites.set(key, existing ? mergeRollups(existing, rollup) : rollup);
};

const createRollup = (
  reading: Reading,
  level: ReadingRollupLevel,
  timezone: string
): ReadingRollup => {
  const bucketKey = getRollupBucketKey(reading.timestamp, level, timezone);

  return {
    deviceId: reading.deviceId,
    bucketKey,
    level,
    bucketStart: getRollupBucketStart(reading.timestamp, level, timezone),
    timezone,
  };
};

const addReadingToRollup = (
  activeRollups: ActiveRollups,
  pendingWrites: PendingWrites,
  reading: Reading,
  level: ReadingRollupLevel,
  timezone: string
): void => {
  const bucketKey = getRollupBucketKey(reading.timestamp, level, timezone);
  const currentRollup = activeRollups[level];

  if (currentRollup && currentRollup.bucketKey !== bucketKey) {
    addPendingWrite(pendingWrites, currentRollup);
  }

  const rollup =
    currentRollup?.bucketKey === bucketKey
      ? currentRollup
      : createRollup(reading, level, timezone);

  activeRollups[level] = mergeReadingToRollup(rollup, reading);
};

const addReadingToAllRollups = (
  activeRollups: ActiveRollups,
  pendingWrites: PendingWrites,
  reading: Reading,
  timezone: string
): void => {
  rollupLevels.forEach((level) => {
    addReadingToRollup(
      activeRollups,
      pendingWrites,
      reading,
      level,
      timezone
    );
  });
};

const writeRollupBatch = async (rollups: ReadingRollup[]): Promise<void> => {
  if (rollups.length === 0) return;

  let requestItems = {
    [TABLES.READING_ROLLUPS]: rollups.map((rollup) => ({
      PutRequest: {
        Item: rollup,
      },
    })),
  };

  do {
    const result = await docClient.send(
      new BatchWriteCommand({
        RequestItems: requestItems,
      })
    );

    requestItems = result.UnprocessedItems as typeof requestItems;
    if (requestItems?.[TABLES.READING_ROLLUPS]?.length) {
      console.log(
        `Retrying ${requestItems[TABLES.READING_ROLLUPS].length} unprocessed rollup writes...`
      );
      await sleep(BATCH_RETRY_DELAY_MS);
    }
  } while (requestItems?.[TABLES.READING_ROLLUPS]?.length);
};

const writeRollups = async (rollups: ReadingRollup[]): Promise<void> => {
  for (let index = 0; index < rollups.length; index += WRITE_BATCH_SIZE) {
    await writeRollupBatch(rollups.slice(index, index + WRITE_BATCH_SIZE));
  }
};

const flushPendingWrites = async (
  pendingWrites: PendingWrites,
  flushAll = false
): Promise<number> => {
  const writableCount = flushAll
    ? pendingWrites.size
    : Math.floor(pendingWrites.size / WRITE_BATCH_SIZE) * WRITE_BATCH_SIZE;

  if (writableCount === 0) return 0;

  const rollups = Array.from(pendingWrites.values()).slice(0, writableCount);
  rollups.forEach((rollup) => {
    pendingWrites.delete(getPendingWriteKey(rollup));
  });

  await writeRollups(rollups);
  return rollups.length;
};

const logDeviceProgress = (params: {
  device: Device;
  deviceIndex: number;
  deviceCount: number;
  readingCount: number;
  rollupCount: number;
  pageCount: number;
  pendingWriteCount: number;
  startedAt: number;
}): void => {
  console.log(
    [
      `[${params.deviceIndex}/${params.deviceCount}] ${params.device.id}`,
      `${params.readingCount} readings processed`,
      `${params.rollupCount} rollups written`,
      `${params.pendingWriteCount} rollups pending`,
      `${params.pageCount} query pages`,
      formatDuration(params.startedAt),
    ].join(' | ')
  );
};

const backfillDeviceReadings = async (
  device: Device,
  deviceIndex: number,
  deviceCount: number
): Promise<BackfillDeviceStats> => {
  const timezone = device.timezone ?? DEFAULT_DEVICE_TIMEZONE;
  const activeRollups: ActiveRollups = {};
  const pendingWrites: PendingWrites = new Map();
  let readingCount = 0;
  let rollupCount = 0;
  let pageCount = 0;
  let nextProgressLogAt = READ_PROGRESS_INTERVAL;
  let lastEvaluatedKey: Record<string, unknown> | undefined;
  const startedAt = Date.now();

  console.log(
    `[${deviceIndex}/${deviceCount}] Starting ${device.id} (${timezone})...`
  );

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.READINGS,
        KeyConditionExpression: 'deviceId = :deviceId',
        ExpressionAttributeValues: {
          ':deviceId': device.id,
        },
        ScanIndexForward: true,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    const readings = (result.Items || []) as Reading[];
    pageCount += 1;

    for (const reading of readings) {
      addReadingToAllRollups(
        activeRollups,
        pendingWrites,
        reading,
        timezone
      );
      rollupCount += await flushPendingWrites(pendingWrites);
    }

    readingCount += readings.length;
    lastEvaluatedKey = result.LastEvaluatedKey;

    if (readingCount >= nextProgressLogAt || !lastEvaluatedKey) {
      logDeviceProgress({
        device,
        deviceIndex,
        deviceCount,
        readingCount,
        rollupCount,
        pageCount,
        pendingWriteCount: pendingWrites.size,
        startedAt,
      });

      while (nextProgressLogAt <= readingCount) {
        nextProgressLogAt += READ_PROGRESS_INTERVAL;
      }
    }
  } while (lastEvaluatedKey);

  Object.values(activeRollups).forEach((rollup) => {
    addPendingWrite(pendingWrites, rollup);
  });
  rollupCount += await flushPendingWrites(pendingWrites, true);

  console.log(
    `[${deviceIndex}/${deviceCount}] Finished ${device.id}: wrote ${rollupCount} rollups from ${readingCount} readings in ${formatDuration(startedAt)}`
  );

  return {
    readingCount,
    rollupCount,
    pageCount,
  };
};

const run = async () => {
  const startedAt = Date.now();
  const devices = await getAllDevices();
  let totalReadings = 0;
  let totalRollups = 0;
  let totalPages = 0;

  console.log(`Backfilling reading rollups for ${devices.length} devices...`);

  for (const [index, device] of devices.entries()) {
    const stats = await backfillDeviceReadings(
      device,
      index + 1,
      devices.length
    );
    totalReadings += stats.readingCount;
    totalRollups += stats.rollupCount;
    totalPages += stats.pageCount;
  }

  console.log(
    `Reading rollup backfill complete: wrote ${totalRollups} rollups from ${totalReadings} readings across ${totalPages} query pages in ${formatDuration(startedAt)}.`
  );
};

run().catch((error) => {
  console.error('Reading rollup backfill failed:', error);
  process.exit(1);
});
