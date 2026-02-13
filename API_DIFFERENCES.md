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

_(To be documented as tests are written)_

---

## Statistics

_(To be documented as tests are written)_

---

## Aggregated Readings

_(To be documented as tests are written)_

---

## Notes

- These differences are by design as the new API follows more modern REST conventions
- Tests account for these differences to ensure functional equivalence
- Front-end will need to be updated when switching to the new API
