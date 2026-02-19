# API Compatibility Testing Plan

## Overview

This plan will create comprehensive integration tests to verify that both the **old API** (Hapi + PostgreSQL) and **new API** (Lambda + DynamoDB) return identical responses for all endpoints. The tests will cover the front-end use cases (devices, latest readings, statistics, readings with timeframes) and the Raspberry Pi sensor-data-sender (adding readings).

## TODO List

### Phase 1: Setup
- [x] **setup-old-api-testing**: Install Jest + Supertest in old API, create jest.config.js, add test scripts to package.json
- [x] **setup-new-api-testing**: Install Jest + Supertest in new API, create jest.config.js, add test scripts to package.json

### Phase 2: Data Seeding
- [x] **create-old-api-seed**: Create seed script for old API (PostgreSQL) with 3 devices, 2,200+ readings per device (including 10-min intervals), user, and API key
- [x] **update-new-api-seed**: Update new API seed script to match old API data exactly (same IDs, timestamps, values)

### Phase 3: Test Implementation

#### Shared Utilities
- [x] **create-test-utilities**: Create shared test utilities (test-server config, test-data) and comparison utilities for compatibility tests
  - Note: Tests assume servers are already running manually (simplified approach)

#### Compatibility Tests (compare old vs new)
- [x] **implement-compatibility-auth-tests**: Write compatibility tests for POST /api/login endpoint (compare old vs new API)
- [x] **implement-compatibility-device-tests**: Write compatibility tests for GET /api/devices and GET /api/devices/:id endpoints (compare old vs new API)
- [x] **implement-compatibility-latest-tests**: Write compatibility tests for GET /api/latest endpoint (compare old vs new API)
- [x] **implement-compatibility-statistics-tests**: Write compatibility tests for GET /api/statistics endpoint (compare old vs new API)
- [x] **implement-compatibility-readings-tests**: Write compatibility tests for GET /api/readings with all timeframe/level combinations for temperature, humidity, AND pressure (compare old vs new API)
- [x] **implement-compatibility-add-reading-tests**: Write compatibility tests for POST /api/devices/:id/readings endpoint (compare old vs new API)
- [x] **implement-compatibility-device-create-tests**: Write compatibility tests for POST /api/devices endpoint (compare old vs new API)
- [x] **implement-compatibility-device-update-tests**: Write compatibility tests for PUT /api/devices/:id endpoint (compare old vs new API)
- [x] **implement-compatibility-device-delete-tests**: Write compatibility tests for DELETE /api/devices/:id endpoint (compare old vs new API)

#### Integration Tests - Phase A: Core Functionality (mirrors compatibility tests)
**Purpose:** Permanent tests for same scenarios as compatibility tests, but validate against expected values instead of comparing APIs

- [x] **implement-integration-auth-tests**: POST /api/login with valid/invalid credentials, verify expected token format
- [x] **implement-integration-device-get-tests**: GET /api/devices and GET /api/devices/:id (verify against known seed data)
- [x] **implement-integration-device-create-tests**: POST /api/devices (valid device, invalid data, duplicate detection)
- [x] **implement-integration-device-update-tests**: PUT /api/devices/:id (full update, validation, conflicts)
- [x] **implement-integration-device-delete-tests**: DELETE /api/devices/:id (success, 404, CASCADE to readings)
- [x] **implement-integration-latest-tests**: GET /api/latest (verify latest readings for seeded devices)
- [x] **implement-integration-statistics-tests**: GET /api/statistics (verify stats for known date ranges)
- [x] **implement-integration-readings-tests**: GET /api/readings (all timeframe/level/type combinations against seed data)
- [x] **implement-integration-add-reading-tests**: POST /api/devices/:id/readings (add reading, verify appears in latest)
- [x] **test-aggregation-correctness**: Manually calculate expected avg/min/max for known dataset, verify API matches exactly
- [x] **test-device-isolation**: Verify device-001 readings don't affect device-002's statistics (data corruption check)
- [x] **test-latest-is-newest**: Add old reading then new reading → latest shows newest (not random)
- [x] **test-required-params**: Missing startTime/endTime/type/level → returns 400 with helpful message
- [x] **test-invalid-enums**: Invalid type/level/timezone values → returns 400
- [x] **test-time-range-validation**: startTime > endTime, invalid ISO dates → returns 400
- [x] **test-empty-results**: Query date range with no data → returns empty array (not error)

#### Integration Tests - Phase B: Enhanced Coverage

**Phase B1: Timezone & Time Bucketing** (highest migration risk - CRITICAL)
- [x] **test-timezone-bucketing**: Verify time buckets align to Helsinki timezone, not UTC. A reading at `2026-02-11T22:30:00Z` (00:30 Helsinki) must be bucketed as Feb 12, not Feb 11. Test all levels (30 min, day, week, month) with readings near the UTC/Helsinki day boundary (22:00 UTC in winter)
- [x] **test-dst-transitions**: Test spring forward (March 29, 2026: 3AM→4AM EET→EEST) and fall back (October 25, 2026: 4AM→3AM EEST→EET). Verify: no missing hour in spring, no double-counted hour in fall, day buckets have correct total hours (23h spring day, 25h fall day)

**Phase B2: End-to-End Data Flow** (prevent data integrity bugs - CRITICAL)
- [x] **test-reading-propagation**: POST a reading → verify it appears correctly in all three read endpoints: GET /api/latest (newest reading shown), GET /api/statistics (avg/min/max updated), GET /api/readings with matching time range and level (included in correct bucket)
- [x] **test-api-key-auth**: Test API key authentication used by Raspberry Pi sensor-data-sender. GET /api/devices with valid API key header → 200. Invalid API key → 401. Missing API key and no JWT → 401

**Phase B3: Edge Cases & Robustness** (prevent crashes from unexpected input - IMPORTANT)
- [x] **test-null-sensor-values**: POST reading with only temperature (no humidity/pressure) → verify statistics and readings endpoints handle the missing values correctly (nulls in aggregation, not NaN or errors)
- [x] **test-device-no-readings-statistics**: GET /api/statistics and GET /api/devices/:id/statistics for a device with zero readings in the queried time range → returns null stats (not error or NaN). Note: device-without-readings for /latest already tested in Phase A
- [ ] **test-pagination-boundaries**: offset > totalCount → returns empty values array (not error). Negative offset/limit → returns 400. Very large limit → returns all items without crash
- [ ] **test-sensor-value-extremes**: temperature: 0 (falsy in JS), temperature: -40, pressure: 500/1100 (extremes), battery: 0, battery: negative → all stored and aggregated correctly without type coercion bugs
- [ ] **test-jwt-edge-cases**: Expired JWT token → 401. Malformed token (e.g., `Bearer not.a.jwt`) → 401. Token signed with wrong secret → 401. These verify auth middleware rejects bad tokens, not just missing ones

**Phase B4: Existing Test Fixes** (bugs & quality issues in current tests)
- [ ] **fix-statistics-test-label**: In `statistics.test.ts`, the test named "should return 404 for disabled device" actually tests missing startTime (returns 400). Rename it and add a real disabled-device test for `GET /api/devices/device-003/statistics`
- [ ] **fix-device-create-import**: In `device-create.test.ts`, the duplicate-ID test imports `NEW_API_URL` from `test-server.ts` instead of using `getApiUrl()`. Also the first created device is never added to `createdDeviceIds` so it leaks. Fix both issues
- [ ] **extract-shared-types**: The `Device`, `DeviceListResponse`, `ReadingsResponse` etc. interfaces are duplicated across 5+ test files. Extract to a shared `tests/integration/types.ts`

### Phase 4: Validation & Documentation
- [ ] **document-api-differences**: Document all API behavioral differences discovered during testing (e.g., login response format, auth header format, timestamp precision)
- [ ] **verify-all-tests-pass**: Run full test suite (compatibility + integration) and verify all pass with clean output

---

## Architecture Comparison

### Old API ([sensor_api-OLD/](sensor_api-OLD/))

- Framework: Hapi.js server
- Database: PostgreSQL with Knex.js (local, not in Docker)
- Port: 8000 (development)
- Auth: JWT via hapi-jsonwebtoken
- Database aggregation: Uses SQL `date_trunc()` and `date_bin()`

### New API ([sensor-api/](sensor-api/))

- Framework: AWS Lambda with lambda-api
- Database: DynamoDB (local via Docker)
- Port: 3000 (SAM local)
- Auth: JWT via jsonwebtoken
- Application-level aggregation: Time bucketing done in code

## Key Test Areas

Based on [test-plan.md](test-plan.md), the following endpoints must work identically:

### 1. Authentication

- `POST /api/login` - Login returns JWT token

### 2. Front-End Home Page

- `GET /api/devices` - All devices ordered by device.order
- `GET /api/latest` - Latest readings for all devices
- `GET /api/statistics?startTime=X&endTime=Y` - Statistics for timeframe
- `GET /api/readings?startTime=X&endTime=Y&type=temperature&level=day` - Aggregated readings

### 3. Raspberry Pi Sensor Data Sender

- `POST /api/devices/:id/readings` - Add new reading (note: typo in test-plan says "radings")

## Implementation Steps

### Phase 1: Setup Testing Infrastructure

#### 1.1 Install Testing Dependencies

Add to both projects:

- `jest` - Test framework
- `supertest` - HTTP assertions
- `@types/jest`, `@types/supertest` - TypeScript definitions

#### 1.2 Create Test Configuration

Files to create:

- `sensor_api-OLD/jest.config.js` - Jest configuration for old API
- `sensor-api/jest.config.js` - Jest configuration for new API
- Test environment setup to start both servers before tests run

### Phase 2: Data Seeding

#### 2.1 Create Identical Seed Data for Old API

Create `sensor_api-OLD/knex/seeds/test-data.ts`:

- 3 devices (2 enabled, 1 disabled) with specific IDs, names, orders, locations
- 1 test user (username: `testuser`, password: `testpassword`)
- 1 API key for sensor-data-sender
- 2,200+ readings per device (matches real Raspberry Pi behavior - sends every 10 minutes):
  - Yesterday: 144 readings (every 10 minutes - 6 per hour × 24 hours)
  - Day before yesterday: 144 readings (every 10 minutes)
  - Current day: 48 readings (every 30 minutes from midnight to now)
  - Previous 5 complete days: 48 readings per day (every 30 minutes, 240 total)
  - January 2026: 31 days × 24 readings per day = 744 readings
  - December 2025: 31 readings (1 per day)
  - 2025 months: 12 readings (1 per month)

Reference existing seed: [scripts/seed-local.ts](scripts/seed-local.ts)

#### 2.2 Update New API Seed to Match

Update [scripts/seed-local.ts](scripts/seed-local.ts):

- Use exact same device IDs, names, orders as old API
- Use exact same user credentials
- Generate same 2,200+ readings with matching timestamps and values
- **Critical:** Include two full days with 10-minute intervals to match real Raspberry Pi behavior
- This ensures both APIs have identical test data

### Phase 3: Test Suites

#### 3.1 Test Structure - Separate Suites for Long-Term Maintainability

Create **two independent test suites** to separate migration concerns from long-term testing:

**A. Compatibility Tests (Temporary - for migration only)**

`tests/compatibility/api-compatibility.test.ts`

- Purpose: Verify old and new APIs return identical responses
- Lifecycle: Delete this entire folder after migration is complete
- Approach: 
  - Start both servers (old API on :8000, new API on :3000)
  - Run each test against both APIs
  - Compare responses field-by-field using comparison utilities

**B. Integration Tests (Permanent - evolves with new API)**

`tests/integration/*.test.ts` (separate files per feature)

- Purpose: Verify new API works correctly against known good values
- Lifecycle: Permanent - these tests stay and evolve with your API
- Approach:
  - Start only the new API server
  - Test against expected values, not old API responses
  - Can add new features/fields without worrying about old API compatibility

**Benefits:**

- Clean separation: compatibility vs correctness testing
- Easy cleanup: just delete `tests/compatibility/` when done
- Future-proof: integration tests can test new features without old API constraints
- No mode-switching logic needed

**Directory Structure:**

```
sensor-api/
├── tests/
│   ├── compatibility/              # TEMPORARY - delete after migration
│   │   ├── api-compatibility.test.ts   # Compares old vs new
│   │   ├── comparison-utils.ts         # Response comparison helpers
│   │   └── test-setup.ts               # Start both servers
│   │
│   ├── integration/                # PERMANENT - evolves with API
│   │   ├── auth.test.ts                # Auth against expected values
│   │   ├── devices.test.ts             # Device CRUD tests
│   │   ├── latest.test.ts              # Latest readings tests
│   │   ├── statistics.test.ts          # Statistics tests
│   │   └── readings.test.ts            # Aggregated readings tests
│   │
│   └── utils/                      # SHARED - used by both test suites
│       ├── test-server.ts              # Start/stop server
│       └── test-data.ts                # Test data constants
│
└── jest.config.js
```

#### 3.2 Compatibility Test Cases (tests/compatibility/)

These tests compare old API vs new API responses to ensure identical behavior during migration:

**Test File Structure:**

- `api-compatibility.test.ts` - All comparison tests
- `comparison-utils.ts` - Helper functions for comparing responses
- `test-setup.ts` - Helpers to start both old and new API servers

**Authentication Tests:**

- Login with valid credentials returns JWT token
- Login with invalid credentials returns 401
- Token format is compatible (both APIs can accept each other's tokens)

**Device Tests:**

- `GET /api/devices` returns all enabled devices ordered by device.order
- `GET /api/devices?includeDisabled=true` returns all devices
- Pagination tests:
  - `GET /api/devices?limit=1&offset=0` - First page
  - `GET /api/devices?limit=1&offset=1` - Second page
  - `GET /api/devices?limit=1&offset=2` - Third page (disabled device, should not appear without includeDisabled)
  - Verify pagination works identically across all pages
- `GET /api/devices/:id` returns single device
- `POST /api/devices` creates new device:
  - Valid device creation (12-char ID, all required fields)
  - Duplicate device ID returns conflict error
  - Invalid device data returns 400
  - Verify device appears in device list
- `PUT /api/devices/:id` updates existing device:
  - Update device name, order, location, type, disabled status
  - Duplicate order conflicts return error
  - Non-existent device returns 404
  - Verify updates persist
- `DELETE /api/devices/:id` deletes device and all readings:
  - Delete existing device returns success
  - Non-existent device returns 404
  - Verify device no longer appears in list
  - Verify all readings for device are deleted (CASCADE)
- Response format matches exactly (id, name, location, type, order, disabled)

**Latest Readings Tests:**

- `GET /api/latest` returns latest reading for each device
- Response includes device info + reading (temperature, humidity, pressure, battery)
- Devices are ordered by device.order
- Response format matches exactly
- Test pagination: `limit=1&offset=0`, `limit=1&offset=1`, `limit=1&offset=2`

**Statistics Tests:**

- Test with current incomplete periods:
  - Current month (February 2026): `GET /api/statistics?startTime=2026-02-01&endTime=NOW`
  - Current year (2026): `GET /api/statistics?startTime=2026-01-01&endTime=NOW`
- Test with complete previous periods:
  - January 2026: `GET /api/statistics?startTime=2026-01-01&endTime=2026-01-31`
  - December 2025: `GET /api/statistics?startTime=2025-12-01&endTime=2025-12-31`
  - Full year 2025: `GET /api/statistics?startTime=2025-01-01&endTime=2025-12-31`
- Response includes min, max, avg for temperature, humidity, pressure
- Results match (allowing for small floating-point differences)
- Test pagination: `limit=1&offset=0`, `limit=1&offset=1` for multi-device statistics

**Readings Tests (Critical - Front-End Use Case):**

Test all timeframe + level + sensor type combinations for **all three sensor types** (temperature, humidity, pressure):

**Current Period Tests (incomplete timeframes):**

- Current day (today) → 30 minutes level: `GET /api/readings?startTime=TODAY_START&endTime=NOW&type=[temperature|humidity|pressure]&level=30 minutes`
- Current week → day level: `GET /api/readings?startTime=WEEK_START&endTime=NOW&type=[temperature|humidity|pressure]&level=day`
- Current month (February 2026, incomplete) → day level: `GET /api/readings?startTime=2026-02-01&endTime=NOW&type=[temperature|humidity|pressure]&level=day`
- Current year (2026, incomplete) → month level: `GET /api/readings?startTime=2026-01-01&endTime=NOW&type=[temperature|humidity|pressure]&level=month`

**Previous Complete Period Tests:**

- Day before yesterday → 10 minutes level: `GET /api/readings?startTime=YESTERDAY-1_START&endTime=YESTERDAY-1_END&type=[temperature|humidity|pressure]&level=10 minutes` (matches real Raspberry Pi 10-min interval)
- Previous day (yesterday) → 10 minutes level (matches real Raspberry Pi 10-min interval)
- Previous day (yesterday) → 30 minutes level (tests aggregation of 10-min data into 30-min buckets)
- Previous week (last Monday-Sunday) → day level
- Previous complete months:
  - January 2026 → day level: `GET /api/readings?startTime=2026-01-01&endTime=2026-01-31&type=[temperature|humidity|pressure]&level=day`
  - December 2025 → day level
  - November 2025 → day level
- Previous complete year (2025) → month level: `GET /api/readings?startTime=2025-01-01&endTime=2025-12-31&type=[temperature|humidity|pressure]&level=month`

For each test:

- Test with **temperature**, **humidity**, AND **pressure** (not just temperature)
- Response format matches (id, values array with time, avg, min, max)
- Time bucket alignment is identical (e.g., both APIs round to same day/hour/minute)
- Aggregation results match (within floating-point tolerance)
- Test pagination: `limit=1&offset=0`, `limit=1&offset=1` to verify multi-device readings

**Add Reading Tests (Raspberry Pi Use Case):**

- `POST /api/devices/:id/readings` with temperature/humidity/pressure/battery
- Reading is successfully stored
- `GET /api/latest` immediately reflects the new reading
- Both APIs handle the same timestamp format
- **Note:** Tests use temporary devices created per test and deleted after (via `DELETE /api/devices/:id`)

**Device Management Tests (CRUD Operations):**

- `POST /api/devices` - Create device:
  - Successfully creates device with valid data (12-char ID required by old API)
  - Returns 400 for invalid data (missing fields, wrong ID length)
  - Returns 409 for duplicate device ID
  - Returns 409 for duplicate device order
- `PUT /api/devices/:id` - Update device:
  - Successfully updates device name, order, location, type, disabled status
  - Returns 404 for non-existent device
  - Returns 409 for duplicate order
  - Validates all field constraints
- `DELETE /api/devices/:id` - Delete device:
  - Successfully deletes device and CASCADE deletes all readings
  - Returns 404 for non-existent device
  - Verifies device no longer appears in device list
  - Verifies all device readings are deleted

#### 3.3 Response Comparison Utilities

Create helper functions in `tests/compatibility/comparison-utils.ts`:

- `compareDevices(oldResponse, newResponse)` - Compares device arrays
- `compareReadings(oldResponse, newResponse)` - Compares aggregated readings (with floating-point tolerance)
- `compareStatistics(oldResponse, newResponse)` - Compares statistics (with floating-point tolerance)

#### 3.4 Integration Test Cases (tests/integration/ - PERMANENT)

These tests verify the new API works correctly against known good values. They evolve with the API long-term.

**Test File Structure:**

- `auth.test.ts` - Authentication tests
- `devices.test.ts` - Device CRUD operations
- `latest.test.ts` - Latest readings
- `statistics.test.ts` - Statistics calculations
- `readings.test.ts` - Time-aggregated readings

**What Integration Tests Should Verify:**

All the same test cases as compatibility tests, but instead of comparing to old API:

- Test against **expected values** (e.g., device-001 should have name "Living Room Sensor")
- Test **business logic** (e.g., disabled devices excluded from listings)
- Test **error cases** (e.g., 404 for invalid device ID, 401 for invalid credentials)
- Test **data integrity** (e.g., POST /readings followed by GET /latest returns the new reading)
- Test **edge cases** (e.g., empty results, pagination beyond total count)

**Example Difference:**

*Compatibility Test (temporary):*

```typescript
const oldResponse = await request(OLD_API).get('/api/devices/device-001');
const newResponse = await request(NEW_API).get('/api/devices/device-001');
expect(newResponse.body).toEqual(oldResponse.body); // Just match old API
```

*Integration Test (permanent):*

```typescript
const response = await request(API_URL).get('/api/devices/device-001');
expect(response.status).toBe(200);
expect(response.body).toEqual({
  id: 'device-001',
  name: 'Living Room Sensor',
  order: 1,
  disabled: false,
  type: 'ruuvi',
  location: { x: 100, y: 200, type: 'inside' }
});
```

**Future Evolution:** Once old API is gone, you can freely add new fields, change formats, add features - integration tests just need updating to match new expectations.

### Phase 4: Known Differences to Handle

#### 4.1 Response Format Differences

The old API may have slightly different field names or nesting. Document these:

- Check if `location_x`, `location_y`, `location_type` (old) vs `location: {x, y, type}` (new)
- Check timestamp formats (ISO string vs different format)

#### 4.2 Floating-Point Precision

SQL aggregations vs JavaScript aggregations may have minor differences:

- Use tolerance threshold (e.g., 0.001) when comparing averages
- Document acceptable variance

#### 4.3 Time Bucketing Differences

PostgreSQL's `date_trunc()` and `date_bin()` vs JavaScript time truncation:

- Test if time buckets align identically
- May need to adjust `src/data/readings.ts` `truncateTime()` function
- Pay special attention to timezone handling (old API uses 'Europe/Helsinki')

### Phase 5: Test Execution

#### 5.1 Setup Scripts

Create npm scripts in both APIs:

**Old API (sensor_api-OLD/package.json):**

- `npm run test:setup` - Runs migrations and seeds
- `npm run test:start` - Starts server on port 8000
- `npm run test` - Setup + start server + run tests

**New API (sensor-api/package.json):**

- `npm run test:setup` - Creates tables and seeds
- `npm run test:start` - Starts server on port 3000
- `npm run test:compatibility` - Runs compatibility tests (compares old vs new)
- `npm run test:integration` - Runs integration tests (new API only)
- `npm run test` - Runs both compatibility and integration tests

#### 5.2 Test Execution Requirements

Tests should:

- Connect to existing local PostgreSQL database (for old API)
- Start DynamoDB Local in Docker (for new API)
- Run migrations/seeds automatically before tests
- Start both servers in background
- Run tests
- Stop servers after tests complete

## Test Data Requirements

### Devices

```typescript
device-001: Living Room Sensor (order: 1, enabled, type: ruuvi, inside)
device-002: Balcony Sensor (order: 2, enabled, type: ruuvi, outside)
device-003: Bedroom Sensor (order: 3, disabled, type: sensorbug, inside)
```

### Readings

**Note:** Raspberry Pi sends readings every 10 minutes in production. Seed data should reflect realistic intervals.

- 2,200+ readings per device spanning multiple timeframes:
  - **Yesterday (complete day with 10-min intervals)**: 144 readings (6 per hour × 24 hours = matches real Raspberry Pi behavior)
  - **Day before yesterday (10-min intervals)**: 144 readings (for testing 10-minute level aggregation)
  - **Current day**: 48 readings (every 30 minutes from midnight to now - less frequent for current incomplete day)
  - **Previous 5 complete days**: 48 readings per day (every 30 minutes, 240 readings total)
  - **January 2026**: 31 days × 24 readings per day = 744 readings (hourly aggregates)
  - **December 2025**: 31 readings (1 per day)
  - **2025 months**: 12 readings (1 per month)
- **Total per device**: ~2,367 readings
- Known values for predictable aggregation tests
- Example: Device-001 at 2026-02-12 10:00:00 → temp: 20.5, humidity: 45.0, pressure: 1013.25
- Each reading must have temperature, humidity, AND pressure values (not just temperature)

**Rationale:**

- Two full days with 10-minute intervals (288 readings) ensures realistic testing of "10 minutes" level aggregation
- Matches actual Raspberry Pi behavior (sends data every 10 minutes)
- Other days use 30-minute intervals to reduce seed data size while still testing all aggregation levels

### Users

```typescript
username: testuser
password: testpassword
```

### API Keys

```typescript
apiKey: test-api-key-12345
description: Test API key for sensor-data-sender
```

## Files to Create/Modify

### New Files (Old API - sensor_api-OLD/)

- `knex/seeds/test-data.ts` - Seed script with identical data to new API
- `jest.config.js` - Jest configuration
- `package.json` - Add test scripts and dependencies (Jest, Supertest)

### New Files (New API - sensor-api/)

**Compatibility Tests (TEMPORARY - delete after migration):**

- `tests/compatibility/api-compatibility.test.ts` - Compares old vs new API responses
- `tests/compatibility/comparison-utils.ts` - Helper functions for comparing responses
- `tests/compatibility/test-setup.ts` - Start both servers for comparison

**Integration Tests (PERMANENT - evolves with API):**

- `tests/integration/auth.test.ts` - Authentication tests against known values
- `tests/integration/devices.test.ts` - Device CRUD tests
- `tests/integration/latest.test.ts` - Latest readings tests
- `tests/integration/statistics.test.ts` - Statistics calculation tests
- `tests/integration/readings.test.ts` - Time-aggregated readings tests

**Shared Test Utilities:**

- `tests/utils/test-server.ts` - Start/stop test server helpers
- `tests/utils/test-data.ts` - Shared test data constants
- `jest.config.js` - Jest configuration

### Modified Files

- `scripts/seed-local.ts` - Update to match old API seed data exactly (same IDs, timestamps, values)
- `src/data/readings.ts` - May need to adjust `truncateTime()` to match PostgreSQL behavior
- `package.json` - Add test scripts and dependencies
- `../sensor_api-OLD/package.json` - Add test scripts and dependencies

## Migration Path & Lifecycle

### Phase 1: During Migration (Now)

Both test suites exist and run:

```bash
# In sensor-api/
npm run test:compatibility   # Compare old vs new - must pass
npm run test:integration      # Test new API standalone - must pass
npm run test                  # Run both suites
```

**Goal:** Ensure APIs are identical before switching frontend/sensor-data-sender.

### Phase 2: After Migration Complete

Once frontend and sensor-data-sender are using the new API:

```bash
# Delete compatibility tests - no longer needed
rm -rf sensor-api/tests/compatibility/

# Update package.json to remove test:compatibility script
# Integration tests continue working unchanged
npm run test                  # Now only runs integration tests
```

**Goal:** Clean up temporary comparison code.

### Phase 3: Future Development

Add new features freely without old API constraints:

```typescript
// Example: Add new field to device response
// sensor-api/tests/integration/devices.test.ts
it('should return device with battery level', async () => {
  const response = await request(API_URL).get('/api/devices/device-001');
  expect(response.body.batteryLevel).toBe(95); // New field!
});
```

**Goal:** Evolve API independently.

## Success Criteria

**Compatibility Tests:**

- All compatibility tests pass (old and new APIs return identical responses)
- Response formats match exactly (or documented differences are acceptable)
- Aggregation results match within 0.1% tolerance
- Time bucketing aligns identically

**Integration Tests:**

- All integration tests pass (new API returns expected values)
- Business logic is correct (disabled devices excluded, pagination works, etc.)
- Error handling is correct (404s, 401s, 400s as expected)

**Overall:**

- Front-end can switch between APIs without code changes
- Sensor-data-sender can switch between APIs without code changes
- Integration tests provide confidence for future changes

## Edge Cases to Test

**Already covered in Phase A:**
- Empty results (device with no readings) ✓
- Single reading (aggregation returns that one value) ✓
- Disabled devices excluded from listings ✓
- Invalid device IDs return 404 ✓
- Invalid credentials return 401 ✓
- Missing query parameters return 400 ✓

**Covered in Phase B (pending):**
- Pagination at boundaries (offset > total count, negative values)
- Helsinki timezone bucketing near midnight (22:00 UTC)
- DST spring forward / fall back transitions
- Null/missing sensor values in aggregations
- Zero and extreme sensor values (JS falsy edge cases)
- Expired/malformed JWT tokens
- API key authentication (Raspberry Pi use case)
- Rapid sequential writes to same device
