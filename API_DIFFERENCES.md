# API Differences Between Old and New

This document tracks behavioral differences discovered during compatibility testing between the old API (Hapi.js + PostgreSQL) and new API (Lambda + DynamoDB).

## Authentication Differences

### POST /api/login

**Response Format:**
- **Old API**: Returns JWT token as plain text string
  ```
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  ```
- **New API**: Returns JSON object with token field
  ```json
  { "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
  ```

**Authorization Header:**
- **Old API**: Expects token directly without "Bearer" prefix
  ```
  Authorization: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  ```
- **New API**: Expects "Bearer" prefix
  ```
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  ```

---

## Latest Readings

### GET /api/latest
**Route mismatch**
- Old API: Uses `/api/devices/latest-readings` route
- New API: Uses `/api/latest` route

**Reading timestamp field:**
- Old API: Uses `created_at` field
- New API: Uses `timestamp` field
- Same value, different field name

### GET /api/devices/:id/latest
**Route mismatch**
- Old API: Uses `/api/devices/:id/latest-readings` route
- New API: Uses `/api/devices/:id/latest` route

**Reading timestamp field:**
- Old API: Uses `created_at` field
- New API: Uses `timestamp` field
- Same value, different field name
---

## Statistics

### GET /api/statistics
**Route mismatch**
- Old API: Uses `/api/devices/statistics` route
- New API: Uses `/api/statistics` route

---

## Aggregated Readings

### GET /api/readings

**Route Difference:**
- **Old API**: `/api/devices/readings`
- **New API**: `/api/readings`

**Timezone Handling:**
- **Old API**: Hardcoded to `'Europe/Helsinki'` timezone using PostgreSQL's `date_trunc('day', created_at, 'Europe/Helsinki')`
- **New API**: Accepts optional `timezone` query parameter (IANA timezone like `'Europe/Helsinki'`), defaults to `'UTC'`

**Time Bucket Format:**
- Both APIs return full ISO 8601 timestamps for time buckets (e.g., `"2026-02-08T22:00:00.000Z"`)
- For Helsinki timezone, midnight Feb 9 local = `"2026-02-08T22:00:00.000Z"` in UTC (UTC+2)

**Supported Levels:**
- `30 minutes`: 30-minute intervals
- `day`: Daily buckets at midnight in specified timezone
- `week`: Weekly buckets starting Monday at midnight in specified timezone
- `month`: Monthly buckets at 1st of month midnight in specified timezone
- **Note**: Old api had `10 minutes` time level but returned incorrectly the same as `30 minutes`


### GET /api/devices/:id/readings

**Same as above** (timezone behavior, time bucket format, supported levels), but for a single device and supports multiple types via `types` parameter.

**Types Parameter Format:**
- **Old API**: Uses repeated query parameters: `types=temperature&types=humidity&types=pressure`
- **New API**: Due to HTTP API v2.0, repeated parameters are automatically combined with commas:
  - Repeated: `types=temperature&types=humidity` → backend receives `"temperature,humidity"`
  - Comma-separated: `types=temperature,humidity` → backend receives `"temperature,humidity"`
  - Single value: `types=temperature` → backend receives `"temperature"`
  - All three formats are supported and produce the same result

---

## Notes

- These differences are by design as the new API follows more modern REST conventions
- Tests account for these differences to ensure functional equivalence
- Front-end will need to be updated when switching to the new API
