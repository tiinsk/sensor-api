# Production Setup Guide

This guide covers AWS account setup, deploying the Sensor API to AWS, and configuring production users and API keys. It is the single reference for "set up AWS, deploy, then set up production credentials."

---

## 1. Prerequisites

- **AWS account** (free tier available at https://aws.amazon.com/).
- **Node.js** and **npm**. Build and deploy from a machine that can run CDK.
- **AWS CDK CLI** (`npm install -g aws-cdk` if not already available).
- **AWS CLI** and credentials (see section 2).

---

## 2. AWS account and CLI setup

### 2.1 Install AWS CLI

- **macOS (Homebrew):** `brew install awscli`
- **macOS (pkg):** https://awscli.amazonaws.com/AWSCLIV2.pkg
- **Linux:** https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
- **Windows:** https://awscli.amazonaws.com/AWSCLIV2.msi

Verify: `aws --version`

### 2.2 Get credentials (IAM user with access keys)

Use an IAM user and access keys for the CLI. Do **not** use the root account for day-to-day use.

**Create a New User**

1. Click "Users" in the left sidebar
2. Click "Create user" button
3. Enter username: `sensor-api-deployer` (or any name you like)
4. Click "Next"

**Set Permissions**

- Click "Attach policies directly"
- Search for and select these policies (minimal set for CDK bootstrap and deploy):
    - `AWSCloudFormationFullAccess`
    - `AmazonDynamoDBFullAccess`
    - `AWSLambda_FullAccess`
    - `AmazonAPIGatewayAdministrator`
    - `IAMFullAccess`
    - `AmazonS3FullAccess` (CDK bootstrap assets bucket)
    - `AmazonSSMFullAccess` (CDK bootstrap)
    - `AmazonEC2ContainerRegistryFullAccess` (CDK asset publishing)
5. Click "Next"
6. Review and click "Create user"

**Create Access Keys**

You may see a warning like *"Alternatives recommended: Use aws login or CloudShell"*. That is AWS promoting other sign-in methods. For a single account without IAM Identity Center, **access keys are the normal way** to use the CLI from your own machine. Choose **Command Line Interface (CLI)** and continue; the key is what `aws configure` and CDK will use.

1. Click on the user you just created (`sensor-api-deployer`)
2. Click on "Security credentials" tab
3. Scroll down to "Access keys"
4. Click "Create access key"
5. Select "Command Line Interface (CLI)"
6. Check the confirmation box
7. Click "Next"
8. (Optional) Add description: "Local development"
9. Click "Create access key"

**Save Your Credentials**

Save the **Access key ID** and **Secret access key** immediately — the secret is shown only once. Store them in a password manager.

### 2.3 Configure AWS CLI

```bash
aws configure
# Enter: Access Key ID, Secret Access Key, region (e.g. us-east-1), output (e.g. json)
```

To use a named profile instead of default, run `aws configure --profile your-profile-name`, then use `AWS_PROFILE=your-profile-name` when running CDK or scripts (or set `export AWS_PROFILE=your-profile-name` in your shell profile so it applies to every terminal).

### 2.4 Verify

```bash
aws sts get-caller-identity
```

You should see your account ID and identity (user or assumed-role). If this works, you are authenticated.

### 2.5 Optional: SAM CLI (for local Lambda testing)

To run the API locally with SAM: install [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html). Not required for deploying to AWS with CDK.

---

## 3. Build and deploy

1. **Build the project**

   ```bash
   npm run build
   ```

   **Why:** `npm run build` compiles the **CDK stacks** (TypeScript → JavaScript in `dist/cdk`). Deploy runs that compiled CDK app. The **Lambda** code is built separately by CDK during deploy: CDK reads your `src/` (`dist/src` is not needed for deployment) TypeScript and bundles it (with all npm dependencies) into the package that gets uploaded. So you only need to run `build` before deploy for production. The `npm run bundle` script is for running the API locally with SAM.


2. **Store the JWT secret in AWS Secrets Manager (one-time).**  
   The Lambda reads the JWT secret from Secrets Manager at runtime; you never pass the secret value at deploy time.

   Create the secret (use the same region as your deploy):
   ```bash
   aws secretsmanager create-secret \
     --name sensor-api/jwt-secret \
     --secret-string "$(openssl rand -base64 32)"
   ```
   Or create it in the AWS Console (Secrets Manager → Store a new secret → Other type of secret → Plaintext, paste a generated secret). Note the **secret name** (e.g. `sensor-api/jwt-secret`).
   **Save the secret value somewhere secure** (e.g. password manager) if you need it for the `create:user:prod` and `create:api-key:prod` scripts; the Lambda does not need it in its environment.

3. **Bootstrap CDK (one-time per account and region).**  
   If you have not run CDK bootstrap in this account/region before, run once:
   ```bash
   cd cdk && cdk bootstrap --context jwtSecretName=sensor-api/jwt-secret
   ```

4. **Deploy the stacks:**
   ```bash
   npm run cdk:deploy
   ```
   The CDK uses the secret name `sensor-api/jwt-secret` (passed via the script in package.json). Approve IAM changes if prompted. The Lambda will receive the secret ARN and fetch the value from Secrets Manager at cold start.


5. **Capture outputs**  
   Note the API URL and table names (devices, readings, users, auth) from the CDK outputs. You need these for the production scripts and for any custom IAM policies.

---

## 4. Post-deploy: create first user (production)

**Important:** `npm run create:user` **by default** uses `.env.local` and usually `USE_LOCAL_DB=true`, so it targets **local** DynamoDB. For production, you must use the dedicated production script.

**Before running this command:** you need to have `.env.production` file setup containing following:

   ```bash
   JWT_SECRET=your-production-jwt-secret-from-aws-secret-manager
   AWS_REGION=eu-north-1
   USE_LOCAL_DB=false
   NODE_ENV=production
   ```


```bash
npm run create:user:prod
```

---

## 5. Post-deploy: create API key (production)

For production, use **only** the dedicated script `create:api-key:prod`. Do not use `npm run create:api-key` for production (that targets local by default).

This command also requires the same `.env.production` as `npm run create:user:prod`.

### Exact command (production)

```bash
npm run create:api-key:prod
```

---

## 6. Using the credentials

### User login (web app)

```bash
POST /api/login
Content-Type: application/json

{
  "username": "admin",
  "password": "your_password"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "username": "admin"
}
```

Use the token for subsequent requests:
```
Authorization: Bearer <token>
```

### API key (devices / API clients)

Use the **JWT token** that the script printed (not the raw API key string) in the `Authorization` header:

```bash
POST /api/devices/device-001/readings
Authorization: Bearer <jwt-token-printed-by-script>
Content-Type: application/json

{
  "temperature": 22.5,
  "humidity": 45.0
}
```

Use the production API base URL from the CDK deploy output.

---

## 7. Troubleshooting

- **"User/API key created but I can't log in"**  
  Confirm you created the user or key in **production**: correct region, production table names (i.e. used the `:prod` scripts).

- **"AWS credentials not found" / "Permission denied"**  
  Set credentials (e.g. `AWS_PROFILE` or `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`) and `AWS_REGION` and check access rights.

- **Wrong table**  
  Production tables have no `TEST-` prefix. The `TEST-` prefix is used only when `NODE_ENV=test`.

---

## 8. Best practices

- Save API keys immediately; they are shown only once.
- Use strong passwords and rotate keys periodically.
- Do not commit `JWT_SECRET` or API keys to git.
- Production deploy uses **AWS Secrets Manager** for the JWT secret (see Build and deploy above); keep the secret value for running `create:user:prod` and `create:api-key:prod`.

---

## 9. Local vs production

| Context    | DynamoDB              | User/API key scripts        |
| --------- | --------------------- | --------------------------- |
| **Local** | DynamoDB Local        | `npm run create:user`, `npm run create:api-key` (no `:prod`) |
| **Production** | AWS DynamoDB (deployed tables) | `npm run create:user:prod`, `npm run create:api-key:prod` with AWS credentials and region |

Local setup: `npm run dynamodb:start`, `npm run tables:create`, `npm run seed:local`, then create users/keys with the non-`:prod` scripts. Production: deploy with CDK, then use only the `:prod` scripts with production AWS credentials.

---

## 10. Stack destruction

Running `cdk destroy` (or `npm run cdk:destroy`) removes the Lambda and API Gateway but **does not** delete the DynamoDB tables (they use `RemovalPolicy.RETAIN`). To remove tables you must delete them manually in the AWS Console or via the CLI.

---

## 11. Common issues

- **"AWS Access Key ID does not exist"** — Check that you copied the access key correctly and ran `aws configure` (or use the correct SSO profile with `AWS_PROFILE=...`).
- **"Permission denied" when deploying** — The IAM identity (user or Identity Center role) needs sufficient permissions; add the policies listed in section 2.2 or use AdministratorAccess for learning.
- **"CDK not found" or deploy fails** — Run `npm install` in the project, then `npm run build`, then `npm run cdk:deploy`.
- **Docker not running (local DynamoDB)** — Install and start Docker Desktop if you use `npm run dynamodb:start`.
- **Can't connect to local DynamoDB** — Run `docker ps` to confirm containers; try `npm run dynamodb:stop` then `npm run dynamodb:start`.

---

## 12. Cost monitoring

- **Billing:** https://console.aws.amazon.com/billing/
- **Budgets:** Create a budget (e.g. "Zero spend") at https://console.aws.amazon.com/billing/home#/budgets to get email alerts when charges occur.
- **Typical cost** for light use (testing/personal): DynamoDB, Lambda, and API Gateway often stay within free tier; total around **$0–0.50/month**.

---

## Quick reference

```bash
# Local development
npm run dynamodb:start    # Start local DynamoDB
npm run tables:create     # Create tables locally
npm run seed:local        # Seed test data
npm run sam:local         # Run API locally

# Production deploy
npm run build             # Compile (required before deploy)
npm run cdk:deploy        # Deploy to AWS
npm run create:user:prod  # Create production user
npm run create:api-key:prod  # Create production API key

# AWS CLI
aws sts get-caller-identity   # Check who you're logged in as
aws dynamodb list-tables      # List DynamoDB tables
```

---

## Deployment notes (CDK limitations and improvements)

- **JWT secret**  
  Production deploy uses **AWS Secrets Manager** only: create the secret and pass its **name** to CDK (`--context jwtSecretName=sensor-api/jwt-secret`). The Lambda reads the value at runtime; the secret is never in Lambda env. Local development uses `JWT_SECRET` from `.env.local` (no CDK deploy).

- **CORS**  
  The API is deployed with CORS `allowOrigins: ['*']`. For production, restrict CORS to your front-end origin(s). See the README "TODO / Technical Debt" for the tracked improvement.

- **Build before deploy**  
  Always run `npm run build` before `npm run cdk:deploy`, because the Lambda code is taken from `dist/src` (tsc output), not from the bundle.

---

