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

**Important:** All required environment variables MUST be set. The application will fail with a clear error message if any are missing.

**Required variables:**
- `JWT_SECRET` - Secret key for JWT tokens (generate with: `openssl rand -base64 32`)
- `AWS_REGION` - AWS region (e.g., `us-east-1`)
- `NODE_ENV` - Environment mode (`development`, `production`, or `test`)

**Optional variables:**
- `USE_LOCAL_DB` - Set to `true` to use DynamoDB Local (defaults to `false` for AWS DynamoDB)

### 3. Start DynamoDB Local

```bash
npm run dynamodb:start
```

This starts:
- DynamoDB Local on `http://localhost:8000`
- DynamoDB Admin UI on `http://localhost:8001` (optional web interface)

### 4. Create tables locally

```bash
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

In order to test authenticated API routes (e.g. with curl, see section `Test with curl:`), new api-key and JWT-token can be created with:

```bash
npm run create:api-key
```

New user can be created with following script:

```bash
npm run create:user
```

### 6. Run the API locally with SAM (optional)

AWS SAM CLI allows you to test your Lambda function locally:

```bash
# Start local API server (runs on http://localhost:3000)
npm run sam:local
```

This will:
1. Generate `env.json` from your `.env.local` file
2. Start a local API Gateway on port 3000
3. Connect to your local DynamoDB (make sure it's running with `npm run dynamodb:start`)

**Test with curl:**
```bash
# Root endpoint
curl http://localhost:3000/

# Get all devices
curl -H "Authorization: Bearer <your-jwt-token>" http://localhost:3000/api/devices

# Get a specific device
curl -H "Authorization: Bearer <your-jwt-token>" http://localhost:3000/api/devices/device-001
```

**Test with a specific event:**
```bash
npm run sam:invoke
```

This invokes the Lambda with the test event in `events/test-event.json`.

**SAM Requirements:**
- Install AWS SAM CLI: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html
- Docker must be running (SAM uses Docker to run Lambda locally)
- DynamoDB Local must be running (`npm run dynamodb:start`)

### 7. Stop DynamoDB Local

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
| `npm run sam:local` | Run API locally with SAM CLI |
| `npm run sam:invoke` | Invoke Lambda with test event |
| `npm run cdk:synth` | Generate CloudFormation |
| `npm run cdk:deploy` | Deploy to AWS |
| `npm run cdk:destroy` | Delete AWS resources |

## Local Testing with SAM

**What is SAM?**

AWS SAM (Serverless Application Model) is AWS's framework for building serverless applications. The SAM CLI allows you to:
- Run your Lambda functions locally
- Test API Gateway routes locally
- Debug your code with breakpoints
- Simulate the AWS Lambda execution environment

**How does it work with this project?**

1. **`template.yaml`**: Defines your Lambda function and API Gateway routes in SAM syntax
2. **SAM CLI**: Runs your compiled code (`dist/`) in a local Docker container that mimics AWS Lambda
3. **Local DynamoDB**: SAM connects to your local DynamoDB Docker container via `--docker-network`
4. **API Gateway Emulator**: SAM creates a local HTTP server (port 3000) that behaves like API Gateway

**Architecture when running locally:**

```
Your Computer:
├── SAM CLI (port 3000)
│   └── Lambda Container (Node.js 18)
│       └── Your API code (dist/index.js)
│           └── Connects to ↓
└── DynamoDB Local (port 8000)
    └── Admin UI (port 8001)
```

**Why use SAM instead of running the code directly?**

- **Realistic testing**: Mimics AWS Lambda's execution environment
- **API Gateway simulation**: Tests path routing, query params, headers
- **Cold start testing**: Can test Lambda cold starts
- **Debugging**: Can attach a debugger to the Lambda function
- **No AWS costs**: Everything runs locally

**SAM vs Direct Testing:**

| Method | Pros | Cons |
|--------|------|------|
| **SAM** | Realistic AWS environment, API Gateway simulation | Requires Docker, slower startup |
| **Direct** | Fast, simple, easy debugging | Doesn't test Lambda-specific behavior |

For this project, both methods work. Use SAM when you want to test the full request/response cycle as it would work in AWS.

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

The API requires minimal configuration via environment variables:

**Required:**
- `JWT_SECRET` - Secret key for signing JWT tokens
- `AWS_REGION` - AWS region for DynamoDB
- `NODE_ENV` - Environment mode

**Optional:**
- `USE_LOCAL_DB` - Toggle between local DynamoDB (Docker) and AWS DynamoDB

See `.env.local.example` for complete configuration.

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

1. **Set JWT Secret** (REQUIRED):
   
   The deployment will fail if `JWT_SECRET` is not provided. Choose one method:
   
   **Option A: Environment variable**
   ```bash
   export JWT_SECRET="your-secure-secret-key"
   npm run cdk:deploy
   ```
   
   **Option B: CDK context**
   ```bash
   npm run cdk:deploy -- --context jwtSecret="your-secure-secret-key"
   ```
   
   **Generate a secure secret:**
   ```bash
   openssl rand -base64 32
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
  - **Problem:** Current implementation scans ALL items to get accurate `totCount`, which is inefficient
    - For devices endpoint: Currently scans entire table on every request just to count items
    - Doesn't scale well as data grows
  - **Solution:** Use DynamoDB's native cursor-based pagination with `LastEvaluatedKey`
    - No more full table scans
    - Pay-per-query based on items actually read
    - Infinitely scalable
  - **API Changes:**
    ```typescript
    // Current (offset-based):
    GET /api/devices?limit=10&offset=20
    → { count: 10, totCount: 250, limit: 10, values: [...] }
    
    // New (cursor-based):
    GET /api/devices?limit=10
    → { values: [...], nextCursor: "eyJpZCI6ImRldmljZS0wMTAifQ==", hasMore: true }
    
    GET /api/devices?limit=10&cursor=eyJpZCI6ImRldmljZS0wMTAifQ==
    → { values: [...], nextCursor: "...", hasMore: true }
    ```
  - **Trade-offs:**
    - ✅ Much faster queries (only reads what's needed)
    - ✅ Lower DynamoDB costs
    - ✅ Scales to millions of items
    - ❌ Can't jump to arbitrary page (e.g., "go to page 5")
    - ❌ Can't show total count or "page X of Y" in UI
    - ❌ Frontend must handle cursor tokens instead of page numbers
  - **Alternative (keep totCount):** Maintain count in metadata table
    - Store counts: `{ enabled: 2, disabled: 1, total: 3 }`
    - Update via DynamoDB Streams or in transactions
    - Allows keeping current API while still being efficient
  - **Impact:** Requires frontend changes to handle cursor tokens instead of page numbers
  - **Files:** `src/data/devices.ts`, `src/data/readings.ts`, API response types, frontend pagination components

- [ ] **Security Best Practice: Use AWS Secrets Manager for JWT_SECRET**
  - Current: `JWT_SECRET` stored as Lambda environment variable (visible in AWS Console)
  - Target: Store in AWS Secrets Manager and retrieve at runtime
  - Benefits: Automatic rotation, audit logging, encryption at rest, fine-grained access control
  - Cost: ~$0.40/month per secret + $0.05 per 10,000 API calls
  - Implementation example:
    ```typescript
    // In CDK (cdk/lib/api-stack.ts):
    import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
    
    const jwtSecret = secretsmanager.Secret.fromSecretNameV2(
      this, 
      'JwtSecret', 
      'sensor-api/jwt-secret'
    );
    
    // Grant Lambda read access
    jwtSecret.grantRead(apiLambda);
    
    // In Lambda code (src/lib/jwt.ts):
    // Use AWS SDK to retrieve secret value at runtime
    ```
  - Files: `cdk/lib/api-stack.ts`, `src/lib/jwt.ts`, `src/lib/env.ts`
- [ ] **Improve authentication security**
  - **Issue 1:** API keys never expire and can't be revoked individually (only by deleting from DB)
    - Solution: Add `expiresAt` and `revoked` fields to Auth table, check on validation
  - **Issue 2:** JWT tokens are generated in `sensor-data-sender` repo (client-side), exposing JWT_SECRET
    - Solution: Implement device auth flow - devices send API key, server generates and returns JWT token
    - This keeps JWT_SECRET server-side only
  - **Issue 3:** No API key rotation strategy
    - Solution: Add rotation script that generates new key, marks old as deprecated with grace period
  - Files: `src/data/auth.ts`, `src/lib/auth-middleware.ts`, `sensor-data-sender` repo

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
