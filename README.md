# Hintro Meeting Intelligence Service

> AI-powered Meeting Intelligence API — manage meetings, extract actionable insights, track action items, and send smart reminders.

[![Node.js](https://img.shields.io/badge/Node.js-20-green)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green)](https://mongodb.com/atlas)
[![Gemini AI](https://img.shields.io/badge/AI-Google_Gemini-blue)](https://ai.google.dev/)

## 🌐 Live Deployment

| Resource | URL |
|---|---|
| **API Base** | `https://hintro-meeting-intelligence.onrender.com` |
| **Swagger UI** | `https://hintro-meeting-intelligence.onrender.com/api-docs` |
| **Health Check** | `https://hintro-meeting-intelligence.onrender.com/health` |
| **Evaluation** | `https://hintro-meeting-intelligence.onrender.com/api/evaluation` |

---

## 📋 Features

- ✅ JWT Authentication (register / login)
- ✅ Meeting Management with full transcript storage
- ✅ AI-powered analysis via **Google Gemini** — summaries, action items, decisions, follow-ups
- ✅ Grounded citations — every AI output references transcript timestamps
- ✅ Hallucination prevention — citation validation + speaker verification
- ✅ Action Item CRUD with status tracking (PENDING → IN_PROGRESS → COMPLETED)
- ✅ Overdue detection
- ✅ Scheduled reminders via **node-cron** + **Resend email**
- ✅ Unified response format with trace IDs
- ✅ Structured logging (Winston)
- ✅ Input validation (Zod)
- ✅ Swagger / OpenAPI docs
- ✅ Docker support
- ✅ Pagination & filtering

---

## 🛠️ Setup & Local Development

### Prerequisites

- Node.js 18+
- MongoDB Atlas account (free tier)
- Google Gemini API key (free at [aistudio.google.com](https://aistudio.google.com))
- Resend account (free tier at [resend.com](https://resend.com))

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/hintro-meeting-intelligence.git
cd hintro-meeting-intelligence/backend
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Fill in your `.env` file:

```env
PORT=3000
NODE_ENV=development

# MongoDB Atlas connection string
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/hintro

# JWT (generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
JWT_SECRET=your_secret_here
JWT_EXPIRES_IN=7d

# Google Gemini AI
GEMINI_API_KEY=your_gemini_key_here
GEMINI_MODEL=gemini-1.5-flash

# Resend
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=reminders@yourdomain.com
RESEND_FROM_NAME=Hintro Reminders

# Reminder scheduler
REMINDER_CRON=0 * * * *
REMINDER_COOLDOWN_HOURS=24

# Evaluation endpoint
CANDIDATE_NAME=Piyush Gupta
CANDIDATE_EMAIL=your@email.com
REPOSITORY_URL=https://github.com/yourusername/hintro-meeting-intelligence
DEPLOYED_URL=https://hintro-meeting-intelligence.onrender.com
```

### 3. Run Locally

```bash
npm run dev       # Development with nodemon
npm start         # Production
npm test          # Run all tests
```

---

## 🚀 Deployment (Render.com)

1. Push code to a public GitHub repository
2. Create a new **Web Service** on [render.com](https://render.com)
3. Connect your GitHub repo
4. Set:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Add all environment variables from `.env.example` in the Render dashboard
6. Deploy

Alternatively, use the included `render.yaml` for one-click deployment.

---

## 🐳 Docker

```bash
# Build
docker build -t hintro-api .

# Run
docker run -p 3000:3000 --env-file .env hintro-api
```

---

## 📚 API Usage Examples

### Register a User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","password":"Password123"}'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Password123"}'
# Returns: { "data": { "token": "eyJ..." } }
```

### Create a Meeting
```bash
curl -X POST http://localhost:3000/api/meetings \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Sprint Planning",
    "participants": ["alice@example.com","bob@example.com"],
    "meetingDate": "2026-05-20T10:00:00Z",
    "transcript": [
      {"timestamp":"00:10","speaker":"John","text":"We should launch next Friday."},
      {"timestamp":"00:20","speaker":"Alice","text":"I will prepare release notes."}
    ]
  }'
```

### Analyze a Meeting
```bash
curl -X POST http://localhost:3000/api/meetings/MEETING_ID/analyze \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Overdue Action Items
```bash
curl http://localhost:3000/api/action-items/overdue \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Update Action Item Status
```bash
curl -X PATCH http://localhost:3000/api/action-items/ITEM_ID/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"COMPLETED"}'
```

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/           # DB + Swagger configuration
│   ├── middleware/       # traceId, auth, logging, validation, error handling
│   ├── models/           # User, Meeting, ActionItem Mongoose schemas
│   ├── routes/           # Express routers with Swagger JSDoc
│   ├── services/         # aiService (Gemini), emailService (Resend), reminderJob (cron)
│   ├── utils/            # logger (Winston), response builder
│   └── app.js            # Express app entry point
├── tests/                # Jest unit tests
├── docs/                 # Technical documentation
├── .env.example          # Environment variable template
├── Dockerfile            # Docker configuration
├── render.yaml           # Render.com deployment config
└── package.json
```

---

## 🧪 Running Tests

```bash
npm test                  # Run all tests with coverage
npm run test:watch        # Watch mode
```

---

## 📄 Documentation

| File | Description |
|---|---|
| [DECISIONS.md](./docs/DECISIONS.md) | Technical decision rationale |
| [AI_APPROACH.md](./docs/AI_APPROACH.md) | AI prompt design & hallucination prevention |
| [TESTING.md](./docs/TESTING.md) | Test scenarios & edge cases |
| [CHANGELOG.md](./docs/CHANGELOG.md) | Implementation milestones |
| [CHECKLIST.md](./docs/CHECKLIST.md) | Submission checklist |
