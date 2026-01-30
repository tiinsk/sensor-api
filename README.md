# Sensor API

REST API for sensor data collection and retrieval, built with AWS Lambda and DynamoDB.

## Prerequisites

- Node.js 18+
- Docker
- AWS CLI (for deployment)
- AWS CDK CLI (`npm install -g aws-cdk`)

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Start DynamoDB Local

```bash
npm run dynamodb:start
```

This starts:
- DynamoDB Local on `http://localhost:8000`
- DynamoDB Admin UI on `http://localhost:8001` (optional web interface)

### 3. Create tables locally

```bash
npm run build
npm run tables:create
```

### 4. Seed test data (optional)

```bash
npm run seed:local
```

This creates:
- 3 test devices (2 enabled, 1 disabled)
- 100 sensor readings
- 1 test user (`testuser` / `testpassword`)
- 1 test API key (`test-api-key-12345`)

### 5. Stop DynamoDB Local

```bash
npm run dynamodb:stop
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript |
| `npm run dynamodb:start` | Start DynamoDB Local |
| `npm run dynamodb:stop` | Stop DynamoDB Local |
| `npm run tables:create` | Create tables locally |
| `npm run seed:local` | Seed test data |
| `npm run cdk:synth` | Generate CloudFormation |
| `npm run cdk:deploy` | Deploy to AWS |
| `npm run cdk:destroy` | Delete AWS resources |

## DynamoDB Tables

| Table | Purpose | Partition Key | Sort Key |
|-------|---------|---------------|----------|
| **Devices** | Device metadata | `id` | - |
| **Readings** | Sensor readings | `device_id` | `timestamp` |
| **Users** | User credentials | `username` | - |
| **Auth** | API keys | `api_key` | - |

## Project Structure

```
sensor-api/
├── cdk/                    # AWS CDK infrastructure
│   ├── bin/app.ts          # CDK entry point
│   └── lib/
│       └── dynamodb-stack.ts
├── src/
│   ├── index.ts            # Main Lambda handler
│   ├── handlers/           # Route handlers
│   ├── data/               # DynamoDB access layer
│   └── lib/                # Utilities
├── scripts/                # Setup scripts
│   ├── create-tables-local.ts
│   └── seed-local.ts
└── docker-compose.yml      # DynamoDB Local
```

## API Endpoints

*Coming soon*

## Deployment

*Coming soon*
