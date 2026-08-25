# HPI (Hyper Performance Indicator) — Architecture, Sections & Component Breakdown

Comprehensive architectural guide and functional breakdown of the HPI platform, detailing system structure, section types, components, and operational workflows for **Normal Users (Athletes)**, **Coaches**, and **Administrators**.

---

## 1. High-Level System Architecture

The HPI platform employs a **Layered Architecture** combining the **Data Mapper Repository Pattern**, an **Agentic AI Pipeline**, and a **Zero-Dependency Analytical Math Engine**.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    Frontend & Mobile Layer (React 18 & Capacitor)            │
│  - Web SPA & Native Android wrapper with Glassmorphism / Dynamic Theme Engine │
│  - Stream.io WebRTC Video Calls & Vapi.ai Conversational Voice Agent         │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │ HTTP / REST / WebRTC
┌──────────────────────────────────────▼───────────────────────────────────────┐
│                           API Gateway (FastAPI 3.10+)                        │
│  - 27 Router Modules, JWT Auth, PBKDF2 Hashing, Lifespan Migrations, Rate Lim │
└───────────┬──────────────────────────┬───────────────────────────┬───────────┘
            │                          │                           │
┌───────────▼────────────┐ ┌───────────▼────────────┐  ┌───────────▼───────────┐
│     Services Layer     │ │   Hybrid RAG Pipeline  │  │  Data Engine (Math)   │
│ - analytics_service    │ │ - schema_retriever     │  │ - DataMatrix (OLS)    │
│ - nutrition_service    │ │ - sql_generator        │  │ - StatEngine (IQR)    │
│ - exercise_service     │ │ - DuckDB Executor      │  │ - LinearAlgebra       │
│ - auth_service         │ │ - Qdrant + BGE Rerank  │  │ - MathUtils (INOL)    │
└───────────┬────────────┘ └───────────┬────────────┘  └───────────────────────┘
            │                          │
┌───────────▼──────────────────────────▼────────────┐
│                  Repository Layer                 │
│ - UserRepository          - WorkoutRepository     │
│ - MetricRepository        - ChatRepository        │
└──────────────────────────┬────────────────────────┘
                           │
┌──────────────────────────▼────────────────────────┐
│        Supabase PostgreSQL Relational Database    │
│  Users, Workouts, Sets, Metrics, Foods, Events    │
└───────────────────────────────────────────────────┘
```

### 1.1 Backend Subsystems
* **FastAPI Application (`backend/main.py`)**: 27 modular routers, lifespan database migrations, and rate-limiting middleware (`SlowAPI`).
* **Database Layer (`backend/database.py`)**: Supabase PostgreSQL with pooled connections (`ThreadedConnectionPool`) and auto-rollback transaction management.
* **Hybrid RAG Pipeline (`backend/pipeline/`)**: 4-stage retrieval augmenting LLM queries:
  1. *Stage 1A*: SQL Schema YAML documentation context.
  2. *Stage 1B*: Groq Intent Classifier (`llama-3.1-8b-instant`).
  3. *Stage 1C*: DuckDB SQL Generator (`openai/gpt-oss-120b`).
  4. *Stage 1D & 2*: In-memory SQL execution + Qdrant vector similarity search (`bge-large-en-v1.5`) & cross-encoder reranking (`bge-reranker-v2-m3`).
* **Data Science Engine (`backend/data_engine/engine.py`)**: Pure-Python numerical engine handling matrix transformations, OLS linear regression, moving averages, PCA power iteration, Epley/Brzycki 1RM estimates, and INOL stress scores.

### 1.2 Frontend & Mobile Subsystems
* **React 18 SPA (`frontend/src/`)**: Component-driven UI using modern glassmorphism, responsive CSS variables, and contextual theme overlays.
* **Capacitor Mobile Wrapper**: Native Android container with camera access, speech recognition, and haptic feedback.
* **Real-time Media**: `@stream-io/video-react-sdk` for live WebRTC coach-athlete video calls and `@vapi-ai/web` for hands-free voice AI conversations.

---

## 2. Normal User Experience (Athlete / Lifter)

Athletes interact with an adaptive training ecosystem structured into **4 Primary Sections** and **Global Ambient Services**.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              Athlete Experience                              │
├─────────────────┬──────────────────┬─────────────────┬───────────────────────┤
│ Command Center  │ Training Hub     │ Biometrics &    │ Coach Directory &     │
│ (/ & /recommend)│ (/workouts, /log)│ Health Telemetry│ Community Events      │
└─────────────────┴──────────────────┴─────────────────┴───────────────────────┘
```

### 2.1 Command Center
* **Purpose**: Real-time snapshot of training volume, readiness, and AI-generated adaptations.
* **Routes**: `/` (`Dashboard.js`), `/recommend` (`Recommend.js`)
* **Components**:
  - **`HeroMetricCards`**: Displays weekly training volume tonnage, active workout streak, estimated 1RM records, and rest day triggers.
  - **`VolumeProgressionChart`**: Recharts area/bar charts displaying actual tonnage vs. OLS regression trend lines.
  - **`MuscleDistributionRadar`**: Visual breakdown of volume distribution across push, pull, and legs muscle groups.
  - **`AIRecommendationCard` (*Coach Rurik*)**: Unified workout generator that factors in fatigue scores, active injuries, and medical conditions (hypertension, diabetes) to recommend customized multi-day workout splits.

### 2.2 Training Hub (Performance & Workouts)
* **Purpose**: Workout tracking, exercise reference library, and community challenges.
* **Routes**: `/workouts` (`Workouts.js`), `/log` (`LogWorkout.js`), `/exercises` (`Exercises.js`), `/challenges` (`Challenges.js`), `/progress` (`Progress.js`)
* **Components**:
  - **`WorkoutLogger`**: Set-by-set input with auto-calculated Epley 1RM, volume load, and rest timers.
  - **`ExerciseDirectory`**: Searchable catalog of **1,324 exercises** with animated GIF form demonstrations, primary/secondary muscle tags, and step-by-step execution cues.
  - **`ChallengeCard` & `Leaderboard`**: Multi-day fitness challenges with milestone progress tracking.
  - **`HeatmapCalendar`**: Activity density grid visualizing monthly workout frequency.

### 2.3 Biometrics & Health Telemetry
* **Purpose**: Full-body health telemetry, nutrition tracking, and injury monitoring.
* **Routes**: `/measurements` (`Measurements.js`), `/nutrition` (`Nutrition.js`), `/sleep` (`SleepTracker.js`), `/fatigue-check` (`FatigueCheck.js`), `/photos` (`ProgressPhotos.js`), `/injuries` (`InjuryLog.js`)
* **Components**:
  - **`QuickAddModal` & `AI Meal Scanner`**: Natural language meal logger parsing text/voice (e.g., *"3 eggs with whole wheat toast"*) into calories, protein, carbs, fat, and fiber via Groq LLM.
  - **`BodySilhouette` / `React Body Highlighter`**: Interactive 2D anatomical SVG map showing targeted muscles and color-coded injury zones.
  - **`FatigueIndexGauge`**: Calculates CNS and muscular readiness using Borg RPE ratings and sleep telemetry.
  - **`ProgressPhotoComparison`**: Side-by-side front/back physical transformation timeline.

### 2.4 Coach Directory & Community Events
* **Routes**: `/coach` (`CoachDashboard.js`), `/coach/events` (`EventsSection.js`)
* **Components**:
  - **`CoachDiscoveryGrid`**: Browse verified coaches with specialty tags, bios, ratings, and hire requests.
  - **`InteractiveGymMap`**: Leaflet dark-mode map pinpointing partner gyms and affiliated resident trainers across regions.
  - **`WorkshopRegistrationCard`**: Explore live workshops and community masterclasses with downloadable event passes.

### 2.5 Global Ambient Services
* **`HpiChat` (`HpiChat.js`)**: Floating ambient AI assistant supporting voice (Whisper ASR) and natural language logging with hidden action execution (`log_workout`, `log_meal`, `log_water`).
* **`IncomingCallListener` (`IncomingCallListener.js`)**: Background WebRTC listener for incoming coach video calls.
* **`OrbThemeSwitcher` (`OrbThemeSwitcher.js`)**: Real-time theme switcher across 6 visual modes (`Main`, `Dark`, `Fire`, `Queen`, `Monochrome`, `Night`).

---

## 3. Operator Experience — Personal Coach

Coaches access a dedicated workspace to manage athlete rosters, review AI diagnostics, assign programming, and host community events.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Coach Workspace (/coach/*)                           │
│  - Guarded by RequireCoachRole and Verification Status Checks               │
├─────────────────┬─────────────────┬──────────────────┬───────────────────────┤
│ Roster & Client │ Calendar &      │ AI Progress      │ Community Workshops   │
│ Telemetry       │ Scheduling      │ Reports          │ & Masterclasses       │
│ (/coach/roster) │(/coach/schedule)│(/coach/ai-reports│ (/coach/events)       │
└─────────────────┴─────────────────┴──────────────────┴───────────────────────┘
```

### 3.1 Verification & Onboarding (`/coach`)
* **Component**: `renderCoachOnboarding` in `CoachDashboard.js`
* **Features**: Multi-field registration requiring specialty, years of experience, training philosophy, and CV/certification document upload (`.pdf`, `.docx`, images) before roster access is unlocked.

### 3.2 Client Roster & Athlete Telemetry (`/coach/roster`)
* **Components**:
  - **`AthleteRosterList`**: Athlete cards displaying connected clients, pending invitations, and quick-action triggers.
  - **`AthleteDetailPanel`**: Performance deep-dive displaying client workout logs, 1RM curves, sleep averages, and calorie adherence.
  - **`BodyMapWidget`**: Highlights the client’s current injuries and fatigue distribution.
  - **`InviteAthleteModal`**: Connects athletes via email or handle lookup.

### 3.3 Coach Actions & Prescription Tools
* **Components**:
  - **`SuggestWorkoutModal` (`SuggestWorkoutModal.js`)**: Build and push custom multi-exercise workout routines directly to the athlete's training calendar.
  - **`AssignNutritionModal`**: Set personalized caloric targets and macro splits (protein, carb, fat).
  - **`SubmitCheckInModal`**: Record weekly check-in scores, adherence percentages, and structured feedback.
  - **`DownloadHtmlReport`**: Generates a self-contained, printable HTML client progress report.

### 3.4 Live Communications (Chat & Video)
* **Components**:
  - **`CoachChatModal` (`CoachChatModal.js`)**: 1-on-1 direct messaging with delivery and read receipts.
  - **`VideoCallScreen` (`VideoCallScreen.js`)**: Real-time WebRTC 1-on-1 video consultations powered by `@stream-io/video-react-sdk`.

### 3.5 Scheduling & Availability (`/coach/schedule`)
* **Component**: `ScheduleSection.js`
* **Features**: Interactive weekly calendar grid, availability window creation, time-slot blocking, and client consultation management.

### 3.6 Flagship AI Progress Reports (`/coach/ai-reports`)
* **Component**: `AiReportsSection.js`
* **Features**: Groq-powered AI progress engine synthesizing client workout volume, sleep data, and injury recovery trends into structured coaching summaries with fatigue risk alerts.

### 3.7 Challenges & Event Hosting (`/coach/events`)
* **Component**: `EventsSection.js`
* **Features**: Form to publish fitness workshops, masterclasses, and bootcamps, upload promotional posters, and manage attendee rosters.

---

## 4. Operator Experience — System Administrator

Administrators manage platform telemetry, user accounts, coach credential verifications, and incident reports via a dedicated administrative module (`/admin/*` guarded by `RequireAdmin.jsx`).

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Admin Panel (/admin/*)                               │
├─────────────────┬─────────────────┬──────────────────┬───────────────────────┤
│ Overview        │ Coach           │ User             │ Reports &             │
│ Metrics         │ Verifications   │ Management       │ Audit Log             │
│ (AdminOverview) │ (VerificationQ) │ (UserManagement) │ (ReportsInbox/Audit)  │
└─────────────────┴─────────────────┴──────────────────┴───────────────────────┘
```

### 4.1 Admin Overview (`/admin` -> `AdminOverview.jsx`)
* **Purpose**: High-level platform telemetry.
* **Features**: Active user counts, verified coaches, pending certification queues, total workouts logged, and database record counters.

### 4.2 Coach Verification Queue (`/admin` -> `CoachVerificationQueue.jsx`)
* **Purpose**: Audit and approve/reject trainer credentials.
* **Features**:
  - Review submitted coach applications, bios, and specialty tags.
  - In-browser CV document inspection.
  - One-click **Approve** (elevates user to `coach` role) or **Reject** (with customizable feedback notes sent to the applicant).

### 4.3 User Management (`/admin` -> `UserManagement.jsx`)
* **Purpose**: User database administration.
* **Features**:
  - Searchable list of all registered athlete, coach, and admin accounts.
  - Role management (switch between `athlete`, `coach`, `admin`).
  - Account status management (ban/unban, reset onboarding flags).

### 4.4 Reports Inbox (`/admin` -> `ReportsInbox.jsx`)
* **Purpose**: User support and bug resolution.
* **Features**: Triage submitted bug reports, user feedback, and flagged content with status tracking (`open`, `in_progress`, `resolved`).

### 4.5 Audit Log (`/admin` -> `AuditLog.jsx`)
* **Purpose**: Security and compliance tracking.
* **Features**: Chronological audit trail of role transitions, verification approvals/rejections, and system-level actions.

---

## 5. Role Comparison Matrix

| Capability / Section | Normal User (Athlete) | Coach Operator | Admin Operator |
| :--- | :---: | :---: | :---: |
| **Command Center & Personal Analytics** | Full Access | Full Access | Full Access |
| **Workout & Nutrition Logging** | Self-Logging + AI Scanner | Self-Logging | Self-Logging |
| **Hpi Ambient AI Assistant** | Full Access | Full Access | Full Access |
| **Athlete Roster Management** | — | Full Access | Read / Admin Audit |
| **Prescribe Workouts & Nutrition Targets**| — | Full Access | — |
| **WebRTC 1-on-1 Video Calls** | Client Participant | Host / Call Athlete | System Monitor |
| **AI Client Diagnostic Reports** | — | Full Access | — |
| **Create Workshops & Events** | Attend / Register | Create & Host | Manage / Delete |
| **Coach Verification Queue** | Submit CV | View Status | Review & Approve/Reject |
| **User Role & Account Management** | Edit Own Profile | Edit Own Profile | Global Management |
| **System Audit Logs & Reports Inbox** | Submit Reports | Submit Reports | Triage & Audit |
