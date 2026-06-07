# Testing Documentation

## Test Strategy

Tests are written with **Jest** and **Supertest**. All external dependencies (MongoDB, Gemini API, SendGrid) are mocked to ensure tests run in isolation without needing any live services.

---

## Running Tests

```bash
npm test              # Run all tests with coverage report
npm run test:watch    # Watch mode for development
```

---

## Test Files

| File | Coverage |
|---|---|
| `tests/auth.test.js` | Registration validation, login, duplicate email, traceId |
| `tests/meetings.test.js` | Create, list pagination, analyze endpoint, 404 |
| `tests/actionItems.test.js` | Create, status update, overdue, filter validation |
| `tests/aiService.test.js` | Citation validation, speaker validation, malformed JSON |

---

## Test Scenarios Executed

### Authentication
- ✅ Register with missing name → 422 VALIDATION_ERROR
- ✅ Register with invalid email → 422 VALIDATION_ERROR
- ✅ Register with short password (< 8 chars) → 422 VALIDATION_ERROR
- ✅ Register with duplicate email → 409 DUPLICATE_KEY
- ✅ Successful registration → 201 with JWT token
- ✅ Login with wrong credentials → 401 INVALID_CREDENTIALS
- ✅ Login with non-existent user → 401 INVALID_CREDENTIALS
- ✅ All responses include traceId field

### Meetings
- ✅ Create meeting without auth → 401 UNAUTHORIZED
- ✅ Create with empty title → 422 VALIDATION_ERROR
- ✅ Create with invalid participant email → 422 VALIDATION_ERROR
- ✅ Create with empty transcript → 422 VALIDATION_ERROR
- ✅ Successful meeting creation → 201 with meeting object
- ✅ List meetings returns pagination metadata
- ✅ Analyze non-existent meeting → 404 NOT_FOUND
- ✅ Analyze returns analysis with citations

### Action Items
- ✅ Create without auth → 401 UNAUTHORIZED
- ✅ Create with empty task → 422 VALIDATION_ERROR
- ✅ Create with invalid dueDate → 422 VALIDATION_ERROR
- ✅ Successful creation → 201 with PENDING status
- ✅ Status update with invalid value → 422 VALIDATION_ERROR
- ✅ Status update of non-existent item → 404 NOT_FOUND
- ✅ Successful status update → 200 with new status
- ✅ Overdue endpoint returns list and count
- ✅ Filter with invalid status enum → 422 VALIDATION_ERROR
- ✅ Filter by valid status → 200 with filtered list

### AI Service (Unit Tests)
- ✅ Returns analysis with correct citation structure
- ✅ Strips invalid timestamps from citations (hallucination prevention)
- ✅ Nullifies assignees not present in transcript speakers
- ✅ Throws meaningful error on malformed JSON response
- ✅ Handles empty transcript sections gracefully

---

## Edge Cases Considered

| Edge Case | Handling |
|---|---|
| AI returns invalid JSON | Caught in try/catch; returns 502 AI_SERVICE_ERROR |
| AI cites non-existent timestamp | Removed post-generation with warning log |
| AI assigns task to non-speaker | Assignee nullified |
| Invalid MongoDB ObjectId in path param | CastError caught by global error handler → 400 |
| Duplicate email registration | Caught by findOne check → 409 |
| Expired JWT token | Caught by auth middleware → 401 |
| Missing Authorization header | Caught by auth middleware → 401 |
| Malformed request body | Caught by Zod validation → 422 |
| Rate limit exceeded | express-rate-limit → 429 |
| Unknown route | 404 handler → 404 NOT_FOUND |

---

## Limitations Discovered

1. **Integration tests not included** — Tests mock DB and external services. Real integration tests against a live MongoDB and Gemini instance would catch schema-level issues.
2. **Reminder job not directly tested** — The cron scheduler is tested by calling `processReminders()` directly in a unit test scenario, but the full cron timing is not verified.
3. **No load testing** — Performance under concurrent requests has not been profiled.
4. **Gemini response variability** — Since Gemini output is non-deterministic (even at low temperature), exhaustive citation pattern testing is done on the validation code, not on actual Gemini calls.
