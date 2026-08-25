"""
HPI — Database Layer (Supabase / PostgreSQL)
==================================================
Replaces the SQLite layer.  Uses psycopg2 with RealDictCursor so every
row comes back as a plain dict — same interface the rest of the app expects.

Key differences from SQLite version:
  • Placeholder  ?  →  %s
  • AUTOINCREMENT  →  BIGSERIAL
  • datetime('now')  →  NOW()
  • No PRAGMA statements
  • conn.row_factory  →  cursor_factory=RealDictCursor
  • lastrowid  →  RETURNING id  (see repositories)
"""

import os
import psycopg2
import psycopg2.extras
import psycopg2.errors
import psycopg2.pool
import sys
from pathlib import Path
from typing import Generator

sys.path.insert(0, str(Path(__file__).parent.parent))
from core.config import settings

BASE_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

def exercise_urls(row: dict) -> dict:
    """Convert relative image/gif paths to full URLs."""
    if not row:
        return row
    
    img = row.get("image_path") or row.get("image_url")
    if img:
        row["image_url"] = img if (img.startswith("http://") or img.startswith("https://")) else f"{BASE_URL}/exercises-dataset/{img}"
    else:
        row["image_url"] = None

    gif = row.get("gif_path") or row.get("gif_url")
    if gif:
        row["gif_url"] = gif if (gif.startswith("http://") or gif.startswith("https://")) else f"{BASE_URL}/exercises-dataset/{gif}"
    else:
        row["gif_url"] = None

    return row



SCHEMA_SQL = """
-- ── Auth users ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth_users (
    id            BIGSERIAL PRIMARY KEY,
    nickname      TEXT      UNIQUE, -- Optional if using email
    email         TEXT      UNIQUE, -- Required for Gmail/Email-code
    password_hash TEXT,             -- Nullable for OAuth/Email-code users
    provider      TEXT      DEFAULT 'local', -- 'local', 'google', 'email-code'
    email_otp     TEXT,             -- For email-code login
    email_otp_exp TIMESTAMPTZ,      -- OTP expiry
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Users (profile) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id           BIGSERIAL PRIMARY KEY,
    auth_id      BIGINT REFERENCES auth_users(id) ON DELETE CASCADE,
    name         TEXT    NOT NULL,
    email        TEXT    UNIQUE NOT NULL,
    bodyweight   REAL    DEFAULT 0.0,
    sex          TEXT    DEFAULT 'M',
    age          INTEGER DEFAULT 0,
    height_cm    REAL    DEFAULT 0.0,
    experience   TEXT    DEFAULT 'beginner',
    goal         TEXT    DEFAULT 'general',
    hypertension TEXT    DEFAULT 'No',
    diabetes     TEXT    DEFAULT 'No',
    role         TEXT    DEFAULT 'athlete',
    is_suspended BOOLEAN DEFAULT FALSE,
    suspension_reason TEXT,
    suspended_until TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    avatar_url   TEXT,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    onboarding_data JSONB DEFAULT '{}'::jsonb,
    coach_verified BOOLEAN DEFAULT FALSE,
    verification_status TEXT DEFAULT 'unsubmitted',
    rejection_reason TEXT
);

-- ── Coach Verifications ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS coach_verifications (
    id               BIGSERIAL PRIMARY KEY,
    coach_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status           TEXT DEFAULT 'pending',
    document_urls    JSONB DEFAULT '[]'::jsonb,
    submitted_at     TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at      TIMESTAMPTZ,
    reviewed_by      BIGINT REFERENCES users(id) ON DELETE SET NULL,
    rejection_reason TEXT
);

-- ── Admin Actions Audit Log ─────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_actions (
    id           BIGSERIAL PRIMARY KEY,
    admin_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type  TEXT NOT NULL,
    target_type  TEXT NOT NULL,
    target_id    BIGINT,
    reason       TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── User Reports (Coach & Bug Reports) ───────────────────────
CREATE TABLE IF NOT EXISTS reports (
    id             BIGSERIAL PRIMARY KEY,
    reporter_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    report_type    TEXT NOT NULL,
    target_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    category       TEXT NOT NULL,
    description    TEXT NOT NULL,
    screenshot_url TEXT,
    app_context    TEXT,
    status         TEXT DEFAULT 'open',
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    resolved_at    TIMESTAMPTZ,
    resolved_by    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    admin_notes    TEXT
);

CREATE INDEX IF NOT EXISTS idx_coach_verifications_status ON coach_verifications(status);
CREATE INDEX IF NOT EXISTS idx_coach_verifications_coach ON coach_verifications(coach_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_type ON admin_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_reports_type_status ON reports(report_type, status);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);

-- ── Body parts ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS body_parts (
    id   BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);

-- ── Equipment ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment_catalog (
    id   BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);

-- ── Exercises ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exercises (
    id                BIGSERIAL PRIMARY KEY,
    name              TEXT UNIQUE NOT NULL,
    body_part_id      BIGINT REFERENCES body_parts(id),
    muscle_group      TEXT DEFAULT 'unknown',
    equipment         TEXT DEFAULT 'unknown',
    primary_muscles   TEXT DEFAULT '',
    secondary_muscles TEXT DEFAULT '',
    description       TEXT DEFAULT '',
    external_uuid     TEXT DEFAULT NULL,
    gif_url           TEXT DEFAULT NULL,
    instructions      TEXT DEFAULT NULL,
    source            TEXT DEFAULT 'user'
);

-- ── Custom exercises ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_exercises (
    id                BIGSERIAL PRIMARY KEY,
    user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name              TEXT NOT NULL,
    body_part         TEXT NOT NULL,
    primary_muscles   TEXT[] DEFAULT ARRAY[]::TEXT[],
    equipment         TEXT DEFAULT '',
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Workouts ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workouts (
    id             BIGSERIAL PRIMARY KEY,
    user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workout_number INTEGER NOT NULL,
    workout_name   TEXT    NOT NULL,
    session_date   TEXT    NOT NULL,
    duration_sec   INTEGER DEFAULT 0,
    notes          TEXT    DEFAULT '',
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Sets ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sets (
    id          BIGSERIAL PRIMARY KEY,
    workout_id  BIGINT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    exercise_id BIGINT NOT NULL REFERENCES exercises(id),
    set_order   TEXT   NOT NULL,
    weight_kg   REAL   DEFAULT 0.0,
    reps        INTEGER DEFAULT 0,
    rpe         REAL   DEFAULT NULL,
    distance_m  REAL   DEFAULT NULL,
    duration_s  REAL   DEFAULT NULL,
    one_rm_est  REAL   DEFAULT 0.0,
    volume_load REAL   DEFAULT 0.0,
    set_type    TEXT   DEFAULT 'normal'
);

-- ── Metrics ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS metrics (
    id                BIGSERIAL PRIMARY KEY,
    user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workout_id        BIGINT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    session_date      TEXT   NOT NULL,
    total_volume      REAL   DEFAULT 0.0,
    total_sets        INTEGER DEFAULT 0,
    total_reps        INTEGER DEFAULT 0,
    avg_intensity     REAL   DEFAULT 0.0,
    max_1rm           REAL   DEFAULT 0.0,
    dominant_exercise TEXT   DEFAULT '',
    fatigue_index     REAL   DEFAULT 0.0,
    inol              REAL   DEFAULT 0.0,
    pca_component_1   REAL   DEFAULT 0.0,
    pca_component_2   REAL   DEFAULT 0.0,
    predicted_volume  REAL   DEFAULT 0.0,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Personal records ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS personal_records (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id   BIGINT NOT NULL REFERENCES exercises(id),
    achieved_date TEXT   NOT NULL,
    weight_kg     REAL   NOT NULL,
    reps          INTEGER NOT NULL,
    one_rm_est    REAL   NOT NULL,
    workout_id    BIGINT REFERENCES workouts(id)
);

-- ── Recommendation history ───────────────────────────────────
CREATE TABLE IF NOT EXISTS recommendation_history (
    user_id  BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    plan_id  TEXT NOT NULL,
    shown_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Recommendation rules ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS recommendation_rules (
    id           BIGSERIAL PRIMARY KEY,
    sex          TEXT NOT NULL,
    bmi_level    TEXT NOT NULL,
    goal         TEXT NOT NULL,
    hypertension TEXT DEFAULT 'No',
    diabetes     TEXT DEFAULT 'No',
    fitness_type TEXT,
    exercises    TEXT,
    equipment    TEXT,
    diet         TEXT
);

-- ── Workout Templates ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workout_templates (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    exercises    JSONB NOT NULL DEFAULT '[]',
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── User Plans (Programs) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_plans (
    id             BIGSERIAL PRIMARY KEY,
    user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    description    TEXT,
    split_type     TEXT,
    level          TEXT,
    goal           TEXT,
    days_per_week  INTEGER,
    duration_weeks INTEGER DEFAULT 4,
    weekly_schedule JSONB NOT NULL DEFAULT '{}',
    sessions       JSONB NOT NULL DEFAULT '[]',
    equipment      TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Body Weight Logs ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bodyweight_logs (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    weight_kg    REAL NOT NULL,
    logged_at    DATE NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, logged_at)
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON workouts(user_id, session_date);
CREATE INDEX IF NOT EXISTS idx_sets_workout       ON sets(workout_id);
CREATE INDEX IF NOT EXISTS idx_sets_exercise      ON sets(exercise_id);
CREATE INDEX IF NOT EXISTS idx_metrics_user_date  ON metrics(user_id, session_date);
CREATE INDEX IF NOT EXISTS idx_prs_user_exercise  ON personal_records(user_id, exercise_id);
CREATE INDEX IF NOT EXISTS idx_exercises_body     ON exercises(body_part_id);
CREATE INDEX IF NOT EXISTS idx_auth_nickname      ON auth_users(nickname);
CREATE INDEX IF NOT EXISTS idx_custom_exercises_user ON custom_exercises(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_exercises_body_part ON custom_exercises(body_part);
CREATE INDEX IF NOT EXISTS idx_workout_templates_user ON workout_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_bodyweight_logs_user ON bodyweight_logs(user_id, logged_at DESC);

-- ── Fatigue Logs ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fatigue_logs (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    raw_score   FLOAT NOT NULL,
    borg_score  FLOAT NOT NULL,
    level       INT NOT NULL,
    label       TEXT NOT NULL,
    answers     JSONB NOT NULL,
    logged_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fatigue_logs_user ON fatigue_logs(user_id);

-- ── Weight Logs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weight_logs (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date       DATE NOT NULL,
    weight     FLOAT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_weight_logs_user ON weight_logs(user_id);

-- ── Progress Photos ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS progress_photos (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    photo_url   TEXT NOT NULL,
    weight      FLOAT,
    date        DATE NOT NULL DEFAULT CURRENT_DATE,
    note        TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_progress_photos_user ON progress_photos(user_id, date DESC);

-- ── Nutrition Logs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nutrition_logs (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    meal_name     TEXT,
    meal_category TEXT DEFAULT 'Breakfast',
    description   TEXT,
    calories      INT,
    protein_g     FLOAT,
    carbs_g       FLOAT,
    fat_g         FLOAT,
    fiber_g       FLOAT,
    date          DATE DEFAULT CURRENT_DATE,
    logged_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nutrition_logs_user ON nutrition_logs(user_id, date DESC);

-- ── Food Items ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS food_items (
    id            BIGSERIAL PRIMARY KEY,
    name          TEXT NOT NULL UNIQUE,
    brand         TEXT,
    category      TEXT,
    calories      REAL DEFAULT 0.0,
    protein_g     REAL DEFAULT 0.0,
    carbs_g       REAL DEFAULT 0.0,
    fat_g         REAL DEFAULT 0.0,
    fiber_g       REAL DEFAULT 0.0,
    serving_size  REAL DEFAULT 100.0,
    serving_unit  TEXT DEFAULT 'g', -- 'g', 'ml', 'oz', 'serving'
    is_branded    BOOLEAN DEFAULT FALSE,
    is_user_added BOOLEAN DEFAULT FALSE,
    created_by    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_food_items_name ON food_items(name);

-- ── Recipes ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipes (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    description   TEXT,
    servings      REAL DEFAULT 1.0,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Recipe Ingredients ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id            BIGSERIAL PRIMARY KEY,
    recipe_id     BIGINT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    food_id       BIGINT REFERENCES food_items(id) ON DELETE CASCADE,
    amount        REAL NOT NULL,
    unit          TEXT DEFAULT 'g'
);

-- ── Saved Meals ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_meals (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    items         JSONB NOT NULL, -- Array of {food_id, amount, unit} or {recipe_id, amount, unit}
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Sleep Logs ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sleep_logs (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date         DATE NOT NULL DEFAULT CURRENT_DATE,
    hours        FLOAT NOT NULL,
    quality      INT NOT NULL,
    notes        TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_sleep_logs_user ON sleep_logs(user_id, date DESC);

-- ── Injury Logs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS injury_logs (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body_part    TEXT NOT NULL,
    severity     INT NOT NULL,
    description  TEXT,
    status       TEXT DEFAULT 'active', -- 'active', 'healed'
    start_date   DATE DEFAULT CURRENT_DATE,
    end_date     DATE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_injury_logs_user ON injury_logs(user_id, status);

-- ── Coach Relationships ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS coach_relationships (
    id          BIGSERIAL PRIMARY KEY,
    coach_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    athlete_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status      TEXT DEFAULT 'pending',
    initiated_by TEXT DEFAULT 'coach',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(coach_id, athlete_id)
);

-- ── User Challenges ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_challenges (
    id             BIGSERIAL PRIMARY KEY,
    user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challenge_id   TEXT NOT NULL,
    status         TEXT DEFAULT 'active', -- 'active', 'completed', 'cancelled'
    progress_days  JSONB DEFAULT '[]',     -- Array of objects [{day: 1, date: '2024-05-01', status: 'done'}]
    started_at     TIMESTAMPTZ DEFAULT NOW(),
    completed_at   TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_challenges_active_user ON user_challenges(user_id) WHERE status = 'active';

-- ── Coach Notes ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coach_notes (
    id          BIGSERIAL PRIMARY KEY,
    coach_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    athlete_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id  BIGINT REFERENCES workouts(id) ON DELETE CASCADE,
    note        TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Coach Reviews & Ratings ───────────────────────────────────
CREATE TABLE IF NOT EXISTS coach_reviews (
    id          BIGSERIAL PRIMARY KEY,
    coach_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    user_name   TEXT NOT NULL,
    user_avatar TEXT,
    rating      INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment     TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coach_reviews_coach ON coach_reviews(coach_id);

-- ── Rest Days ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rest_days (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date        DATE NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_rest_days_user ON rest_days(user_id, date DESC);

-- ── Notifications ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_id   BIGINT REFERENCES users(id) ON DELETE CASCADE,
    type        TEXT NOT NULL,
    title       TEXT NOT NULL,
    message     TEXT,
    data        JSONB,
    is_read     BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- ── Chat Messages ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
    id          BIGSERIAL PRIMARY KEY,
    sender_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message     TEXT NOT NULL,
    is_read     BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_receiver ON chat_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(sender_id, receiver_id);

-- ── Nutrition Targets ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nutrition_targets (
    id                BIGSERIAL PRIMARY KEY,
    user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Original Suggestions (System Generated)
    suggested_calories FLOAT NOT NULL,
    suggested_protein  FLOAT NOT NULL,
    suggested_carbs    FLOAT NOT NULL,
    suggested_fat      FLOAT NOT NULL,
    
    -- Final Values (User Adjusted)
    final_calories     FLOAT NOT NULL,
    final_protein      FLOAT NOT NULL,
    final_carbs        FLOAT NOT NULL,
    final_fat          FLOAT NOT NULL,
    
    -- Meta
    goal               TEXT NOT NULL, 
    pace               TEXT NOT NULL, 
    diet_style         TEXT NOT NULL, 
    
    maintenance_calories FLOAT NOT NULL,
    expected_weekly_change FLOAT NOT NULL,
    
    created_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nutrition_targets_user ON nutrition_targets(user_id, created_at DESC);

-- ── Coach Schedule Items (Sessions, Availability, Events) ──────
CREATE TABLE IF NOT EXISTS coach_schedule_items (
    id              BIGSERIAL PRIMARY KEY,
    coach_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    athlete_id      BIGINT REFERENCES users(id) ON DELETE SET NULL,
    title           TEXT NOT NULL,
    item_type       TEXT DEFAULT 'session', -- 'session', 'availability_block', 'event'
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ NOT NULL,
    location        TEXT DEFAULT 'Gym',
    recurrence_rule TEXT DEFAULT NULL, -- 'weekly', 'biweekly', 'daily', null
    status          TEXT DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled'
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coach_schedule_coach_dates ON coach_schedule_items(coach_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_coach_schedule_athlete ON coach_schedule_items(athlete_id, start_time);

-- ── Coach Community Events & Masterclasses ──────────────────
CREATE TABLE IF NOT EXISTS events (
    id               BIGSERIAL PRIMARY KEY,
    coach_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title            TEXT NOT NULL,
    description      TEXT,
    event_type       TEXT DEFAULT 'workshop', -- 'bootcamp', 'webinar', 'group_workout', 'qa_session', 'workshop'
    event_date       TIMESTAMPTZ NOT NULL,
    duration_minutes INT DEFAULT 60,
    location_type    TEXT DEFAULT 'online', -- 'online', 'in_person'
    location_detail  TEXT,
    max_participants INT DEFAULT 20,
    cost_tnd         REAL DEFAULT 0.0,
    target_audience  TEXT DEFAULT 'public', -- 'public', 'adherents_only'
    cover_image_url  TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_coach_date ON events(coach_id, event_date);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);

CREATE TABLE IF NOT EXISTS event_registrations (
    id            BIGSERIAL PRIMARY KEY,
    event_id      BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    status        TEXT DEFAULT 'registered',
    CONSTRAINT unique_event_user UNIQUE (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_reg_event ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_reg_user ON event_registrations(user_id);
"""

def _raw_connection() -> psycopg2.extensions.connection:
    """Return a new (non-pooled) psycopg2 connection. Used by init_db only."""
    conn = psycopg2.connect(
        settings.DATABASE_URL,
        cursor_factory=psycopg2.extras.RealDictCursor
    )
    return conn


def seed_synthetic_coach_reviews(conn) -> None:
    """Seed synthetic users with comments and star ratings under all coaches if no reviews exist."""
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) as count FROM coach_reviews")
        if cur.fetchone()["count"] > 0:
            return

        cur.execute("SELECT id, name FROM users WHERE role = 'coach'")
        coaches = cur.fetchall()
        if not coaches:
            return

        reviews_pool = [
            ("Sami Trabelsi", "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80", 5, "Outstanding coach! Created a personalized hypertrophy program that completely transformed my strength. Very attentive to execution form."),
            ("Emna Ben Ali", "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80", 5, "Super dedicated and responsive! Helped me stay consistent with macro tracking and weekly check-ins. Down 6kg of fat in 8 weeks."),
            ("Mehdi Said", "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80", 5, "Very professional and knowledgeable. Fixed my deadlift posture and helped me break my 1RM plateau safely."),
            ("Nour El Houda", "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80", 4, "Great communication and structured workout splits. Really appreciated the tailored progressive overload suggestions."),
            ("Ahmed Dridi", "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80", 5, "Best coaching experience I've had. The posture correction cues and fatigue management plan kept me injury-free all season."),
            ("Khadija Louati", "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80", 5, "Amazing motivation and detailed feedback after every logged workout. Couldn't ask for a better coach!"),
            ("Selim Mansour", "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=150&q=80", 4, "Punctual, professional, and very thorough. The customized mobility drills helped my shoulder impingement tremendously."),
            ("Ines Gharbi", "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=150&q=80", 5, "Incredible results! Guided me through a clean bulking phase without gaining unnecessary body fat. Top tier expertise.")
        ]

        for coach_idx, coach in enumerate(coaches):
            coach_id = coach["id"]
            num_reviews = 3 + (coach_idx % 3)
            for r_idx in range(num_reviews):
                item = reviews_pool[(coach_idx * 2 + r_idx) % len(reviews_pool)]
                name, avatar, rating, comment = item
                days_ago = (coach_idx * 3 + r_idx * 5) % 45 + 1
                cur.execute("""
                    INSERT INTO coach_reviews (coach_id, user_name, user_avatar, rating, comment, created_at)
                    VALUES (%s, %s, %s, %s, %s, NOW() - INTERVAL '%s days')
                """, (coach_id, name, avatar, rating, comment, days_ago))
        conn.commit()


def seed_synthetic_coach_verifications(conn) -> None:
    """Seed coach_verifications records for synthetic coaches so they appear in Admin Coach Verification Queue."""
    import json
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT COUNT(*) as count FROM coach_verifications")
        if cur.fetchone()["count"] > 0:
            return

        cur.execute("SELECT id, name, email FROM users WHERE role = 'coach'")
        coaches = cur.fetchall()
        if not coaches:
            return

        sample_docs = [
            ["https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=600&q=80"],
            ["https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=600&q=80"],
            ["https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=600&q=80"]
        ]

        for idx, coach in enumerate(coaches):
            coach_id = coach["id"]
            if idx < 3:
                status = "pending"
                cur.execute(
                    "UPDATE users SET coach_verified = FALSE, verification_status = 'pending', approved = FALSE WHERE id = %s",
                    (coach_id,)
                )
                cur.execute(
                    """
                    INSERT INTO coach_verifications (coach_id, status, document_urls, submitted_at)
                    VALUES (%s, %s, %s, NOW() - INTERVAL '%s days')
                    """,
                    (coach_id, status, json.dumps(sample_docs[idx % len(sample_docs)]), idx + 1)
                )
            else:
                status = "approved"
                cur.execute(
                    "UPDATE users SET coach_verified = TRUE, verification_status = 'approved', approved = TRUE WHERE id = %s",
                    (coach_id,)
                )
                cur.execute(
                    """
                    INSERT INTO coach_verifications (coach_id, status, document_urls, submitted_at, reviewed_at)
                    VALUES (%s, %s, %s, NOW() - INTERVAL '%s days', NOW())
                    """,
                    (coach_id, status, json.dumps(sample_docs[idx % len(sample_docs)]), idx + 2)
                )
        conn.commit()


def seed_synthetic_reports(conn) -> None:
    """Seed sample coach and bug reports if empty."""
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT COUNT(*) as count FROM reports")
        if cur.fetchone()["count"] > 0:
            return

        cur.execute("SELECT id FROM users WHERE role = 'athlete' LIMIT 2")
        athletes = cur.fetchall()
        cur.execute("SELECT id FROM users WHERE role = 'coach' LIMIT 2")
        coaches = cur.fetchall()

        if not athletes or not coaches:
            return

        reporter1 = athletes[0]["id"]
        reporter2 = athletes[1]["id"] if len(athletes) > 1 else reporter1
        target_coach = coaches[0]["id"]

        cur.execute(
            """
            INSERT INTO reports (reporter_id, report_type, target_user_id, category, description, status, created_at)
            VALUES (%s, 'coach', %s, 'Unresponsive', 'Coach did not provide weekly check-in feedback or workout plan updates for 2 consecutive weeks.', 'open', NOW() - INTERVAL '2 days')
            """,
            (reporter1, target_coach)
        )

        cur.execute(
            """
            INSERT INTO reports (reporter_id, report_type, category, description, app_context, status, created_at)
            VALUES (%s, 'bug', 'UI issue', 'Macro progress ring layout overflows slightly on smaller mobile viewport widths.', '/nutrition', 'open', NOW() - INTERVAL '1 day')
            """,
            (reporter2,)
        )
        conn.commit()


def seed_synthetic_fares2024(conn) -> None:
    """Ensure user fares2024 has complete synthetic onboarding answers if missing or incomplete."""
    fares_synthetic = {
        "name": "Fares",
        "date_of_birth": "2004-12-29",
        "biological_sex": "Male",
        "height": {"value": 180, "unit": "cm"},
        "current_weight": {"value": 85, "unit": "kg"},
        "goal_weight": {"value": 78, "unit": "kg"},
        "primary_goal": "Build muscle",
        "event_details": "Sub-20 min 5K run & 100kg Bench Press target",
        "goal_pace": "Moderate pace",
        "fitness_level": "Advanced",
        "activity_level": "Moderately active",
        "prior_program_experience": "Yes, currently",
        "training_type": ["Strength training", "Cardio"],
        "training_location": "Full commercial gym",
        "days_per_week": "3-4",
        "session_length": "45-60 min",
        "exercises_to_avoid": "Behind-the-neck press",
        "injuries": "Knee/leg issues",
        "medical_conditions": ["None"],
        "pregnancy_status": "No",
        "diet_type": "No restrictions",
        "allergies": "None",
        "eating_habits": "Somewhat balanced",
        "meals_per_day": "4",
        "past_obstacles": "Lack of time",
        "tracking_preference": ["Weight/scale", "Performance milestones"],
        "notifications": "Yes, daily"
    }
    with conn.cursor() as cur:
        cur.execute("""
            SELECT u.id, u.onboarding_data 
            FROM users u 
            LEFT JOIN auth_users a ON u.auth_id = a.id 
            WHERE a.nickname = 'fares2024' OR u.email = 'fares2024@aura-fit.local' OR u.name ILIKE '%fares%'
        """)
        row = cur.fetchone()
        if row:
            user_id = row['id']
            existing_data = row.get('onboarding_data') or {}
            if not existing_data or len(existing_data.keys()) < 15 or '3' in str(existing_data.get('days_per_week', '')):
                import json
                cur.execute("""
                    UPDATE users SET 
                        name = COALESCE(NULLIF(name, ''), 'Fares'),
                        sex = 'M',
                        age = 21,
                        height_cm = 180.0,
                        bodyweight = 85.0,
                        experience = 'advanced',
                        goal = 'Build muscle',
                        onboarding_completed = TRUE,
                        onboarding_data = %s,
                        updated_at = NOW()
                    WHERE id = %s
                """, (json.dumps(fares_synthetic), user_id))
                conn.commit()


def seed_synthetic_events(conn) -> None:
    """Seed synthetic community events hosted by coaches with AI posters and synthetic attendees."""
    import shutil
    import os
    
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    uploads_events_dir = os.path.join(backend_dir, "uploads", "events")
    os.makedirs(uploads_events_dir, exist_ok=True)
    
    # Map generated poster images from artifacts to uploads/events
    artifact_dir = r"C:\Users\rayen\.gemini\antigravity-ide\brain\1c43796a-f9e6-42d2-b87b-0b1cf555188a"
    posters_map = {
        "Youssef Mansour": ("event_poster_youssef_mansour_1786178827541.png", "youssef_mansour_masterclass.png"),
        "Fatima Al-Harbi": ("event_poster_fatima_alharbi_1786178837257.png", "fatima_alharbi_bootcamp.png"),
        "Tarek Kabbani": ("event_poster_tarek_kabbani_1786178849118.png", "tarek_kabbani_clinic.png"),
        "Amira Fakhoury": ("event_poster_amira_fakhoury_1786178858263.png", "amira_fakhoury_mobility.png"),
    }
    
    for coach_name, (src_file, dst_file) in posters_map.items():
        src_path = os.path.join(artifact_dir, src_file)
        dst_path = os.path.join(uploads_events_dir, dst_file)
        if os.path.exists(src_path) and not os.path.exists(dst_path):
            try:
                shutil.copy2(src_path, dst_path)
                print(f"[SEED] Copied AI poster for {coach_name} -> uploads/events/{dst_file}", flush=True)
            except Exception as e:
                print(f"[SEED] Warning copying poster for {coach_name}: {e}", flush=True)

    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) as count FROM events")
        if cur.fetchone()["count"] > 0:
            return

        # Fetch coaches
        cur.execute("SELECT id, name FROM users WHERE role = 'coach'")
        coaches = {r["name"]: r["id"] for r in cur.fetchall()}
        
        # Fallback if specific named coaches are not found, use any available coach or first users
        if not coaches:
            cur.execute("SELECT id, name FROM users LIMIT 5")
            coaches = {r["name"]: r["id"] for r in cur.fetchall()}
            
        if not coaches:
            return

        # Fetch non-coach athlete users for synthetic registrations
        cur.execute("SELECT id FROM users LIMIT 30")
        all_user_ids = [r["id"] for r in cur.fetchall()]

        synthetic_events = [
            {
                "coach_name": "Youssef Mansour",
                "title": "Hypertrophy & Heavy Lifting Masterclass",
                "description": "Exclusive live masterclass hosted by Coach Youssef Mansour at Lac 2 Fitness Gym. Focus on biomechanics, mechanical tension, progressive overload, and mastering barbell squat and bench press technique.",
                "event_type": "workshop",
                "days_offset": 2,
                "hour": 18,
                "duration": 90,
                "location_type": "in_person",
                "location_detail": "Lac 2 Fitness Gym, Les Berges du Lac 2, Tunis",
                "max_participants": 15,
                "poster": "http://localhost:8000/api/uploads/events/youssef_mansour_masterclass.png"
            },
            {
                "coach_name": "Fatima Al-Harbi",
                "title": "Sunset Beach HIIT Bootcamp & Fat Loss",
                "description": "High-intensity metabolic conditioning and body recomposition session led by Coach Fatima Al-Harbi at Sidi Bou Said coastal park overlooking the Mediterranean sea.",
                "event_type": "bootcamp",
                "days_offset": 4,
                "hour": 17,
                "duration": 60,
                "location_type": "in_person",
                "location_detail": "Sidi Bou Said Beach Park, Tunis",
                "max_participants": 25,
                "poster": "http://localhost:8000/api/uploads/events/fatima_alharbi_bootcamp.png"
            },
            {
                "coach_name": "Tarek Kabbani",
                "title": "Powerlifting Squat & Deadlift Clinic",
                "description": "Elite powerlifting coach Tarek Kabbani breaks down squat depth, hip hinge mechanics, deadlift setup, and injury prevention protocols in this intensive clinic.",
                "event_type": "workshop",
                "days_offset": 6,
                "hour": 16,
                "duration": 120,
                "location_type": "in_person",
                "location_detail": "Carthage Heavy Iron Gym, Carthage, Tunis",
                "max_participants": 12,
                "poster": "http://localhost:8000/api/uploads/events/tarek_kabbani_clinic.png"
            },
            {
                "coach_name": "Amira Fakhoury",
                "title": "Outdoor Functional Mobility & Cardio Sprint",
                "description": "Comprehensive joint mobility, dynamic warmups, core stability, and explosive interval training under the palms with Coach Amira Fakhoury.",
                "event_type": "group_workout",
                "days_offset": 8,
                "hour": 9,
                "duration": 60,
                "location_type": "in_person",
                "location_detail": "Parc du Belvédère, Tunis",
                "max_participants": 20,
                "poster": "http://localhost:8000/api/uploads/events/amira_fakhoury_mobility.png"
            }
        ]

        default_coach_id = next(iter(coaches.values()))

        for idx, ev in enumerate(synthetic_events):
            coach_id = coaches.get(ev["coach_name"], default_coach_id)
            cur.execute("""
                INSERT INTO events (
                    coach_id, title, description, event_type, event_date,
                    duration_minutes, location_type, location_detail,
                    max_participants, cover_image_url
                ) VALUES (
                    %s, %s, %s, %s, NOW() + INTERVAL '%s days' + INTERVAL '%s hours',
                    %s, %s, %s, %s, %s
                ) RETURNING id
            """, (
                coach_id, ev["title"], ev["description"], ev["event_type"],
                ev["days_offset"], ev["hour"], ev["duration"],
                ev["location_type"], ev["location_detail"],
                ev["max_participants"], ev["poster"]
            ))
            event_id = cur.fetchone()["id"]

            # Seed 5-8 synthetic registrations for each event
            num_registrations = 5 + (idx * 2) % 6
            registrants = all_user_ids[:num_registrations]
            for uid in registrants:
                cur.execute("""
                    INSERT INTO event_registrations (event_id, user_id, status)
                    VALUES (%s, %s, 'registered')
                    ON CONFLICT DO NOTHING
                """, (event_id, uid))

        conn.commit()
        print("[SEED] Successfully seeded synthetic Tunisian coach events and synthetic user registrations!", flush=True)


def init_db() -> None:
    """Create all tables and indexes (idempotent)."""
    import time
    max_retries = 5
    for attempt in range(max_retries):
        try:
            _do_init_db()
            return
        except (psycopg2.OperationalError, psycopg2.InterfaceError) as e:
            if attempt < max_retries - 1:
                wait = (attempt + 1) * 2
                print(f"[DB] Connection error during init: {str(e)[:120]}. Retrying in {wait}s... ({attempt+1}/{max_retries})", flush=True)
                time.sleep(wait)
            else:
                print(f"[DB] Failed to connect to database after {max_retries} retries: {e}", flush=True)
                raise


# ── Connection Pool ────────────────────────────────────────────
# Reuses connections instead of creating a new one per request.
_pool = None

def _get_pool():
    """Lazily initialize a threaded connection pool."""
    global _pool
    if _pool is None or _pool.closed:
        _pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=2,
            maxconn=50,
            dsn=settings.DATABASE_URL,
            cursor_factory=psycopg2.extras.RealDictCursor,
        )
        print("[DB] Connection pool created (2-50 connections)", flush=True)
    return _pool


def release_connection(conn: Optional[psycopg2.extensions.connection]) -> None:
    """Return a connection back to pool cleanly if pooled, or close if unpooled/closed."""
    if conn is None:
        return
    global _pool
    try:
        if getattr(conn, "closed", 1) == 0:
            if _pool and not _pool.closed:
                _pool.putconn(conn)
            else:
                conn.close()
    except Exception:
        try:
            if getattr(conn, "closed", 1) == 0:
                conn.close()
        except Exception:
            pass


def get_connection() -> psycopg2.extensions.connection:
    """Return a connection from pool, with graceful fallback to _raw_connection if pool exhausted/stale."""
    global _pool
    try:
        pool = _get_pool()
        conn = pool.getconn()
        if getattr(conn, "closed", 1) != 0:
            try:
                pool.putconn(conn, close=True)
            except Exception:
                pass
            return _raw_connection()
        return conn
    except Exception as e:
        print(f"[DB] Pool connection acquisition warning ({str(e)[:80]}), falling back to direct connection", flush=True)
        try:
            if _pool and not _pool.closed:
                try: _pool.closeall()
                except Exception: pass
            _pool = None
        except Exception:
            pass
        return _raw_connection()


def get_db() -> Generator[psycopg2.extensions.connection, None, None]:
    """
    FastAPI dependency that yields a pooled connection and handles commit/rollback.
    Returns the connection to the pool when done.
    """
    conn = get_connection()
    try:
        yield conn
        if getattr(conn, "closed", 1) == 0:
            conn.commit()
    except Exception:
        if getattr(conn, "closed", 1) == 0:
            try:
                conn.rollback()
            except Exception:
                pass
        raise
    finally:
        release_connection(conn)


def _do_init_db() -> None:
    """Actual initialization logic with smart fast-path detection."""
    conn = _raw_connection()
    try:
        with conn.cursor() as cur:
            # 1. Fast check: has schema already been created?
            cur.execute("""
                SELECT COUNT(*) as count FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name IN ('users', 'auth_users', 'exercises', 'admin_actions', 'reports', 'gyms', 'food_items')
            """)
            res = cur.fetchone()
            count = res["count"] if (isinstance(res, dict) and "count" in res) else (res[0] if res else 0)
            schema_exists = (count >= 6)

            if not schema_exists:
                # Fresh database setup: execute schema in single batch
                statements = [s.strip() for s in SCHEMA_SQL.split(';') if s.strip()]
                for statement in statements:
                    try:
                        cur.execute(statement)
                    except Exception:
                        pass
                conn.commit()

        # 2. Run column migrations in a single unified multi-statement block
        with conn.cursor() as cur:
            try:
                cur.execute("""
                    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS gif_url TEXT DEFAULT NULL;
                    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS instructions TEXT DEFAULT NULL;
                    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS external_id TEXT;
                    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS category TEXT;
                    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS target TEXT;
                    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS image_path TEXT;
                    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS gif_path TEXT;
                    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS instruction_steps JSONB;
                    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE;
                    ALTER TABLE exercises ADD COLUMN IF NOT EXISTS created_by BIGINT;
                    
                    ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
                    ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'local';
                    ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS email_otp TEXT;
                    ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS email_otp_exp TIMESTAMPTZ;
                    
                    ALTER TABLE injury_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
                    ALTER TABLE nutrition_logs ADD COLUMN IF NOT EXISTS meal_category TEXT DEFAULT 'Breakfast';
                    
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'athlete';
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS cv_url TEXT;
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT FALSE;
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_data JSONB DEFAULT '{}'::jsonb;
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS coach_verified BOOLEAN DEFAULT FALSE;
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unsubmitted';
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE;
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;
                    
                    ALTER TABLE reports ADD COLUMN IF NOT EXISTS inquiry_sent BOOLEAN DEFAULT FALSE;
                    ALTER TABLE reports ADD COLUMN IF NOT EXISTS inquiry_notes TEXT;
                    ALTER TABLE reports ADD COLUMN IF NOT EXISTS inquiry_at TIMESTAMPTZ;
                    ALTER TABLE reports ADD COLUMN IF NOT EXISTS inquiry_reply TEXT;
                    ALTER TABLE reports ADD COLUMN IF NOT EXISTS inquiry_reply_at TIMESTAMPTZ;
                    
                    ALTER TABLE coach_relationships ADD COLUMN IF NOT EXISTS initiated_by TEXT DEFAULT 'coach';
                    ALTER TABLE events ADD COLUMN IF NOT EXISTS cost_tnd REAL DEFAULT 0.0;
                    ALTER TABLE events ADD COLUMN IF NOT EXISTS target_audience TEXT DEFAULT 'public';
                """)
                conn.commit()
            except Exception:
                try: conn.rollback()
                except Exception: pass

            # Ensure additional helper tables (gyms, reports, verifications, etc.) exist
            try:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS gyms (
                        id BIGSERIAL PRIMARY KEY,
                        name TEXT NOT NULL UNIQUE,
                        address TEXT,
                        latitude DOUBLE PRECISION NOT NULL,
                        longitude DOUBLE PRECISION NOT NULL,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                    CREATE UNIQUE INDEX IF NOT EXISTS idx_gyms_name ON gyms(name);
                    CREATE TABLE IF NOT EXISTS coach_gyms (
                        id BIGSERIAL PRIMARY KEY,
                        coach_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
                        gym_id BIGINT REFERENCES gyms(id) ON DELETE CASCADE,
                        UNIQUE(coach_id, gym_id)
                    );
                    CREATE TABLE IF NOT EXISTS user_challenges (
                        id BIGSERIAL PRIMARY KEY, 
                        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, 
                        challenge_id TEXT NOT NULL, 
                        status TEXT DEFAULT 'active', 
                        progress_days JSONB DEFAULT '[]', 
                        started_at TIMESTAMPTZ DEFAULT NOW(), 
                        completed_at TIMESTAMPTZ
                    );
                    CREATE TABLE IF NOT EXISTS rest_days (
                        id BIGSERIAL PRIMARY KEY, 
                        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, 
                        date DATE NOT NULL, 
                        created_at TIMESTAMPTZ DEFAULT NOW(), 
                        UNIQUE(user_id, date)
                    );
                    CREATE TABLE IF NOT EXISTS notifications (
                        id BIGSERIAL PRIMARY KEY, 
                        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, 
                        sender_id BIGINT REFERENCES users(id) ON DELETE CASCADE, 
                        type TEXT NOT NULL, 
                        title TEXT NOT NULL, 
                        message TEXT, 
                        data JSONB, 
                        is_read BOOLEAN DEFAULT FALSE, 
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                    CREATE TABLE IF NOT EXISTS user_plans (
                        id BIGSERIAL PRIMARY KEY, 
                        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, 
                        name TEXT NOT NULL, 
                        description TEXT, 
                        split_type TEXT, 
                        level TEXT, 
                        goal TEXT, 
                        days_per_week INTEGER, 
                        duration_weeks INTEGER DEFAULT 4, 
                        weekly_schedule JSONB NOT NULL DEFAULT '{}', 
                        sessions JSONB NOT NULL DEFAULT '[]', 
                        equipment TEXT[] DEFAULT ARRAY[]::TEXT[], 
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                    CREATE TABLE IF NOT EXISTS water_logs (
                        id BIGSERIAL PRIMARY KEY, 
                        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, 
                        amount_ml INT DEFAULT 0, 
                        date DATE NOT NULL DEFAULT CURRENT_DATE, 
                        logged_at TIMESTAMPTZ DEFAULT NOW(), 
                        UNIQUE(user_id, date)
                    );
                    CREATE TABLE IF NOT EXISTS coach_check_ins (
                        id BIGSERIAL PRIMARY KEY,
                        coach_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        athlete_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        adherence_rate INT DEFAULT 100,
                        status_label TEXT DEFAULT 'on_track',
                        feedback TEXT NOT NULL,
                        focus_areas TEXT[] DEFAULT ARRAY[]::TEXT[],
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                    CREATE TABLE IF NOT EXISTS food_items (
                        id BIGSERIAL PRIMARY KEY, 
                        name TEXT NOT NULL UNIQUE, 
                        brand TEXT, 
                        category TEXT, 
                        calories REAL DEFAULT 0.0, 
                        protein_g REAL DEFAULT 0.0, 
                        carbs_g REAL DEFAULT 0.0, 
                        fat_g REAL DEFAULT 0.0, 
                        fiber_g REAL DEFAULT 0.0, 
                        serving_size REAL DEFAULT 100.0, 
                        serving_unit TEXT DEFAULT 'g', 
                        is_branded BOOLEAN DEFAULT FALSE, 
                        is_user_added BOOLEAN DEFAULT FALSE, 
                        created_by BIGINT REFERENCES users(id) ON DELETE SET NULL, 
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                    CREATE TABLE IF NOT EXISTS recipes (
                        id BIGSERIAL PRIMARY KEY, 
                        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, 
                        name TEXT NOT NULL, 
                        description TEXT, 
                        servings REAL DEFAULT 1.0, 
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                    CREATE TABLE IF NOT EXISTS recipe_ingredients (
                        id BIGSERIAL PRIMARY KEY, 
                        recipe_id BIGINT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE, 
                        food_id BIGINT REFERENCES food_items(id) ON DELETE CASCADE, 
                        amount REAL NOT NULL, 
                        unit TEXT DEFAULT 'g'
                    );
                    CREATE TABLE IF NOT EXISTS saved_meals (
                        id BIGSERIAL PRIMARY KEY, 
                        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, 
                        name TEXT NOT NULL, 
                        items JSONB NOT NULL, 
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                    CREATE TABLE IF NOT EXISTS coach_reviews (
                        id          BIGSERIAL PRIMARY KEY,
                        coach_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
                        user_name   TEXT NOT NULL,
                        user_avatar TEXT,
                        rating      INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
                        comment     TEXT NOT NULL,
                        created_at  TIMESTAMPTZ DEFAULT NOW()
                    );
                    CREATE TABLE IF NOT EXISTS coach_verifications (
                        id               BIGSERIAL PRIMARY KEY,
                        coach_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        status           TEXT DEFAULT 'pending',
                        document_urls    JSONB DEFAULT '[]'::jsonb,
                        submitted_at     TIMESTAMPTZ DEFAULT NOW(),
                        reviewed_at      TIMESTAMPTZ,
                        reviewed_by      BIGINT REFERENCES users(id) ON DELETE SET NULL,
                        rejection_reason TEXT
                    );
                    CREATE TABLE IF NOT EXISTS admin_actions (
                        id           BIGSERIAL PRIMARY KEY,
                        admin_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        action_type  TEXT NOT NULL,
                        target_type  TEXT NOT NULL,
                        target_id    BIGINT,
                        reason       TEXT,
                        created_at   TIMESTAMPTZ DEFAULT NOW()
                    );
                    CREATE TABLE IF NOT EXISTS reports (
                        id             BIGSERIAL PRIMARY KEY,
                        reporter_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        report_type    TEXT NOT NULL,
                        target_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
                        category       TEXT NOT NULL,
                        description    TEXT NOT NULL,
                        screenshot_url TEXT,
                        app_context    TEXT,
                        status         TEXT DEFAULT 'open',
                        created_at     TIMESTAMPTZ DEFAULT NOW(),
                        resolved_at    TIMESTAMPTZ,
                        resolved_by    BIGINT REFERENCES users(id) ON DELETE SET NULL,
                        admin_notes    TEXT
                    );
                """)
                conn.commit()
            except Exception:
                try: conn.rollback()
                except Exception: pass

            # Seed synthetic data only if needed
            try:
                seed_synthetic_coach_reviews(conn)
                seed_synthetic_fares2024(conn)
                seed_synthetic_coach_verifications(conn)
                seed_synthetic_reports(conn)
                seed_synthetic_gyms(conn)
                seed_default_admin(conn)
            except Exception:
                pass

            # Sync coach_verified and approved flags with verification_status
            try:
                cur.execute("""
                    UPDATE users 
                    SET coach_verified = FALSE, approved = FALSE 
                    WHERE verification_status IN ('pending', 'rejected', 'unsubmitted');

                    UPDATE users 
                    SET coach_verified = TRUE, approved = TRUE 
                    WHERE verification_status = 'approved';
                """)
                conn.commit()
            except Exception:
                try: conn.rollback()
                except Exception: pass
    except Exception as e:
        print(f"[DB] Error during init: {str(e)[:100]}", flush=True)
        try:
            conn.rollback()
        except:
            pass
        raise
    finally:
        conn.close()



def seed_synthetic_gyms(conn) -> None:
    """Seed an extensive list of premier gyms across Tunisia's regions and governorates."""
    gym_list = [
        # --- Tunis & Suburbs ---
        {"name": "California Gym (Lac 2)", "address": "Les Berges du Lac 2, Tunis", "latitude": 36.8475, "longitude": 10.2652},
        {"name": "California Gym (Lac 1)", "address": "Les Berges du Lac 1, Tunis", "latitude": 36.8340, "longitude": 10.2360},
        {"name": "California Gym (Centre Urbain Nord)", "address": "Centre Urbain Nord, Tunis", "latitude": 36.8488, "longitude": 10.1982},
        {"name": "Giga Fit (Lac 1)", "address": "Les Berges du Lac 1, Tunis", "latitude": 36.8378, "longitude": 10.2392},
        {"name": "Titanium Gym (La Marsa)", "address": "Rue Habib Bourguiba, La Marsa, Tunis", "latitude": 36.8858, "longitude": 10.3228},
        {"name": "Carthage Heavy Iron Gym", "address": "Avenue Habib Bourguiba, Carthage, Tunis", "latitude": 36.8528, "longitude": 10.3275},
        {"name": "Gym Box (El Manar)", "address": "El Manar 2, Tunis", "latitude": 36.8329, "longitude": 10.1492},
        {"name": "Olympysky Fitness Club (Menzah 5)", "address": "Avenue Louis Braille, Menzah 5, Tunis", "latitude": 36.8415, "longitude": 10.1685},
        {"name": "Body Line Club (Menzah 6)", "address": "Rue Ahmed Tlili, Menzah 6, Tunis", "latitude": 36.8442, "longitude": 10.1620},
        {"name": "Black Bull Gym (Mutuelleville)", "address": "Rue Taieb Mhiri, Mutuelleville, Tunis", "latitude": 36.8285, "longitude": 10.1740},
        {"name": "Square Fitness Club (Gammarth)", "address": "Zone Touristique Gammarth, Tunis", "latitude": 36.9180, "longitude": 10.2860},
        {"name": "Iron Bull Gym (Bardo)", "address": "Avenue Habib Bougatfa, Le Bardo, Tunis", "latitude": 36.8090, "longitude": 10.1380},
        {"name": "Power Zone Gym (Centre Ville)", "address": "Avenue Jean Jaurès, Tunis Centre", "latitude": 36.8010, "longitude": 10.1830},
        {"name": "World Gym Club (Menzah 1)", "address": "Rue Pierre de Coubertin, Menzah 1, Tunis", "latitude": 36.8360, "longitude": 10.1760},
        {"name": "Fight & Fit Academy (Carthage)", "address": "Avenue de la République, Carthage Dermech", "latitude": 36.8580, "longitude": 10.3320},

        # --- Ariana ---
        {"name": "California Gym (Ennasr)", "address": "Avenue Hédi Nouira, Ennasr 2, Ariana", "latitude": 36.8576, "longitude": 10.1704},
        {"name": "The Fit Loft (La Soukra)", "address": "Avenue de l'UMA, La Soukra, Ariana", "latitude": 36.8647, "longitude": 10.2238},
        {"name": "Crossfit 216 (La Soukra)", "address": "Rue de l'Aéroport, La Soukra, Ariana", "latitude": 36.8710, "longitude": 10.2380},
        {"name": "Fitness Park (Tunis City - Géant)", "address": "Route de Bizerte Km 12, Cebalat, Ariana", "latitude": 36.8920, "longitude": 10.1280},
        {"name": "Gym Arena (Ennasr 1)", "address": "Avenue Ariana Les Roses, Ennasr 1, Ariana", "latitude": 36.8520, "longitude": 10.1660},
        {"name": "Pulse Fitness Club (Borj Louzir)", "address": "Avenue de la Liberté, Borj Louzir, Ariana", "latitude": 36.8790, "longitude": 10.1890},
        {"name": "Ultra Gym (Raoued)", "address": "Avenue Jaafar, Raoued, Ariana", "latitude": 36.9020, "longitude": 10.1810},

        # --- Ben Arous & South Suburbs ---
        {"name": "California Gym (Ben Arous)", "address": "Avenue de France, Ben Arous", "latitude": 36.7533, "longitude": 10.2223},
        {"name": "Oxygen Gym (Megrine)", "address": "Rue de la Gare, Megrine, Ben Arous", "latitude": 36.7441, "longitude": 10.2285},
        {"name": "Radès Fitness & Cross Training", "address": "Avenue Habib Bourguiba, Radès, Ben Arous", "latitude": 36.7680, "longitude": 10.2740},
        {"name": "California Gym (Boumhel)", "address": "GP1, Boumhel El Bassatine, Ben Arous", "latitude": 36.7260, "longitude": 10.2980},
        {"name": "Universal Gym (Ezzahra)", "address": "Avenue Habib Bourguiba, Ezzahra, Ben Arous", "latitude": 36.7420, "longitude": 10.3080},
        {"name": "Top Body Gym (Mourouj 3)", "address": "Avenue des Martyrs, El Mourouj 3, Ben Arous", "latitude": 36.7310, "longitude": 10.2110},
        {"name": "Hammam Lif Iron Club", "address": "Corniche Hammam-Lif, Ben Arous", "latitude": 36.7330, "longitude": 10.3400},

        # --- Manouba ---
        {"name": "Delys Fitness (Manouba Centre)", "address": "Avenue Habib Bourguiba, Manouba", "latitude": 36.8080, "longitude": 10.0980},
        {"name": "Sparta Fitness Gym (Denden)", "address": "Rue de l'Indépendance, Denden, Manouba", "latitude": 36.8040, "longitude": 10.1150},
        {"name": "Oussama Gym (Oued Ellil)", "address": "Route de Mateur, Oued Ellil, Manouba", "latitude": 36.8290, "longitude": 10.0470},

        # --- Bizerte ---
        {"name": "California Gym (Bizerte)", "address": "Boulevard Hassan Nouri, Bizerte", "latitude": 37.2745, "longitude": 9.8739},
        {"name": "Marina Fitness Club (Bizerte)", "address": "Port de Plaisance Cap 3000, Bizerte", "latitude": 37.2710, "longitude": 9.8790},
        {"name": "Viking Gym (Menzel Bourguiba)", "address": "Avenue de la République, Menzel Bourguiba, Bizerte", "latitude": 37.1530, "longitude": 9.7860},
        {"name": "Ras Jebel Powerhouse", "address": "Avenue Habib Thameur, Ras Jebel, Bizerte", "latitude": 37.2140, "longitude": 10.1220},

        # --- Nabeul & Hammamet ---
        {"name": "California Gym (Nabeul)", "address": "Avenue Habib Thameur, Nabeul", "latitude": 36.4560, "longitude": 10.7376},
        {"name": "Hammamet Fitness Center", "address": "Zone Touristique Nord, Hammamet", "latitude": 36.4080, "longitude": 10.6070},
        {"name": "Yasmine Gym (Hammamet Sud)", "address": "Port Yasmine Hammamet, Hammamet", "latitude": 36.3720, "longitude": 10.5360},
        {"name": "Kelibia Ocean Gym", "address": "Avenue des Martyrs, Kélibia, Nabeul", "latitude": 36.8480, "longitude": 11.0930},
        {"name": "Grombalia Fit Center", "address": "Avenue Habib Bourguiba, Grombalia, Nabeul", "latitude": 36.6010, "longitude": 10.4980},

        # --- Sousse ---
        {"name": "Pro Fitness (Sousse)", "address": "Route Touristique, Sousse", "latitude": 35.8256, "longitude": 10.6369},
        {"name": "California Gym (Mall of Sousse)", "address": "Kalâa Kebira, Sousse", "latitude": 35.8690, "longitude": 10.5780},
        {"name": "Gold Gym (Kantaoui)", "address": "Port El Kantaoui, Hammam Sousse, Sousse", "latitude": 35.8920, "longitude": 10.5980},
        {"name": "Powerhouse Gym (Sahloul)", "address": "Boulevard Yasser Arafat, Sahloul, Sousse", "latitude": 35.8390, "longitude": 10.6020},
        {"name": "Body Art Gym (Khezama)", "address": "Avenue Taieb Mhiri, Khezama Ouest, Sousse", "latitude": 35.8450, "longitude": 10.6210},

        # --- Monastir & Mahdia ---
        {"name": "Monastir Marina Gym Club", "address": "Marina de Monastir, Monastir", "latitude": 35.7780, "longitude": 10.8330},
        {"name": "California Gym (Monastir)", "address": "Avenue de l'Environnement, Monastir", "latitude": 35.7640, "longitude": 10.8170},
        {"name": "Cap Afrique Fitness (Mahdia)", "address": "Zone Touristique Hiboun, Mahdia", "latitude": 35.5180, "longitude": 11.0490},

        # --- Sfax ---
        {"name": "California Gym (Sfax)", "address": "Route de Teniour Km 1.5, Sfax", "latitude": 34.7406, "longitude": 10.7603},
        {"name": "California Gym (Sfax Gremda)", "address": "Route de Gremda Km 2, Sfax", "latitude": 34.7520, "longitude": 10.7420},
        {"name": "Matrix Gym (Route de Soukra)", "address": "Route de Soukra Km 3, Sfax", "latitude": 34.7210, "longitude": 10.7310},
        {"name": "Platinum Fitness Club (Sfax Centre)", "address": "Boulevard 14 Janvier, Sfax", "latitude": 34.7350, "longitude": 10.7620},

        # --- Central & South Tunisia ---
        {"name": "Okba Fitness Club (Kairouan)", "address": "Avenue Ali Zouaoui, Kairouan", "latitude": 35.6780, "longitude": 10.0960},
        {"name": "Oasis Fit (Gabès)", "address": "Boulevard Mohamed Ali, Gabès", "latitude": 33.8815, "longitude": 10.0982},
        {"name": "Djerba Sun Gym (Midoun)", "address": "Zone Touristique Midoun, Djerba", "latitude": 33.8075, "longitude": 11.0025},
        {"name": "Houmt Souk Iron Fitness (Djerba)", "address": "Avenue Habib Bourguiba, Houmt Souk, Djerba", "latitude": 33.8760, "longitude": 10.8580},
        {"name": "Zarzis Coast Gym", "address": "Route Touristique Souihel, Zarzis", "latitude": 33.5180, "longitude": 11.1120}
    ]

    try:
        with conn.cursor() as cur:
            for g in gym_list:
                cur.execute(
                    """
                    INSERT INTO gyms (name, address, latitude, longitude) 
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (name) DO UPDATE 
                    SET address = EXCLUDED.address, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude
                    """,
                    (g["name"], g["address"], g["latitude"], g["longitude"])
                )

            # Fetch all coach IDs
            cur.execute("SELECT id FROM users WHERE role = 'coach'")
            coaches = [r["id"] for r in cur.fetchall()]

            if coaches:
                cur.execute("SELECT id FROM gyms ORDER BY id ASC")
                gym_ids = [r["id"] for r in cur.fetchall()]

                # Distribute coaches evenly across gyms so all gyms have affiliated coaches
                for i, g_id in enumerate(gym_ids):
                    primary_coach = coaches[i % len(coaches)]
                    secondary_coach = coaches[(i + 3) % len(coaches)]
                    
                    cur.execute(
                        "INSERT INTO coach_gyms (coach_id, gym_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                        (primary_coach, g_id)
                    )
                    cur.execute(
                        "INSERT INTO coach_gyms (coach_id, gym_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                        (secondary_coach, g_id)
                    )

            conn.commit()
            print(f"[SEED] Successfully verified and seeded {len(gym_list)} gyms across Tunisia with coach affiliations.", flush=True)
    except Exception as e:
        conn.rollback()
        print(f"[SEED] Gym seed warning: {e}", flush=True)


def seed_default_admin(conn):
    """Seed default admin account if no user with role = 'admin' exists in DB."""
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id FROM users WHERE role = 'admin'")
            admin_user = cur.fetchone()
            if not admin_user:
                from services.auth_service import hash_password
                nickname = "admin"
                email = "admin@hpi.local"
                password = "admin"
                pw_hash = hash_password(password)

                cur.execute("SELECT id FROM auth_users WHERE nickname = %s OR email = %s", (nickname, email))
                existing_auth = cur.fetchone()
                if existing_auth:
                    auth_id = existing_auth["id"]
                else:
                    cur.execute(
                        "INSERT INTO auth_users (nickname, email, password_hash, provider) VALUES (%s, %s, %s, 'local') RETURNING id",
                        (nickname, email, pw_hash)
                    )
                    auth_id = cur.fetchone()["id"]

                cur.execute(
                    "INSERT INTO users (auth_id, name, email, role, onboarding_completed) VALUES (%s, %s, %s, 'admin', TRUE)",
                    (auth_id, nickname, email)
                )
                conn.commit()
                print("⚠️  Default admin account (admin/admin) is active — change this password before deploying to production.", flush=True)
    except Exception as e:
        conn.rollback()
        print(f"[DB] Default admin seed warning: {e}", flush=True)

