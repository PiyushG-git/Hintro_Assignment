# Changelog

All notable changes to the Hintro Meeting Intelligence Service.

---

## [1.0.0] - 2026-06-08

### Added — Initial Release

#### Foundation
- Express 4 application setup with Helmet, CORS, rate limiting
- MongoDB Atlas connection with reconnect handling
- Winston structured logging (JSON in production, colorized in dev)
- Unified API response format (`{ traceId, success, data/error }`)
- Request trace ID middleware (UUID per request, forwarded via `X-Trace-Id` header)
- Global error handler with Mongoose CastError, ValidationError, and duplicate key support
- Zod validation middleware factory for body/query/params
- `GET /health` health check endpoint

#### Authentication
- `POST /api/auth/register` — User registration with bcrypt password hashing
- `POST /api/auth/login` — Login with JWT issuance
- `GET /api/auth/me` — Current user profile
- JWT middleware for protected routes

#### Meeting Management
- `POST /api/meetings` — Create meeting with transcript
- `GET /api/meetings` — List meetings with pagination + title/date filtering
- `GET /api/meetings/:id` — Get full meeting details

#### AI Analysis
- `POST /api/meetings/:id/analyze` — Mistral AI analysis
- Structured output: summary, action items, decisions, follow-up suggestions
- All outputs grounded in transcript with citation timestamps
- Post-generation citation timestamp validation (hallucination prevention)
- Post-generation speaker validation for action item assignees
- Auto-creation of ActionItem documents from AI output

#### Action Item Management
- `POST /api/action-items` — Create action item
- `GET /api/action-items` — List with status/assignee/meetingId filters + pagination
- `GET /api/action-items/overdue` — Overdue items (status != COMPLETED AND dueDate < now)
- `PATCH /api/action-items/:id/status` — Update status (PENDING → IN_PROGRESS → COMPLETED)
- `GET /api/action-items/:id` — Get single action item

#### Reminders & Integrations
- SendGrid email service with styled HTML reminder templates
- node-cron scheduler (configurable cron expression)
- 24-hour reminder cooldown deduplication
- Reminder history recorded on each ActionItem document

#### System
- `GET /api/evaluation` — Candidate information endpoint
- Swagger UI at `/api-docs` with full OpenAPI 3.0 specification
- Raw OpenAPI JSON at `/api-docs.json`

#### DevOps
- Dockerfile (node:20-alpine, non-root user, health check)
- `.dockerignore` for lean image builds
- `render.yaml` for one-click Render.com deployment
- `.env.example` with all variables documented
- `.gitignore`

#### Testing
- Jest + Supertest test suite
- `tests/auth.test.js` — 9 test cases
- `tests/meetings.test.js` — 8 test cases
- `tests/actionItems.test.js` — 9 test cases
- `tests/aiService.test.js` — 5 test cases (hallucination prevention focus)

#### Documentation
- `README.md` — Setup, deployment, API examples
- `docs/DECISIONS.md` — Technical decision rationale
- `docs/AI_APPROACH.md` — AI integration strategy
- `docs/TESTING.md` — Test scenarios and edge cases
- `docs/CHANGELOG.md` — This file
- `docs/CHECKLIST.md` — Submission checklist
