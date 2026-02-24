# Migrating from PostgreSQL (sensor_api-OLD) to DynamoDB

This guide covers moving production sensor data from the old PostgreSQL database (e.g. on a DigitalOcean server) into the new DynamoDB-backed sensor-api. A Node script connects to PostgreSQL, reads the four tables, maps rows to the new DynamoDB item shapes, and batch-writes to your deployed tables.

## Prerequisites

- PostgreSQL database reachable (e.g. SSH tunnel to DigitalOcean: `ssh -L 5432:localhost:5432 user@your-do-server`).
- AWS credentials and region configured so the script can write to DynamoDB.
- Production DynamoDB tables already created (e.g. after `npm run cdk:deploy`).
- Node 18+ and project dependencies installed (`npm install`).

### 1. Install PostgreSQL client (one-time, not needed for production deploy)

From the project root, install the driver used by the migration script:

```bash
npm install pg
npm install -D @types/pg
```

You can remove these after the migration if you want to keep production dependencies minimal.

### 2. Configure environment

Copy `.env.migration.example` to `.env.migration` and fill in values (or set env vars) so the script can reach both databases:

- **PostgreSQL** (required):
  - `PG_CONNECTION_STRING` – e.g. `postgresql://user:password@localhost:5432/sensor_db`
  - If the DB is on a remote server, use an SSH tunnel first:  
    `ssh -L 5432:localhost:5432 user@your-digitalocean-ip`
- **DynamoDB** (required):
  - `AWS_REGION` – e.g. `eu-north-1`
  - AWS credentials (e.g. `aws configure` or `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`).

### 3. Run the migration script

```bash
npm run migrate:pg-to-dynamodb
```

The script will:

- Read from PostgreSQL: `device`, `user`, `auth`, `reading`.
- Map to DynamoDB items (e.g. `device` → `id`, `name`, `location`, `order`, `type`, `disabled`; `reading.device` + `created_at` → `deviceId` + `timestamp`; `user.password` → `passwordHash`; `auth.api_key` / `auth.device` → `apiKey` / `deviceId`).
- Batch-write into the four DynamoDB tables (devices first, then users, auth, then readings).
- Set each device’s `latestReadingId` to the latest reading timestamp for that device.

Run it once; re-running will overwrite items with the same keys (PutItem/BatchWriteItem).

## Schema mapping reference

| PostgreSQL (old) | DynamoDB (new) |
|------------------|----------------|
| **device**       | **devices**    |
| id               | id (partition key) |
| name             | name           |
| location_type    | location.type  |
| location_x, location_y | location.x, location.y |
| order            | order          |
| type             | type           |
| disabled         | disabled       |
| latest_reading   | latestReadingId (set from latest reading timestamp) |
| **user**         | **users**      |
| username         | username (partition key) |
| password         | passwordHash   |
| salt             | salt           |
| disabled         | disabled       |
| **auth**         | **auth**       |
| api_key          | apiKey (partition key) |
| device           | deviceId       |
| description      | description    |
| **reading**      | **readings**   |
| device           | deviceId (partition key) |
| created_at       | timestamp (sort key, ISO 8601) |
| temperature, humidity, pressure, lux, battery | same names |

## After migration

- Verify row counts (e.g. in AWS Console → DynamoDB → Tables → Item count).
- Run the new API against DynamoDB and spot-check devices, readings, and auth.
- Keep the old PostgreSQL DB read-only for a while until you are confident in the new system.
