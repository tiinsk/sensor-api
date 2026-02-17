# Testing Guide

This guide covers both **compatibility tests** (old vs new API) and **integration tests** (new API only).

## Quick Start

### Integration Tests (New API Only)

```bash
# Setup (once)
npm run dynamodb:start
npm run test:setup

# Run tests (anytime)
npm run sam:test          # Terminal 1
npm run test:integration  # Terminal 2
```

### Compatibility Tests (Old vs New API)

```bash
# Setup (once)
npm run test:setup                        # New API
cd /path/to/old-api && npm run seed      # Old API

# Run tests (anytime)  
cd /path/to/old-api && npm run start     # Terminal 1
npm run sam:test                          # Terminal 2
npm run test:compatibility                # Terminal 3
```

## One-Time Setup

### Old API Setup

1. **PostgreSQL installed and running**
2. **Database created, migrated, and seeded**

Read details in old API `README.md`.

### New API Setup

1. **Start DynamoDB Local**:
   ```bash
   npm run dynamodb:start
   ```

2. **Create test tables and seed data**:
   ```bash
   npm run test:setup
   ```
   
   This creates `TEST-SensorApi-*` tables with identical seed data to the old API.

## Running Tests

### Step 1: Start Both API Servers

**Terminal 1 - Old API**:
```bash
cd /path/to/old-api
npm run start
```

Wait for: `Server running at: http://localhost:3002`

**Terminal 2 - New API**:
```bash
cd /path/to/sensor-api
npm run sam:test
```

Wait for: `Running on http://127.0.0.1:3001/`

### Step 2: Run Tests

**Terminal 3**:
```bash
cd /path/to/sensor-api

# Run all compatibility tests (compare old vs new)
npm run test:compatibility

# Run only integration tests (new API only)
npm run test:integration

# Run specific test file
npm run test:compatibility -- auth.test.ts

# Run in watch mode
npm run test:watch
```

## How It Works

### Table Isolation

The project maintains two sets of DynamoDB tables:

- **Development tables** (`SensorApi-*`): For manual testing with `npm run sam:local`. Data persists between restarts.
- **Test tables** (`TEST-SensorApi-*`): For automated tests with `npm run sam:test`. Can reset anytime with `npm run test:setup`.

When `NODE_ENV=test`, the code automatically uses `TEST-` prefixed tables (see `src/config/constants.ts`). This prevents tests from interfering with development data.

### Test Data Management

- **Shared tables**: All tests use the same TEST- tables (no per-test isolation)
- **Manual cleanup**: Tests that mutate data (POST/PUT/DELETE) clean up their own changes
- **Deterministic data**: Fixed reference date (2026-02-12) ensures reproducible results

## Port Configuration

Configure in `.env.local`:
```bash
OLD_API_PORT=3002  # Old API port
TEST_API_PORT=3001  # New API test port
```

## Troubleshooting

### "Servers are not running" Error

Make sure both API servers are started:
1. Old API: `cd /path/to/old-api && npm run start`
2. New API: `npm run sam:test`
3. Wait for startup messages before running tests

### "Table does not exist" Error

Run the setup: `npm run test:setup`

### Test Data Out of Sync

Re-run setup to refresh test data:
```bash
npm run test:setup
```

## Test Structure

```
tests/
├── utils/
│   ├── test-data.ts          # Shared test data constants
│   ├── test-server.ts        # Server configuration
│   └── ...
├── compatibility/
│   ├── comparison-utils.ts   # Response comparison utilities
│   ├── auth-utils.ts         # Auth helper functions
│   ├── device-helpers.ts     # Device CRUD helpers
│   ├── auth.test.ts          # Login endpoint tests
│   ├── devices.test.ts       # Device list/get tests
│   ├── device-create.test.ts # Device creation tests
│   ├── device-update.test.ts # Device update tests
│   ├── device-delete.test.ts # Device deletion tests
│   ├── add-reading.test.ts   # Add reading tests
│   ├── latest.test.ts        # Latest readings tests
│   ├── statistics.test.ts    # Statistics tests
│   └── readings.test.ts      # Aggregated readings tests
└── integration/
    ├── test-config.ts        # Test configuration
    └── auth.test.ts          # Auth tests (more to be added)
```
