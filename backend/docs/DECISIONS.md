# Technical Decisions

This document explains the key architectural and technical decisions made for the Hintro Meeting Intelligence Service.

---

## 1. Runtime & Framework: Node.js + Express

**Choice:** Node.js 20 LTS with Express 4

**Rationale:**
- Non-blocking I/O is ideal for this use case — most operations are I/O bound (DB queries, AI API calls)
- Vast npm ecosystem with direct SDKs for Gemini and SendGrid
- Easy to deploy on Render.com with zero configuration

**Alternatives Considered:**
- **Fastify** — slightly faster but less widely known; Express is more readable for reviewers
- **NestJS** — more opinionated structure but adds complexity overhead for an assignment scope

**Trade-offs:**
- Express requires explicit structure setup; handled by consistent folder organization

---

## 2. Database: MongoDB Atlas (Mongoose)

**Choice:** MongoDB with Mongoose ODM

**Rationale:**
- Meeting transcripts are naturally document-shaped (nested arrays of entries)
- Flexible schema accommodates optional analysis result which is a complex nested object
- MongoDB Atlas free tier (512MB) is sufficient for an evaluation
- Mongoose provides validation at the ORM layer in addition to Zod at the route layer

**Alternatives Considered:**
- **PostgreSQL** — would require JSON columns for transcript storage; joins for citations
- **SQLite** — simpler for local dev but harder to deploy persistently on Render

**Trade-offs:**
- No foreign key enforcement at DB level; handled via Mongoose `ref` and application logic
- Schema flexibility means more discipline required on writes (mitigated by Zod validation)

---

## 3. Authentication: JWT (JSON Web Tokens)

**Choice:** Stateless JWT with 7-day expiry

**Rationale:**
- No session storage required — perfectly stateless and horizontally scalable
- Standard for REST APIs; evaluators can easily test via Swagger UI's "Authorize" button
- `jsonwebtoken` library is battle-tested

**Alternatives Considered:**
- **Session-based auth** — requires server-side storage (Redis or DB sessions); adds complexity
- **OAuth 2.0** — overkill for this scope; appropriate for multi-tenant production systems

**Trade-offs:**
- JWTs cannot be invalidated before expiry without a blocklist. For this scope, 7-day expiry with secure secret is acceptable
- Mitigated in production by short-lived tokens + refresh token pattern (not implemented for brevity)

---

## 4. AI Provider: Google Gemini 1.5 Flash

**Choice:** `gemini-1.5-flash` with `responseMimeType: 'application/json'`

**Rationale:**
- Free tier is generous and sufficient for evaluation
- JSON mode (`responseMimeType: 'application/json'`) produces reliable structured output
- Low temperature (0.1) produces factual, consistent responses
- No credit card required unlike OpenAI for free usage

**Alternatives Considered:**
- **OpenAI GPT-4** — excellent quality but requires paid account
- **Claude (Anthropic)** — also excellent but requires paid account for API access

**Trade-offs:**
- Gemini Flash occasionally produces slightly less nuanced analysis than GPT-4; acceptable for this use case
- The structured JSON output mode sometimes omits optional fields; handled by post-processing defaults

---

## 5. External Integration: SendGrid Email API

**Choice:** SendGrid `@sendgrid/mail` v8

**Rationale:**
- Free tier: 100 emails/day (3,000/month) — sufficient for an evaluation
- Industry standard; evaluators will recognize it
- Rich email with HTML templates demonstrates practical production thinking
- Official SDK is simple and well-documented

**Alternatives Considered:**
- **Discord Webhook** — very easy but less "production-grade" feel
- **Telegram Bot** — requires creating a bot and chat ID setup; extra friction
- **Resend** — good alternative but SendGrid is more established

**Trade-offs:**
- Requires a verified sender domain in SendGrid for production. For evaluation, using the "from" address with single sender verification is sufficient

---

## 6. Input Validation: Zod

**Choice:** Zod v3

**Rationale:**
- TypeScript-style schema declaration in plain JavaScript
- Produces excellent error messages by default
- Coercion support (e.g., query param numbers) built in
- Composable schema building

**Alternatives Considered:**
- **Joi** — the classic choice, but Zod has a more modern API and TypeScript-first design
- **express-validator** — middleware-based; less composable than schema-centric validation

---

## 7. Logging: Winston

**Choice:** Winston with JSON format in production, colorized dev format

**Rationale:**
- Supports multiple transports (console, file)
- Structured JSON logs are compatible with any log aggregation tool (Datadog, CloudWatch, etc.)
- Custom format includes traceId in every log line

**Alternatives Considered:**
- **Pino** — faster but less ecosystem tooling for transports
- **console.log** — not structured; not appropriate for production

---

## 8. Scheduler: node-cron

**Choice:** `node-cron` v3

**Rationale:**
- Zero infrastructure dependencies (no Redis, no worker queues)
- Runs in-process; sufficient for this scale
- Standard cron expression syntax

**Alternatives Considered:**
- **Bull/BullMQ** — excellent for distributed workloads but requires Redis
- **Agenda** — MongoDB-backed job queue; good fit but adds complexity

**Trade-offs:**
- In-process cron doesn't survive crashes; for production, a queue system is recommended
- Cooldown deduplication (24-hour check) prevents duplicate reminders even if the process restarts

---

## 9. Project Structure

**Choice:** Feature-based with service layer separation

```
src/
├── config/       # Infrastructure connections (DB, Swagger)
├── middleware/   # Cross-cutting concerns
├── models/       # Data layer
├── routes/       # HTTP layer (thin controllers)
├── services/     # Business logic (AI, email, scheduler)
└── utils/        # Pure utilities
```

**Rationale:**
- Routes are thin — they delegate to services and models
- Services contain all business logic; easily unit testable
- Clear separation enables adding more integrations without touching routes
