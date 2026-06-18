const mockSend = jest.fn();

jest.mock('../../src/lib/db-client', () => ({
  createDynamoDBClient: () => ({
    send: mockSend,
  }),
}));

import { queryAllReadingsInRange } from '../../src/data/readings';

describe('queryAllReadingsInRange', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it('paginates through all DynamoDB query pages', async () => {
    mockSend
      .mockResolvedValueOnce({
        Items: [
          { deviceId: 'device-001', timestamp: '2025-01-01T00:00:00.000Z', temperature: 10 },
          { deviceId: 'device-001', timestamp: '2025-02-01T00:00:00.000Z', temperature: 11 },
        ],
        LastEvaluatedKey: {
          deviceId: 'device-001',
          timestamp: '2025-02-01T00:00:00.000Z',
        },
      })
      .mockResolvedValueOnce({
        Items: [
          { deviceId: 'device-001', timestamp: '2025-03-01T00:00:00.000Z', temperature: 12 },
        ],
      });

    const readings = await queryAllReadingsInRange({
      deviceId: 'device-001',
      startTime: '2025-01-01T00:00:00.000Z',
      endTime: '2025-12-31T23:59:59.999Z',
    });

    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(readings).toHaveLength(3);
    expect(readings.map((r) => r.timestamp)).toEqual([
      '2025-01-01T00:00:00.000Z',
      '2025-02-01T00:00:00.000Z',
      '2025-03-01T00:00:00.000Z',
    ]);
  });

  it('returns empty array when no readings match', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });

    const readings = await queryAllReadingsInRange({
      deviceId: 'device-001',
      startTime: '2025-01-01T00:00:00.000Z',
      endTime: '2025-12-31T23:59:59.999Z',
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(readings).toEqual([]);
  });
});
