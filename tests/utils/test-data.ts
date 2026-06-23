/**
 * Shared test data constants
 *
 * IMPORTANT: All timestamps use FIXED_NOW reference date
 */

// Fixed reference date.
// Tests will mock Date.now() to always return this date
export const FIXED_NOW = new Date('2026-02-12T10:00:00Z');

export const TEST_USER = {
  username: 'testuser',
  password: 'testpassword',
};

export const TEST_API_KEY = 'test-api-key-12345';

export const toDateString = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * Calculate date ranges relative to FIXED_NOW for testing
 * All dates are explicitly in UTC to ensure consistency across timezones
 */
export function getTestDateRanges() {
  const now = FIXED_NOW;

  // Yesterday (Feb 11, 2026 UTC)
  const yesterday = new Date(Date.UTC(2026, 1, 11, 0, 0, 0, 0));
  const yesterdayEnd = new Date(Date.UTC(2026, 1, 11, 23, 59, 59, 999));

  // Day before yesterday (Feb 10, 2026 UTC)
  const dayBeforeYesterday = new Date(Date.UTC(2026, 1, 10, 0, 0, 0, 0));
  const dayBeforeYesterdayEnd = new Date(Date.UTC(2026, 1, 10, 23, 59, 59, 999));

  // Current day (Feb 12, 2026, 00:00 to 10:00 UTC)
  const todayStart = new Date(Date.UTC(2026, 1, 12, 0, 0, 0, 0));

  // Current week (Feb 10-12, 2026 - Monday is week start)
  // Feb 12, 2026 is a Thursday, so week starts on Monday Feb 9
  const currentWeekStart = new Date(Date.UTC(2026, 1, 9, 0, 0, 0, 0));

  // Previous week (Feb 2-8, 2026)
  const previousWeekStart = new Date(Date.UTC(2026, 1, 2, 0, 0, 0, 0));
  const previousWeekEnd = new Date(Date.UTC(2026, 1, 8, 23, 59, 59, 999));

  // Current month (February 2026, incomplete - Feb 1 to Feb 12 10:00)
  const currentMonthStart = new Date(Date.UTC(2026, 1, 1, 0, 0, 0, 0));

  // January 2026 (complete month)
  const january2026Start = new Date(Date.UTC(2026, 0, 1, 0, 0, 0, 0));
  const january2026End = new Date(Date.UTC(2026, 0, 31, 23, 59, 59, 999));

  // December 2025 (complete month)
  const december2025Start = new Date(Date.UTC(2025, 11, 1, 0, 0, 0, 0));
  const december2025End = new Date(Date.UTC(2025, 11, 31, 23, 59, 59, 999));

  // November 2025 (complete month)
  const november2025Start = new Date(Date.UTC(2025, 10, 1, 0, 0, 0, 0));
  const november2025End = new Date(Date.UTC(2025, 10, 30, 23, 59, 59, 999));

  // Current year (2026, incomplete - Jan 1 to Feb 12 10:00)
  const currentYearStart = new Date(Date.UTC(2026, 0, 1, 0, 0, 0, 0));

  // Full year 2025 (complete)
  const year2025Start = new Date(Date.UTC(2025, 0, 1, 0, 0, 0, 0));
  const year2025End = new Date(Date.UTC(2025, 11, 31, 23, 59, 59, 999));

  return {
    now,
    yesterday: { start: yesterday, end: yesterdayEnd },
    dayBeforeYesterday: { start: dayBeforeYesterday, end: dayBeforeYesterdayEnd },
    today: { start: todayStart, end: now },
    currentWeek: { start: currentWeekStart, end: now },
    previousWeek: { start: previousWeekStart, end: previousWeekEnd },
    currentMonth: { start: currentMonthStart, end: now },
    january2026: { start: january2026Start, end: january2026End },
    december2025: { start: december2025Start, end: december2025End },
    november2025: { start: november2025Start, end: november2025End },
    currentYear: { start: currentYearStart, end: now },
    year2025: { start: year2025Start, end: year2025End },
  };
}
