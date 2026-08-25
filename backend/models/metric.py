"""
HPI — Metric & Analytics Pydantic Models
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class MetricRead(BaseModel):
    id: int
    user_id: int
    workout_id: int
    session_date: str
    total_volume: float
    total_sets: int
    total_reps: int
    avg_intensity: float
    max_1rm: float
    dominant_exercise: str
    fatigue_index: float
    inol: float
    pca_component_1: float
    pca_component_2: float
    predicted_volume: float
    created_at: str

    model_config = {"from_attributes": True}



class VolumeProgression(BaseModel):
    dates: List[str]
    volumes: List[float]
    moving_avg: List[float]
    trend_slope: float
    trend_intercept: float


class ExerciseProgress(BaseModel):
    exercise_name: str
    dates: List[str]
    max_1rm: List[float]
    max_weight: List[float]
    total_volume: List[float]


class HeatmapData(BaseModel):
    """Calendar heatmap data for activity tracking."""
    entries: List[Dict[str, Any]]  # [{date, value, workout_name}, ...]
    max_value: float
    total_days_active: int


class DashboardSummary(BaseModel):
    total_workouts: int
    total_volume_tonnes: float
    best_1rm: Dict[str, float]         # exercise -> best 1RM
    weekly_volume: List[Dict[str, Any]]
    recent_prs: List[Dict[str, Any]]
    muscle_group_split: Dict[str, float]
    volume_trend: str                  # 'up', 'down', 'stable'
    volume_change_pct: float
    active_injuries_count: int = 0
    ai_insight: Optional[str] = None


class AnalyticsRequest(BaseModel):
    user_id: int
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    exercises: Optional[List[str]] = None
    n_pca_components: int = Field(default=2, ge=2, le=5)
