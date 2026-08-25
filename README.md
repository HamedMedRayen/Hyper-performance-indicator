<div align="center">

<br />

<img src="./frontend/public/logo/hpi-logo-white-bg.png" alt="HPI Logo" height="180" />

<p><strong>Production-Grade Workout Analytics API with AI Coaching, RAG-Powered Insights & Coach-Athlete Tools</strong></p>

<p>
  <a href="https://github.com/HamedMedRayen/Hyper-performance-indicator/stargazers">
    <img src="https://img.shields.io/github/stars/HamedMedRayen/Hyper-performance-indicator?style=flat-square&color=00BCD4" alt="Stars" />
  </a>
  <a href="https://github.com/HamedMedRayen/Hyper-performance-indicator/issues">
    <img src="https://img.shields.io/github/issues/HamedMedRayen/Hyper-performance-indicator?style=flat-square&color=00BCD4" alt="Issues" />
  </a>
  <img src="https://img.shields.io/badge/Python-3.10-blue?style=flat-square" alt="Python" />
  <img src="https://img.shields.io/badge/React-18.2-61DAFB?style=flat-square" alt="React" />
  <img src="https://img.shields.io/badge/Capacitor-8-119EFF?style=flat-square" alt="Capacitor" />
  <img src="https://img.shields.io/badge/Android-3DDC84?style=flat-square" alt="Android" />
  <img src="https://img.shields.io/badge/FastAPI-009688?style=flat-square" alt="FastAPI" />
  <img src="https://img.shields.io/badge/PostgreSQL-336791?style=flat-square" alt="PostgreSQL" />
</p>

<p>
  <a href="#features">Features</a> &nbsp;•&nbsp;
  <a href="#technology-stack">Stack</a> &nbsp;•&nbsp;
  <a href="#project-structure">Structure</a> &nbsp;•&nbsp;
  <a href="#getting-started">Getting Started</a> &nbsp;•&nbsp;
  <a href="#deployment">Deployment</a> &nbsp;•&nbsp;
  <a href="#contributing">Contributing</a>
</p>

<br />

</div>

---

**HPI** (`com.hpi.fitness`) is a cross-platform fitness application — Web and native Android via Capacitor — built for athletes and coaches. It combines an agentic AI chat coach, a 6-stage RAG-grounded recommendation pipeline, voice and video coaching sessions, workout/nutrition tracking, injury and recovery logging, and a full coach-athlete portal with AI-generated performance reports.

The web app is built with **Create React App**; the same codebase is wrapped with **Capacitor** for a native **Android** build. There is no React Native anywhere in the stack, and no iOS build currently exists.

> Backend package identity: `"HPI API"` — *"Production-grade workout analytics API"* (`backend/core/config.py`). Frontend package name: `hpi` (v1.0.0). Backend API version: `2.0.0`.

---

## Features

### 1. AI Chat Coach — "Hpi"
An agentic chat assistant that parses natural language (typed or spoken) into structured logging actions.
- Backend: `backend/routes/chat.py` (803 lines) — `POST /api/chat`, `GET /api/vapi/config`, `POST /api/chat/sync-vapi`
- Frontend: `frontend/src/components/HpiChat/HpiChat.jsx`
- Emits a hidden `[ACTION: {...}]` block per response, parsed server-side to trigger: `log_workout`, `log_meal`, `log_water`, `log_sleep`, `log_injury`

### 2. Voice AI (Vapi Integration)
Voice calls to the AI assistant, with spoken transcripts synced back for the same action-parsing pipeline as chat.
- Frontend: `VapiCallModal.jsx`, `utils/vapiService.js`
- Backend: `GET /api/vapi/config` in `chat.py`

### 3. Video Calling (Stream)
1:1 video calls between athletes and coaches.
- Frontend: `components/video/VideoCallScreen.js`, `IncomingCallListener.js`
- Backend (FastAPI): `routes/video_call.py` — `GET/POST /api/stream/token`, `POST /api/stream/call`
- Backend (Node.js): `backend/streamServer.js` — standalone Express server on port 5000 (uses `express`, `@stream-io/node-sdk`, `dotenv`, `cors` — not tracked in a `package.json`)

### 4. RAG-Powered Insights Engine
A 6-stage retrieval pipeline (`backend/pipeline/`) grounding AI answers in real member data:

| Stage | Component | File |
|---|---|---|
| 1A | Schema context loader (YAML) | `schema_retriever.py` |
| 1B | Question classifier (6 types via LLM) | `question_classifier.py` |
| 1C | Text-to-SQL generator (DuckDB dialect) | `sql_generator.py` |
| 1D | SQL executor over DuckDB / pandas | `sql_executor.py` |
| 2 | Qdrant semantic search + BGE cross-encoder rerank | `text_rag.py` |
| 3 | Context builder for LLM prompt injection | `context_builder.py` |

Question types: `PERFORMANCE_ANALYSIS`, `RECOMMENDATION`, `COMPARISON`, `TREND_PROGRESS`, `ADHERENCE_BEHAVIOR`, `GENERAL_OTHER`. The pipeline fails gracefully — any stage error returns an empty context string so the AI still responds without grounded data.

### 5. Workout Tracking
Full session logging with templates and progressive overload prompts.
- Frontend: `pages/LogWorkout.js`, `pages/Workouts.js`
- Backend: `routes/workouts.py`, `repositories/workout_repo.py`
- Widgets: `ExerciseTrackerWidget.js`, `ProgressiveOverloadSuggestion.js`; Modals: `TemplateModal.js`, `SuggestWorkoutModal.js`

### 6. Nutrition Tracking
Meal logging, food search, macro tracking, AI meal scanning, and recipe building.
- Frontend: `pages/Nutrition.js`
- Components: `FoodSearchModal.js`, `MealScanModal.js`, `RecipeBuilderModal.js`, `NutritionCalculator.js`, `CalorieRingHeader.js`, `WeeklyReportView.js`
- Backend: `routes/nutrition.py`, `services/nutrition_service.py`, `services/food_service.py`

### 7. Exercise Library
Searchable catalog with body-part filtering and an ExerciseDB API sync job.
- Frontend: `pages/Exercises.js`, `widgets/ExerciseDetailSheet.js`, `widgets/ExercisePicker.js`
- Backend: `routes/exercises.py`, `services/exercise_service.py`, `services/exercisedb_sync.py`
- Static media served from `exercises-dataset-main/`

### 8. AI Recommendations
Rule-based + LLM-powered workout plan recommendations by profile.
- Frontend: `pages/Recommend.js`, `modals/PlanPickerModal.js`
- Backend: `routes/ai_recommend.py`, `routes/recommendations.py`, `services/recommendation_engine.py`, `services/recommendation_service.py`
- Data: `data/workout_plans.json`, `data/recommendation_rules.json`

### 9. Coaching Zone
Coach-athlete management: rosters, scheduling, events, in-dashboard chat.
- Frontend: `pages/CoachDashboard.js` (largest file in the codebase), `coach/AiReportsSection.js`, `coach/EventsSection.js`, `coach/ScheduleSection.js`, `coach/InlineHpiChat.js`, `coach/CoachWorkspaceNav.js`
- Backend: `routes/coach.py`, `routes/coach_ai_report.py`, `routes/coach_schedule.py`, `routes/coach_chat.py`
- Modals: `CoachProfileModal.js`, `CoachChatModal.js`, `ReportCoachModal.js`

### 10. Coach AI Reports & Data Quality Audit
Generates AI performance summaries, but first audits data reliability over a 14-day window.
- Backend: `routes/coach_ai_report.py` — `perform_data_quality_audit()`
- Checks training, nutrition (flags implausible <800 or >6000 kcal/day), and sleep coverage; rates each `HIGH` (≥70%), `MODERATE` (≥40%), `LOW` (<40%), or `NO DATA`

### 11. Dashboard & Widgets
Drag-and-drop dashboard with 30 widget types (body map, calorie rings, hydration, fatigue history, PR trophies, streaks, volume progression, training splits, and more).
- Frontend: `pages/Dashboard.js`, `components/widgets/` (30 widgets), `modals/AddWidgetModal.js`
- Hooks: `hooks/useWidgets.js`, `hooks/useAnalytics.js`; Config: `config/widgets.js`

### 12. Progress & Analytics
Charts for measurements, progress photos, fatigue checks, and sleep.
- Frontend: `pages/Progress.js`, `pages/Measurements.js`, `pages/ProgressPhotos.js`, `pages/FatigueCheck.js`, `pages/SleepTracker.js`
- Backend: `routes/progress.py`, `routes/analytics.py`, `routes/measurements.py`, `routes/progress_photos.py`, `routes/sleep.py`, `routes/fatigue.py`

### 13. Seasonal Challenges
- Frontend: `pages/Challenges.js`
- Backend: `routes/challenges.py`, `services/challenge_service.py`
- Data: `data/fitness_challenges.json` (719 KB)

### 14. Injury Tracking
- Frontend: `pages/InjuryLog.js`
- Backend: `routes/injuries.py`

### 15. Events
Coach-organized events with registrations; seed data generated synthetically on startup.
- Backend: `routes/events.py`
- Frontend: `components/coach/EventsSection.js`

### 16. Auth & User Management
Local email/password, Google OAuth, and email OTP login; JWT (HS256, 24h expiry); onboarding flow.
- Frontend: `pages/AuthPage.js`, `utils/auth.js`, `components/onboarding/OnboardingFlow.js`
- Backend: `routes/auth.py`, `services/auth_service.py`, `services/email_service.py`
- Guards: `components/auth/RequireAdmin.js`, `components/auth/RequireCoachRole.js`

### 17. Admin Panel
- Frontend: `pages/admin/AdminDashboard.jsx`, `UserManagement.jsx`, `CoachVerificationQueue.jsx`, `ReportsInbox.jsx`, `AuditLog.jsx`, `AdminOverview.jsx`
- Backend: `routes/admin.py`, `repositories/admin_repository.py`

### 18. Theme System
7 animated fullscreen backgrounds controlling color tokens and glassmorphism effects: Fire, Flower, Leaf, Night, Sky, Main, Monochrome.
- Logic: `utils/theme.js`; Backgrounds: `components/backgrounds/`; Switcher: `layout/OrbThemeSwitcher.js`

### 19. Native Mobile App (Android)
- Shell: `frontend/src/mobile/MobileAppShell.js`, with dedicated `mobile/components/`, `mobile/pages/`, `mobile/styles/`

### 20. Custom Data Science Engine
A zero-external-dependency math/ML library — *"Uses ONLY: math, statistics, random"* (`backend/data_engine/engine.py`, 1,679 lines). Includes `DataMatrix`, `VectorOps`, `StatEngine`, `MathUtils`, `DistanceMetrics`, `LinearAlgebra` (Gram-Schmidt, QR, eigen), and activation functions.
- Synthetic data generator (`synthetic_gen.py`, 910 lines) expands a real 755-row CSV to 2,000 rows using a Linear Congruential Generator (Knuth parameters `a=1,664,525`, `c=1,013,904,223`, `m=2^32`) and a logarithmic strength-progression model.

> **Note:** `requirements.txt` also lists `scikit-learn`, used alongside this custom engine — the codebase is not exclusively dependency-free for ML.

### 21. Landing Page
- Frontend: `pages/LandingPage.js`

### 22. User Profile
- Frontend: `pages/Profile.js`
- Backend: `routes/users.py`, `routes/onboarding.py`

---

## AI/ML Models In Use

| Model | Role |
|---|---|
| `openai/gpt-oss-120b` | Primary chat/RAG LLM (via Groq) |
| `openai/gpt-oss-20b` | Fast question classification |
| `groq/compound` / `groq/compound-mini` | Fallback models in the LLM cascade |
| `qwen/qwen3.6-27b` | Fallback model + meal-photo vision analysis |
| `llama-3.3-70b-versatile` | Legacy fallback default |
| `BAAI/bge-large-en-v1.5` | Text embeddings (1024-dim) for Qdrant retrieval |
| `BAAI/bge-reranker-v2-m3` | Cross-encoder reranking |

**Fault-tolerant cascade** (`backend/services/llm_service.py`): messages are trimmed to ~3,000 tokens before sending, and further to ~1,750 tokens on rate-limit errors, falling through the model list above in order on HTTP 413 / TPM limits. All responses have emojis stripped via regex before returning.

---

## Technology Stack

### Frontend (`frontend/package.json`)

| Dependency | Version | Role |
|---|---|---|
| react / react-dom | ^18.2.0 | Core |
| react-scripts | 5.0.1 | Build (CRA) |
| react-router-dom | ^6.21.0 | Routing |
| recharts | ^2.10.3 | Charts |
| lucide-react | ^1.8.0 | Icons |
| react-grid-layout | ^2.2.3 | Dashboard layout |
| react-body-highlighter | ^2.0.5 | Body/injury map |
| leaflet | ^1.9.4 | Maps |
| @react-oauth/google | ^0.13.5 | Google OAuth |
| @stream-io/video-react-sdk | ^1.40.1 | Video calling |
| @vapi-ai/web | ^2.6.1 | Voice AI |
| @capacitor/core | ^8.3.4 | Native bridge |
| @capacitor/camera, /haptics, /keyboard, /preferences, /splash-screen, /status-bar | ^8.x | Native plugins |
| @capacitor-community/speech-recognition | ^7.0.1 | Native speech input |

Dev: `@capacitor/android` ^8.3.4, `@capacitor/cli` ^8.3.4, `cross-env` ^7.0.3

### Backend (`requirements.txt`)

| Dependency | Version | Role |
|---|---|---|
| fastapi, uvicorn[standard] | unpinned | Web framework / ASGI server |
| psycopg2-binary | unpinned | PostgreSQL driver |
| passlib[bcrypt], python-jose[cryptography] | unpinned | Password hashing, JWT |
| groq | unpinned | LLM client |
| slowapi | ==0.1.9 | Rate limiting |
| google-auth | ==2.37.0 | Google OAuth |
| transformers, torch, sentence-transformers | unpinned | Embedding / reranking models |
| qdrant-client | unpinned | Vector DB client |
| duckdb | unpinned | In-memory analytical SQL |
| pandas, numpy, scikit-learn, openpyxl | unpinned | Data processing |
| librosa, soundfile | unpinned | Audio processing |
| pydantic, pyyaml, python-dotenv | unpinned | Config & validation |

> Exact pins are not enforced in `requirements.txt` for most packages — only `slowapi` and `google-auth` are version-locked.

### Database

| Component | Details |
|---|---|
| Primary DB | PostgreSQL via Supabase (AWS `eu-west-1`) |
| Vector DB | Qdrant Cloud (AWS `us-west-1`) |
| Analytical SQL | DuckDB, in-memory, over pandas DataFrames for RAG queries |
| Legacy local | `aura_fit.db` (SQLite, present in repo but superseded by PostgreSQL) |

### Runtimes

| Runtime | Version | Source |
|---|---|---|
| Python | 3.10 | `backend.Dockerfile` (`python:3.10-slim`) |
| Node.js | 18 | `frontend.Dockerfile` (`node:18-alpine`) |

---

## Project Structure

```
Hpi/
├── backend/                        # FastAPI Python backend
│   ├── main.py                     # App entry point, lifespan, router registration
│   ├── database.py                 # PostgreSQL schema (1,470 lines), connection pooling
│   ├── rag_config.py               # RAG credentials & singleton clients (Qdrant, Groq)
│   ├── streamServer.js             # Standalone Node/Express server for Stream video tokens
│   ├── create_coaches.py           # Coach seed script
│   ├── core/config.py              # Settings (env vars, auth, CORS, ML params)
│   ├── routes/                     # 30 FastAPI routers
│   ├── services/                   # Business logic (LLM, exercise, food, ingestion, …)
│   ├── repositories/                # DB access layer
│   ├── models/                     # Pydantic schemas
│   ├── pipeline/                   # 6-stage RAG pipeline
│   ├── data_engine/                # Zero-dependency math/ML library + synthetic data generator
│   ├── knowledge_base/             # YAML schema docs for RAG SQL generation
│   ├── data/                       # JSON datasets (exercises, challenges, food, plans, rules)
│   ├── scripts/                    # DB seeding scripts
│   └── uploads/                    # User-uploaded files
├── frontend/                       # React 18 + Capacitor app
│   ├── package.json
│   ├── capacitor.config.js         # Android config (com.hpi.fitness)
│   ├── tailwind.config.js
│   ├── android/                    # Capacitor Android project
│   └── src/
│       ├── App.js                  # Routing, auth gates, theme overlays
│       ├── pages/                  # 17 page components + admin/ subfolder
│       ├── components/             # 14 component directories (HpiChat, VapiCallModal, video, coach, widgets, modals, nutrition, layout, backgrounds, charts, cards, common, auth, onboarding)
│       ├── hooks/                  # 5 custom hooks
│       ├── utils/                  # 14 utility modules
│       ├── config/                 # Widget configuration
│       └── mobile/                 # Mobile shell, components, pages, styles
├── RAG/                             # Embedding & backfill scripts (embed_gym_bge.py, backfill_qdrant.py) + gym_recommendation.xlsx (966 KB)
├── exercises-dataset-main/          # Static exercise images/videos (served at /exercises-dataset/)
├── docs/                            # LaTeX/HTML/Markdown reports
├── vectors/                         # Pre-computed embedding vectors
├── requirements.txt
├── backend.Dockerfile               # python:3.10-slim
├── frontend.Dockerfile              # node:18-alpine build → Nginx
├── render.yaml                      # Render deployment config (2 services)
└── .env                             # Root environment variables
```

---

## Getting Started

### Prerequisites
- Python 3.10
- Node.js 18
- A PostgreSQL instance (Supabase recommended)
- A Groq API key
- Qdrant Cloud instance (for the RAG pipeline)

### 1. Clone the Repository
```bash
git clone https://github.com/HamedMedRayen/Hyper-performance-indicator.git
cd Hyper-performance-indicator
```

### 2. Configure Environment Variables

**`backend/.env`** — variables actually read by the backend (`os.getenv`/`os.environ`):
```env
DATABASE_URL=
SUPABASE_URL=
SUPABASE_KEY=
SECRET_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GROQ_API_KEY=
GROQ_CHAT_MODEL=openai/gpt-oss-120b
CLASSIFICATION_MODEL=openai/gpt-oss-20b
SQL_GENERATION_MODEL=
GROQ_VISION_MODEL=qwen/qwen3.6-27b
CLUSTER_ENDPOINT=
CLUSTER_API=
EXERCISEDB_API_KEY=
CSV_PATH=
FRONTEND_URL=
BACKEND_URL=
SMTP_SERVER=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=
HF_TOKEN=
STREAM_API_KEY=
STREAM_API_SECRET=
STREAM_APP_ID=
VAPI_PUBLIC_KEY=
VAPI_API_KEY=
VAPI_ASSISTANT_ID=
VAPI_MODEL_ID=
```

**`frontend/.env`**:
```env
REACT_APP_API_URL=
REACT_APP_GOOGLE_CLIENT_ID=
REACT_APP_VAPI_PUBLIC_KEY=
REACT_APP_VAPI_ASSISTANT_ID=
REACT_APP_STREAM_API_KEY=
GENERATE_SOURCEMAP=false
```

### 3. Set Up the Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 4. Set Up the Frontend
```bash
cd frontend
npm install
npm start
```
Opens at `http://localhost:3000` (Create React App dev server).

### 5. Set Up the Stream Video Server (optional, for video calls)
`backend/streamServer.js` is a standalone Express server — it is **not** covered by `requirements.txt` or `frontend/package.json`. Install its dependencies manually and run it separately:
```bash
npm install express @stream-io/node-sdk dotenv cors
node backend/streamServer.js   # runs on port 5000
```

### 6. Run the Mobile App (Android)

**Development (live reload):**
```bash
cd frontend
npm start                 # terminal 1
npm run dev:android       # terminal 2 — sets CAPACITOR_LIVE_RELOAD=true, opens Android Studio
```

**Production build:**
```bash
cd frontend
npm run build:android     # build + cap sync
npx cap open android      # then Run in Android Studio
```

> No iOS project exists in this repo — Android is the only native target today.

---

## Deployment

Defined in `render.yaml` as two Render web services, both Docker-based:

| Service | Base | Runs |
|---|---|---|
| `aurafit-backend` | `python:3.10-slim` (`backend.Dockerfile`) | `uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}` |
| `aurafit-frontend` | `node:18-alpine` build → Nginx (`frontend.Dockerfile`) | `nginx -g "daemon off;"` |

The Node.js Stream video server (`streamServer.js`) is not part of `render.yaml` and would need its own deployment target if used in production.

---

## Contributing

Contributions, issues, and feature requests are welcome!
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

<div align="center">
  <sub>Built by <a href="https://github.com/HamedMedRayen">Hamed Med Rayen</a></sub>
</div>
