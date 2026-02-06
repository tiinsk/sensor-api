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

### 2. Create `.env.local` file

```bash
cp .env.local.example .env.local
```

Default values work for local development.

### 3. Start DynamoDB Local

```bash
npm run dynamodb:start
```

This starts:
- DynamoDB Local on `http://localhost:8000`
- DynamoDB Admin UI on `http://localhost:8001` (optional web interface)

### 4. Create tables locally

```bash
npm run build
npm run tables:create
```

### 5. Seed test data (optional)

```bash
npm run seed:local
```

This creates:
- 3 test devices (2 enabled, 1 disabled)
- 100 sensor readings
- 1 test user (`testuser` / `testpassword`)
- 1 test API key (`test-api-key-12345`)

### 6. Stop DynamoDB Local

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

## Authentication

The API supports two authentication methods:

### 1. User Authentication (Username/Password)

Home monitor website uses user authentication.

### 2. API Key Authentication

Raspberry sends sensor data with authentication API key.


### Environment Variables

- `JWT_SECRET` - Secret key for signing JWT tokens (change in production!)
- Default development secret is in `.env.local.example`

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

All endpoints require authentication (JWT token in `Authorization: Bearer <token>` header) except for `/` and `/api/login`.

### Auth
- `POST /api/login` - Login with username/password

### Devices
- `GET /api/devices` - Get all devices
- `GET /api/devices/:id` - Get single device
- `POST /api/devices` - Create new device
- `PUT /api/devices/:id` - Update device

### Readings
- `GET /api/devices/:id/readings` - Get readings for a device
- `GET /api/readings` - Get readings for all devices
- `POST /api/devices/:id/readings` - Add new reading

### Latest Readings
- `GET /api/latest` - Get latest readings for all devices
- `GET /api/devices/:id/latest` - Get latest reading for a device

### Statistics
- `GET /api/statistics` - Get statistics for all devices
- `GET /api/devices/:id/statistics` - Get statistics for a device

## Deployment

### Prerequisites
- AWS CLI configured with credentials
- AWS account with permissions to create Lambda, API Gateway, DynamoDB

### Deploy to AWS

1. **Set JWT Secret** (recommended for production):
   ```bash
   export JWT_SECRET="your-secure-secret-key"
   ```

2. **Build the project**:
   ```bash
   npm run build
   ```

3. **Synthesize CDK stacks** (optional - to preview):
   ```bash
   npm run cdk:synth
   ```

4. **Deploy all stacks**:
   ```bash
   npm run cdk:deploy
   ```
   
   This will create:
   - DynamoDB tables (Devices, Readings, Users, Auth)
   - Lambda function with your API code
   - API Gateway HTTP API endpoint
   - CloudWatch Logs
   - IAM roles and permissions

5. **Note the API URL** from the deployment output:
   ```
   Outputs:
   SensorApiStack.ApiUrl = https://abc123.execute-api.us-east-1.amazonaws.com
   ```

### Update Deployment

After making code changes:

```bash
npm run build
npm run cdk:deploy
```

### Destroy Resources

To remove all AWS resources:

```bash
npm run cdk:destroy
```

**Note:** DynamoDB tables use `RemovalPolicy.RETAIN`, so they won't be deleted automatically. You'll need to manually delete them from the AWS Console if desired.

---

## TODO / Technical Debt

### High Priority

- [ ] **Replace offset pagination with cursor-based pagination**
  - Current: Uses `limit + offset` (scans extra items, inefficient)
  - Target: Use `LastEvaluatedKey` / `ExclusiveStartKey` (DynamoDB native)
  - Impact: Requires frontend changes to handle cursor tokens instead of page numbers
  - Files: `src/data/devices.ts`, API response format, frontend pagination
  - Changes to be made:
    - Current:
      - GET /api/devices?limit=10
        → Returns: { items: [...], nextToken: "abc123" }
    - Change:
      - GET /api/devices?limit=10&nextToken=abc123 → Returns next page

### Medium Priority

- [ ] **Optimize time-based aggregation for readings**
  - Current: Query all readings, aggregate in Lambda code (slow for large datasets)
  - Target: Pre-aggregate data into summary tables or use DynamoDB Streams
  - Impact: Better performance for statistics/readings endpoints with long time ranges
  - Files: `src/data/readings.ts`, potentially new aggregation tables
- [ ] **Remove all code related to device specific API keys (not in user anymore)**

### Low Priority / Nice to Have

*None yet*

---

## Notes

- Items marked with ☑ are completed
- Add new items as they come up during development
- Prioritize before implementing
