# Running API Compatibility Tests

This guide explains how to run tests that compare the old API (Hapi.js + PostgreSQL) with the new API (Lambda + DynamoDB).

## Prerequisites

### Old API Setup

1. PostgreSQL installed and running
2. Database created and migrated
3. Test data seeded

Read more details about the local setup from old API `README.md`.

### New API Setup
1. Docker installed and running
2. DynamoDB local container running
3. Tables created and test data seeded

## Running Tests

### Step 1: Configure Ports

Example `.env.local`:
```
LOCAL_API_PORT=3001
OLD_API_PORT=3002
```

### Step 2: Start Old API Server

```bash
# Terminal 1
cd /path/to/old-api
npm run start
```

Wait for: `Server running at: http://localhost:3002`

### Step 3: Start New API Server

```bash
# Terminal 2
cd /path/to/sensor-api
npm run sam:local
```

Wait for: `Running on http://127.0.0.1:3001/`


### Step 4: Run Tests

```bash
# Terminal 3
cd /path/to/sensor-api

# Run setup test first to verify everything works
npm run test:compatibility tests/compatibility/setup.test.ts

# Run all tests
npm test

# Run only compatibility tests (compare old vs new)
npm run test:compatibility

# Run only integration tests (new API only)
npm run test:integration

# Run in watch mode
npm run test:watch
```

## Troubleshooting

### "Servers are not running" Error

The tests check if both servers are reachable before running. If you see this error:
1. Make sure both servers are started (see Steps 1-3 above)
2. Check that they're responding on the expected ports
3. Verify databases are seeded with test data

### Test Data Out of Sync

If tests fail with data mismatches:
1. Re-seed both databases:
   ```bash
   # Old API (in old API folder)
   npm run seed
   
   # New API (in new API folder)
   # For clean slate, recreate DynamoDB tables first
   npm run dynamodb:stop
   npm run dynamodb:start
   npm run tables:create
   npm run seed:local
   ```

## Test Structure

```
tests/
├── utils/
│   ├── test-data.ts          # Shared test data constants
│   ├── test-server.ts        # Server configuration and health checks
│   └── ...
├── compatibility/
│   ├── comparison-utils.ts   # Response comparison utilities
│   ├── setup.test.ts         # Initial setup verification test
│   ├── auth.test.ts          # Login endpoint tests
│   ├── devices.test.ts       # Device endpoints tests
│   ├── latest.test.ts        # Latest readings tests
│   ├── statistics.test.ts    # Statistics tests
│   └── readings.test.ts      # Aggregated readings tests
└── integration/
    ├── auth.test.ts          # New API login tests
    ├── devices.test.ts       # New API device tests
    ├── latest.test.ts        # New API latest tests
    ├── statistics.test.ts    # New API statistics tests
    └── readings.test.ts      # New API readings tests
```

## Date Mocking

Tests use a fixed reference date (`2026-02-12T10:00:00Z`) to ensure deterministic results. The test data is seeded with readings relative to this date, and tests mock `Date.now()` to return this same date when testing "current period" queries.
