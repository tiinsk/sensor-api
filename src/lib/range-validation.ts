import { z } from 'zod';

export const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: 'Expected date in YYYY-MM-DD format',
});

export const isValidTimeRange = (data: {
  startTime: string;
  endTime: string;
}): boolean => {
  const start = new Date(data.startTime);
  const end = new Date(data.endTime);
  return start <= end;
};

export const isValidDateRange = (data: {
  startDate: string;
  endDate: string;
}): boolean => data.startDate <= data.endDate;

export const timeRangeError = {
  message: 'startTime must be before or equal to endTime',
  path: ['startTime'],
} as const;

export const dateRangeError = {
  message: 'startDate must be before or equal to endDate',
  path: ['startDate'],
} as const;

export const addRangeValidationIssue = (
  ctx: z.RefinementCtx,
  message: string,
  path: string[]
) => {
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message,
    path,
  });
};

export const validateRangeForLevel = (
  data: {
    level: '30 minutes' | 'day' | 'week' | 'month';
    startTime?: string;
    endTime?: string;
    startDate?: string;
    endDate?: string;
  },
  ctx: z.RefinementCtx
) => {
  if (data.level === '30 minutes') {
    if (!data.startTime || !data.endTime) {
      addRangeValidationIssue(
        ctx,
        'level=30 minutes requires startTime and endTime',
        ['startTime']
      );
      return;
    }

    if (!isValidTimeRange({ startTime: data.startTime, endTime: data.endTime })) {
      addRangeValidationIssue(ctx, timeRangeError.message, [...timeRangeError.path]);
    }

    return;
  }

  if (!data.startDate || !data.endDate) {
    addRangeValidationIssue(
      ctx,
      `level=${data.level} requires startDate and endDate`,
      ['startDate']
    );
    return;
  }

  if (!isValidDateRange({ startDate: data.startDate, endDate: data.endDate })) {
    addRangeValidationIssue(ctx, dateRangeError.message, [...dateRangeError.path]);
  }
};

export const validateStatisticsRange = (
  data: {
    startTime?: string;
    endTime?: string;
    startDate?: string;
    endDate?: string;
  },
  ctx: z.RefinementCtx
) => {
  const hasTime = data.startTime !== undefined || data.endTime !== undefined;
  const hasDate = data.startDate !== undefined || data.endDate !== undefined;

  if (hasTime && hasDate) {
    addRangeValidationIssue(
      ctx,
      'Provide either startTime/endTime or startDate/endDate, not both',
      ['startTime']
    );
    return;
  }

  if (!hasTime && !hasDate) {
    addRangeValidationIssue(
      ctx,
      'Either startTime/endTime or startDate/endDate is required',
      ['startTime']
    );
    return;
  }

  if (hasTime) {
    if (!data.startTime || !data.endTime) {
      addRangeValidationIssue(
        ctx,
        'startTime and endTime must be provided together',
        ['startTime']
      );
      return;
    }

    if (!isValidTimeRange({ startTime: data.startTime, endTime: data.endTime })) {
      addRangeValidationIssue(ctx, timeRangeError.message, [...timeRangeError.path]);
    }

    return;
  }

  if (!data.startDate || !data.endDate) {
    addRangeValidationIssue(
      ctx,
      'startDate and endDate must be provided together',
      ['startDate']
    );
    return;
  }

  if (!isValidDateRange({ startDate: data.startDate, endDate: data.endDate })) {
    addRangeValidationIssue(ctx, dateRangeError.message, [...dateRangeError.path]);
  }
};
