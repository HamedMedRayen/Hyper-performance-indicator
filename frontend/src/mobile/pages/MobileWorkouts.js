import React, { useState, useEffect, useRef } from "react";
import { 
  Plus, Check, Search, ArrowLeft, Trash2, Dumbbell, 
  Zap, Flame, Clock, Play, Pause, Save, ClipboardList, 
  TrendingUp, X, FolderOpen, Heart, Info, CheckCircle2, ChevronRight
} from "lucide-react";
import { api } from "../../utils/api";
import { useToast } from "../../components/common/Toast";
import { fmt } from "../../utils/formatters";
import { resolveBackendUrl } from "../../utils/config";
import MobileBottomSheet from "../components/MobileBottomSheet";
import ExerciseDetailSheet from "../../components/widgets/ExerciseDetailSheet";
import BodyMap from "../../components/cards/BodyMap";

const EQUIPMENT_CHIPS = [
  "All", "barbell", "dumbbell", "cable", "body weight",
  "kettlebell", "resistance band", "smith machine", "leverage machine",
];

const CATEGORY_COLORS = {
  chest: "#f43f5e", back: "#3b82f6", "upper legs": "#10b981", shoulders: "#f59e0b",
  "upper arms": "#a78bfa", waist: "#06b6d4", "lower legs": "#84cc16", cardio: "#f97316",
  "lower arms": "#8b5cf6", neck: "#ec4899",
};

const DEFAULT_SYSTEM_TEMPLATES = [
  {
    id: "sys-1",
    name: "Push Day (Chest, Shoulders, Triceps)",
    is_system: true,
    category: "Split",
    exercises: [
      { exercise_name: "Barbell Bench Press", sets: [{ reps: 8, weight_kg: 70 }, { reps: 8, weight_kg: 70 }, { reps: 8, weight_kg: 70 }] },
      { exercise_name: "Incline Dumbbell Press", sets: [{ reps: 10, weight_kg: 24 }, { reps: 10, weight_kg: 24 }, { reps: 10, weight_kg: 24 }] },
      { exercise_name: "Overhead Dumbbell Press", sets: [{ reps: 10, weight_kg: 18 }, { reps: 10, weight_kg: 18 }, { reps: 10, weight_kg: 18 }] },
      { exercise_name: "Lateral Raises", sets: [{ reps: 15, weight_kg: 10 }, { reps: 15, weight_kg: 10 }, { reps: 15, weight_kg: 10 }] },
      { exercise_name: "Triceps Pushdown", sets: [{ reps: 12, weight_kg: 25 }, { reps: 12, weight_kg: 25 }, { reps: 12, weight_kg: 25 }] }
    ]
  },
  {
    id: "sys-2",
    name: "Pull Day (Back & Biceps)",
    is_system: true,
    category: "Split",
    exercises: [
      { exercise_name: "Barbell Deadlift", sets: [{ reps: 6, weight_kg: 100 }, { reps: 6, weight_kg: 100 }, { reps: 6, weight_kg: 100 }] },
      { exercise_name: "Lat Pulldown", sets: [{ reps: 10, weight_kg: 55 }, { reps: 10, weight_kg: 55 }, { reps: 10, weight_kg: 55 }] },
      { exercise_name: "Seated Cable Row", sets: [{ reps: 10, weight_kg: 50 }, { reps: 10, weight_kg: 50 }, { reps: 10, weight_kg: 50 }] },
      { exercise_name: "Barbell Bicep Curl", sets: [{ reps: 12, weight_kg: 30 }, { reps: 12, weight_kg: 30 }, { reps: 12, weight_kg: 30 }] },
      { exercise_name: "Hammer Curls", sets: [{ reps: 12, weight_kg: 14 }, { reps: 12, weight_kg: 14 }, { reps: 12, weight_kg: 14 }] }
    ]
  },
  {
    id: "sys-3",
    name: "Leg Day (Quads, Hamstrings, Calves)",
    is_system: true,
    category: "Split",
    exercises: [
      { exercise_name: "Barbell Back Squat", sets: [{ reps: 8, weight_kg: 80 }, { reps: 8, weight_kg: 80 }, { reps: 8, weight_kg: 80 }] },
      { exercise_name: "Romanian Deadlift", sets: [{ reps: 10, weight_kg: 70 }, { reps: 10, weight_kg: 70 }, { reps: 10, weight_kg: 70 }] },
      { exercise_name: "Leg Press", sets: [{ reps: 12, weight_kg: 140 }, { reps: 12, weight_kg: 140 }, { reps: 12, weight_kg: 140 }] },
      { exercise_name: "Leg Extensions", sets: [{ reps: 15, weight_kg: 40 }, { reps: 15, weight_kg: 40 }, { reps: 15, weight_kg: 40 }] },
      { exercise_name: "Standing Calf Raises", sets: [{ reps: 15, weight_kg: 50 }, { reps: 15, weight_kg: 50 }, { reps: 15, weight_kg: 50 }] }
    ]
  },
  {
    id: "sys-4",
    name: "Upper Body Power",
    is_system: true,
    category: "Upper/Lower",
    exercises: [
      { exercise_name: "Incline Barbell Bench Press", sets: [{ reps: 6, weight_kg: 65 }, { reps: 6, weight_kg: 65 }, { reps: 6, weight_kg: 65 }] },
      { exercise_name: "Pull-ups", sets: [{ reps: 8, weight_kg: 0 }, { reps: 8, weight_kg: 0 }, { reps: 8, weight_kg: 0 }] },
      { exercise_name: "Dumbbell Shoulder Press", sets: [{ reps: 8, weight_kg: 22 }, { reps: 8, weight_kg: 22 }, { reps: 8, weight_kg: 22 }] },
      { exercise_name: "Chest Supported Row", sets: [{ reps: 10, weight_kg: 45 }, { reps: 10, weight_kg: 45 }, { reps: 10, weight_kg: 45 }] },
      { exercise_name: "Dips", sets: [{ reps: 10, weight_kg: 0 }, { reps: 10, weight_kg: 0 }, { reps: 10, weight_kg: 0 }] }
    ]
  },
  {
    id: "sys-5",
    name: "Full Body Blitz",
    is_system: true,
    category: "Full Body",
    exercises: [
      { exercise_name: "Barbell Back Squat", sets: [{ reps: 8, weight_kg: 75 }, { reps: 8, weight_kg: 75 }, { reps: 8, weight_kg: 75 }] },
      { exercise_name: "Barbell Bench Press", sets: [{ reps: 8, weight_kg: 65 }, { reps: 8, weight_kg: 65 }, { reps: 8, weight_kg: 65 }] },
      { exercise_name: "Lat Pulldown", sets: [{ reps: 10, weight_kg: 50 }, { reps: 10, weight_kg: 50 }, { reps: 10, weight_kg: 50 }] },
      { exercise_name: "Dumbbell Lunges", sets: [{ reps: 10, weight_kg: 16 }, { reps: 10, weight_kg: 16 }, { reps: 10, weight_kg: 16 }] },
      { exercise_name: "Hanging Leg Raises", sets: [{ reps: 12, weight_kg: 0 }, { reps: 12, weight_kg: 0 }, { reps: 12, weight_kg: 0 }] }
    ]
  }
];

function epley1rm(w, r) { return w && r ? +(w * (1 + r / 30)).toFixed(1) : 0; }

export default function MobileWorkouts() {
  const toast = useToast();
  const [activeMainTab, setActiveMainTab] = useState("log"); // 'log' | 'history' | 'exercises'

  // Mockup detail modal and explorer filters state
  const [detailExercise, setDetailExercise] = useState(null);
  const [selectedEquipment, setSelectedEquipment] = useState("All");
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [selectedBodyPart, setSelectedBodyPart] = useState(null);

  // Logger states
  const [activeWorkout, setActiveWorkout] = useState(null); // { workout_name, notes, date, elapsedSeconds, isRunning, exercises: [] }
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateFilter, setTemplateFilter] = useState("all"); // 'all' | 'custom' | 'featured'
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState("activeWorkout"); // 'activeWorkout' | 'createTemplate'
  const [pickerSearch, setPickerSearch] = useState("");
  const [exercisesList, setExercisesList] = useState([]);
  const [savingWorkout, setSavingWorkout] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState(true);

  // Template Creator Modal states
  const [createTemplateOpen, setCreateTemplateOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    exercises: []
  });
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Active rest timers
  const [activeRestTime, setActiveRestTime] = useState(null); // { secondsLeft, initial }
  const restIntervalRef = useRef(null);

  // History states
  const [historyWorkouts, setHistoryWorkouts] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [expandedWorkoutId, setExpandedWorkoutId] = useState(null);
  const [detailedWorkout, setDetailedWorkout] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deletingWorkout, setDeletingWorkout] = useState(false);
  const [coachNotes, setCoachNotes] = useState([]);

  // Timer Ref
  const workoutTimerRef = useRef(null);

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await api.getTemplates();
      setTemplates(res || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Load initial templates & exercises
  useEffect(() => {
    fetchTemplates();

    api.getExercises({ limit: 2000 })
      .then(res => setExercisesList(res.exercises || res || []))
      .catch(() => {});
  }, []);

  // Fetch history when tab changes
  useEffect(() => {
    if (activeMainTab === "history") {
      fetchHistory();
    }
  }, [activeMainTab]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.getWorkouts(30);
      setHistoryWorkouts(res || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load workout history");
    } finally {
      setLoadingHistory(false);
    }
  };

  // Workout Timer Effect
  useEffect(() => {
    if (activeWorkout && activeWorkout.isRunning) {
      workoutTimerRef.current = setInterval(() => {
        setActiveWorkout(prev => {
          if (!prev) return null;
          return { ...prev, elapsedSeconds: prev.elapsedSeconds + 1 };
        });
      }, 1000);
    } else {
      if (workoutTimerRef.current) clearInterval(workoutTimerRef.current);
    }

    return () => {
      if (workoutTimerRef.current) clearInterval(workoutTimerRef.current);
    };
  }, [activeWorkout?.isRunning]);

  // Rest Timer Effect
  useEffect(() => {
    if (activeRestTime && activeRestTime.secondsLeft > 0) {
      restIntervalRef.current = setInterval(() => {
        setActiveRestTime(prev => {
          if (!prev) return null;
          if (prev.secondsLeft <= 1) {
            clearInterval(restIntervalRef.current);
            toast.success("Rest over! Get back to it! 💪");
            return null;
          }
          return { ...prev, secondsLeft: prev.secondsLeft - 1 };
        });
      }, 1000);
    } else {
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    }

    return () => {
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    };
  }, [activeRestTime?.secondsLeft]);

  // ── Workout Logger Actions ─────────────────────────────────────
  const startEmptyWorkout = () => {
    setActiveWorkout({
      workout_name: `Workout on ${new Date().toLocaleDateString()}`,
      notes: "",
      date: new Date().toISOString().slice(0, 16),
      elapsedSeconds: 0,
      isRunning: true,
      exercises: []
    });
  };

  const startWorkoutFromTemplate = (template) => {
    const defaultExercises = (template.exercises || []).map(ex => ({
      exercise_name: ex.exercise_name,
      sets: (ex.sets || [{ reps: 10, weight_kg: 0 }]).map(s => ({
        weight_kg: s.weight_kg || 0,
        reps: s.reps || 10,
        set_type: s.set_type || "normal",
        completed: false
      })),
      prevSets: []
    }));

    setActiveWorkout({
      workout_name: template.name,
      notes: "",
      date: new Date().toISOString().slice(0, 16),
      elapsedSeconds: 0,
      isRunning: true,
      exercises: defaultExercises
    });

    // Proactively load exercise history to show progressive overload
    defaultExercises.forEach((ex, idx) => {
      api.getExerciseHistory(ex.exercise_name)
        .then(history => {
          setActiveWorkout(prev => {
            if (!prev) return null;
            const updated = [...prev.exercises];
            updated[idx].prevSets = history || [];
            return { ...prev, exercises: updated };
          });
        }).catch(() => {});
    });

    toast.success(`Started "${template.name}" workout!`);
  };

  // ── Template Creator Handlers ──────────────────────────────────
  const handleOpenCreateTemplate = () => {
    setNewTemplate({
      name: "",
      exercises: [
        {
          exercise_name: "Barbell Bench Press",
          sets: [{ reps: 10, weight_kg: 60, set_type: "normal" }, { reps: 10, weight_kg: 60, set_type: "normal" }, { reps: 10, weight_kg: 60, set_type: "normal" }]
        }
      ]
    });
    setCreateTemplateOpen(true);
  };

  const handleAddExerciseToTemplate = (ex) => {
    setNewTemplate(prev => ({
      ...prev,
      exercises: [
        ...prev.exercises,
        {
          exercise_name: ex.name,
          sets: [{ reps: 10, weight_kg: 0, set_type: "normal" }, { reps: 10, weight_kg: 0, set_type: "normal" }, { reps: 10, weight_kg: 0, set_type: "normal" }]
        }
      ]
    }));
    setPickerOpen(false);
  };

  const handleRemoveExerciseFromTemplate = (idx) => {
    setNewTemplate(prev => ({
      ...prev,
      exercises: prev.exercises.filter((_, i) => i !== idx)
    }));
  };

  const handleAddSetToTemplateExercise = (exIdx) => {
    setNewTemplate(prev => {
      const copy = [...prev.exercises];
      const ex = copy[exIdx];
      const last = ex.sets[ex.sets.length - 1] || { reps: 10, weight_kg: 0, set_type: "normal" };
      ex.sets.push({ ...last });
      return { ...prev, exercises: copy };
    });
  };

  const handleRemoveSetFromTemplateExercise = (exIdx, setIdx) => {
    setNewTemplate(prev => {
      const copy = [...prev.exercises];
      copy[exIdx].sets = copy[exIdx].sets.filter((_, s) => s !== setIdx);
      return { ...prev, exercises: copy };
    });
  };

  const handleUpdateTemplateSet = (exIdx, setIdx, field, val) => {
    setNewTemplate(prev => {
      const copy = [...prev.exercises];
      copy[exIdx].sets[setIdx][field] = val;
      return { ...prev, exercises: copy };
    });
  };

  const handleSaveNewTemplate = async () => {
    if (!newTemplate.name.trim()) {
      toast.error("Please enter a template name");
      return;
    }
    if (newTemplate.exercises.length === 0) {
      toast.error("Add at least one exercise to save a template");
      return;
    }

    setSavingTemplate(true);
    try {
      const formattedExercises = newTemplate.exercises.map(ex => ({
        exercise_name: ex.exercise_name,
        sets: ex.sets.map(s => ({
          reps: parseInt(s.reps) || 10,
          weight_kg: parseFloat(s.weight_kg) || 0,
          set_type: s.set_type || "normal"
        }))
      }));

      await api.saveTemplate({
        name: newTemplate.name.trim(),
        exercises: formattedExercises
      });

      toast.success(`Template "${newTemplate.name}" created successfully!`);
      setCreateTemplateOpen(false);
      fetchTemplates();
    } catch (e) {
      toast.error("Failed to save template: " + e.message);
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (templateId, templateName, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Delete template "${templateName}"?`)) return;
    try {
      await api.deleteTemplate(templateId);
      toast.success("Template deleted");
      fetchTemplates();
    } catch (err) {
      toast.error("Failed to delete template: " + err.message);
    }
  };

  const addExercise = (ex) => {
    if (pickerTarget === "createTemplate") {
      handleAddExerciseToTemplate(ex);
      return;
    }

    if (!activeWorkout) return;
    
    const newEx = {
      exercise_name: ex.name,
      sets: [{ weight_kg: 0, reps: 10, set_type: "normal", completed: false }],
      prevSets: []
    };

    const nextExercises = [...activeWorkout.exercises, newEx];
    const newIdx = nextExercises.length - 1;

    setActiveWorkout({
      ...activeWorkout,
      exercises: nextExercises
    });
    setPickerOpen(false);

    // Fetch history
    api.getExerciseHistory(ex.name)
      .then(history => {
        setActiveWorkout(prev => {
          if (!prev) return null;
          const updated = [...prev.exercises];
          updated[newIdx].prevSets = history || [];
          return { ...prev, exercises: updated };
        });
      }).catch(() => {});
  };

  const removeExercise = (exIdx) => {
    if (!activeWorkout) return;
    const filtered = activeWorkout.exercises.filter((_, idx) => idx !== exIdx);
    setActiveWorkout({ ...activeWorkout, exercises: filtered });
  };

  const addSetToExercise = (exIdx) => {
    if (!activeWorkout) return;
    const updated = [...activeWorkout.exercises];
    const sets = updated[exIdx].sets;
    const lastSet = sets[sets.length - 1] || { weight_kg: 0, reps: 10, set_type: "normal" };
    
    sets.push({
      weight_kg: lastSet.weight_kg,
      reps: lastSet.reps,
      set_type: "normal",
      completed: false
    });
    
    setActiveWorkout({ ...activeWorkout, exercises: updated });
  };

  const removeSetFromExercise = (exIdx, setIdx) => {
    if (!activeWorkout) return;
    const updated = [...activeWorkout.exercises];
    updated[exIdx].sets = updated[exIdx].sets.filter((_, idx) => idx !== setIdx);
    setActiveWorkout({ ...activeWorkout, exercises: updated });
  };

  const updateSetField = (exIdx, setIdx, field, val) => {
    if (!activeWorkout) return;
    const updated = [...activeWorkout.exercises];
    updated[exIdx].sets[setIdx][field] = val;
    setActiveWorkout({ ...activeWorkout, exercises: updated });
  };

  const toggleSetComplete = (exIdx, setIdx) => {
    if (!activeWorkout) return;
    const updated = [...activeWorkout.exercises];
    const isCompleted = !updated[exIdx].sets[setIdx].completed;
    updated[exIdx].sets[setIdx].completed = isCompleted;
    setActiveWorkout({ ...activeWorkout, exercises: updated });

    if (isCompleted) {
      // Trigger a 90 second rest timer
      setActiveRestTime({ secondsLeft: 90, initial: 90 });
      toast.info("Rest timer started (90s) ⏱️");
    }
  };

  const handleSaveWorkout = async () => {
    if (!activeWorkout) return;
    
    // Validate sets
    const totalSetsList = [];
    activeWorkout.exercises.forEach(block => {
      block.sets.forEach((s, idx) => {
        if (s.completed) {
          totalSetsList.push({
            exercise_name: block.exercise_name,
            set_order: String(idx + 1),
            weight_kg: parseFloat(s.weight_kg) || 0,
            reps: parseInt(s.reps) || 0,
            set_type: s.set_type || "normal",
            distance_m: null,
            duration_s: null
          });
        }
      });
    });

    if (totalSetsList.length === 0) {
      toast.error("Mark at least one set completed (✓) before saving.");
      return;
    }

    setSavingWorkout(true);
    try {
      const formattedDate = new Date().toISOString().replace("T", " ").slice(0, 19);
      
      // Save workout session
      await api.createWorkout({
        workout_name: activeWorkout.workout_name,
        session_date: formattedDate,
        duration_sec: activeWorkout.elapsedSeconds,
        notes: activeWorkout.notes || "",
        sets: totalSetsList
      });

      // Optionally save as template
      if (saveAsTemplate) {
        const templateExercises = activeWorkout.exercises.map(ex => ({
          exercise_name: ex.exercise_name,
          sets: ex.sets.map(s => ({
            reps: parseInt(s.reps) || 10,
            weight_kg: parseFloat(s.weight_kg) || 0,
            set_type: s.set_type || "normal"
          }))
        }));

        await api.saveTemplate({
          name: activeWorkout.workout_name,
          exercises: templateExercises
        }).catch(err => console.error("Failed to save template:", err));
      }

      toast.success("Workout logged successfully! 🎉");
      setActiveWorkout(null);
      setActiveRestTime(null);
      setActiveMainTab("history");
    } catch (err) {
      toast.error(err.message || "Failed to save workout");
    } finally {
      setSavingWorkout(false);
    }
  };

  // ── History detail loaders ─────────────────────────────────────
  const openWorkoutDetail = async (workoutId) => {
    setExpandedWorkoutId(workoutId);
    setLoadingDetail(true);
    try {
      const [res, notes] = await Promise.all([
        api.getWorkout(workoutId),
        api.getSessionNotes(workoutId).catch(() => [])
      ]);
      setDetailedWorkout(res || null);
      setCoachNotes(notes || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load workout details");
      setDetailedWorkout(null);
      setCoachNotes([]);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDeleteWorkout = async (workoutId) => {
    if (!window.confirm("Are you sure you want to delete this workout? This cannot be undone.")) return;
    setDeletingWorkout(true);
    try {
      await api.deleteWorkout(workoutId);
      toast.success("Workout deleted");
      setExpandedWorkoutId(null);
      setDetailedWorkout(null);
      fetchHistory();
    } catch (e) {
      toast.error("Failed to delete workout");
    } finally {
      setDeletingWorkout(false);
    }
  };

  // Helper formatting for timer
  const formatTimer = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs > 0 ? hrs + ":" : ""}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Filtered exercises for picker
  const filteredPickerExercises = exercisesList.filter(e =>
    e.name.toLowerCase().includes(pickerSearch.toLowerCase())
  );

  // Filtered history
  const filteredHistory = historyWorkouts.filter(w =>
    !historySearch || w.workout_name.toLowerCase().includes(historySearch.toLowerCase())
  );

  return (
    <div className="mobile-page" style={{ paddingBottom: 120 }}>
      
      {/* Active Rest Ticker (Floating Bar) */}
      {activeRestTime && (
        <div style={{
          position: "fixed", top: 16, left: 16, right: 16, zIndex: 1000,
          background: "rgba(20,22,26,0.95)", border: "1.5px solid var(--aura-cyan)",
          padding: "10px 16px", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,255,255,0.25)",
          display: "flex", justifyContent: "space-between", alignItems: "center"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={16} color="var(--aura-cyan)" className="pulse" />
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--color-text)" }}>REST TIMER ACTIVE</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 900, color: "var(--aura-cyan)", fontFamily: "monospace" }}>
              {activeRestTime.secondsLeft}s
            </span>
            <button 
              onClick={() => setActiveRestTime(null)}
              style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 18 }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Main Mode switcher (Logger vs History vs Exercises - Mockup Parity) */}
      {!expandedWorkoutId && (
        <div style={{ display: "flex", gap: 6, background: "var(--color-surface)", padding: 4, borderRadius: 14, marginBottom: 20, marginTop: 12 }}>
          {["log", "history", "exercises"].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveMainTab(tab)}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
                background: activeMainTab === tab ? "var(--aura-accent)" : "transparent",
                color: activeMainTab === tab ? "#000" : "var(--text-secondary)",
                fontWeight: 800, fontSize: 11, textTransform: "uppercase", transition: "all 0.2s"
              }}
            >
              {tab === "log" ? "Log Session" : tab}
            </button>
          ))}
        </div>
      )}

      {/* ── LOG WORKOUT TAB ────────────────────────────────────────── */}
      {activeMainTab === "log" && !expandedWorkoutId && (
        <>
          {/* STATE 1: Empty state / Quick Templates launcher */}
          {!activeWorkout ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div className="mobile-card" style={{ padding: 24, textAlign: "center" }}>
                <Dumbbell size={40} color="var(--aura-accent)" style={{ margin: "0 auto 16px" }} />
                <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--color-text)", margin: "0 0 6px" }}>Ready for your session?</h2>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 20px", lineHeight: 1.4 }}>
                  Start tracking your sets, loads, and RPE to trigger progressive overload notifications.
                </p>
                <button 
                  onClick={startEmptyWorkout}
                  style={{
                    width: "100%", background: "var(--aura-accent)", color: "var(--color-bg)", border: "none",
                    padding: 14, borderRadius: 12, fontWeight: 800, fontSize: 14, display: "flex", justifyContent: "center", alignItems: "center", gap: 8
                  }}
                >
                  <Plus size={18} /> Start Empty Workout
                </button>
              </div>

              {/* Templates Section with Custom Creation & Featured Library */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                    <FolderOpen size={16} color="var(--aura-cyan)" /> Workout Templates
                  </h3>
                  
                  <button
                    onClick={handleOpenCreateTemplate}
                    style={{
                      background: "var(--aura-accent)",
                      color: "#ffffff",
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      cursor: "pointer",
                      boxShadow: "0 2px 10px rgba(139, 92, 246, 0.3)"
                    }}
                  >
                    <Plus size={13} strokeWidth={3} /> Create Template
                  </button>
                </div>

                {/* Template Filter Pills */}
                <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }}>
                  {[
                    { id: "all", label: `All (${templates.length + DEFAULT_SYSTEM_TEMPLATES.length})` },
                    { id: "custom", label: `Your Custom (${templates.length})` },
                    { id: "featured", label: `Featured (${DEFAULT_SYSTEM_TEMPLATES.length})` }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setTemplateFilter(f.id)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 8,
                        border: templateFilter === f.id ? "1px solid var(--aura-cyan)" : "1px solid var(--color-border)",
                        background: templateFilter === f.id ? "rgba(6, 182, 212, 0.15)" : "rgba(255,255,255,0.03)",
                        color: templateFilter === f.id ? "var(--aura-cyan)" : "var(--text-secondary)",
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: "pointer",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {loadingTemplates ? (
                  <div style={{ textAlign: "center", padding: 20, color: "var(--text-secondary)" }}>Loading templates...</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {/* User Custom Templates */}
                    {(templateFilter === "all" || templateFilter === "custom") && templates.map((temp) => (
                      <div 
                        key={temp.id}
                        onClick={() => startWorkoutFromTemplate(temp)}
                        className="mobile-card"
                        style={{
                          padding: 14,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          cursor: "pointer",
                          border: "1px solid rgba(139, 92, 246, 0.2)",
                          background: "rgba(139, 92, 246, 0.04)"
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                            <span style={{ fontSize: 9, fontWeight: 900, background: "var(--aura-accent)", color: "#fff", padding: "1px 6px", borderRadius: 4, textTransform: "uppercase" }}>
                              CUSTOM
                            </span>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {temp.name}
                            </div>
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                            {temp.exercises?.length || 0} exercises configured
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <button
                            onClick={(e) => handleDeleteTemplate(temp.id, temp.name, e)}
                            style={{
                              background: "none", border: "none", color: "#EF4444",
                              padding: 6, display: "flex", alignItems: "center", justifyContent: "center",
                              cursor: "pointer", opacity: 0.8
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                          <ChevronRight size={18} color="var(--text-secondary)" />
                        </div>
                      </div>
                    ))}

                    {/* Featured System Templates */}
                    {(templateFilter === "all" || templateFilter === "featured") && DEFAULT_SYSTEM_TEMPLATES.map((temp) => (
                      <div 
                        key={temp.id}
                        onClick={() => startWorkoutFromTemplate(temp)}
                        className="mobile-card"
                        style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                      >
                        <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                            <span style={{ fontSize: 9, fontWeight: 900, background: "rgba(6,182,212,0.15)", color: "var(--aura-cyan)", padding: "1px 6px", borderRadius: 4, textTransform: "uppercase" }}>
                              FEATURED
                            </span>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {temp.name}
                            </div>
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                            {temp.exercises.length} exercises • {temp.category}
                          </div>
                        </div>
                        <ChevronRight size={18} color="var(--text-secondary)" />
                      </div>
                    ))}

                    {templateFilter === "custom" && templates.length === 0 && (
                      <div style={{ textAlign: "center", padding: 24, background: "var(--color-surface)", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 14 }}>
                        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 12px" }}>
                          You haven't created any custom templates yet.
                        </p>
                        <button
                          onClick={handleOpenCreateTemplate}
                          style={{
                            background: "var(--aura-accent)", color: "#fff", border: "none",
                            padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 800,
                            cursor: "pointer"
                          }}
                        >
                          <Plus size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Create Your First Template
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // STATE 2: Workout logger active!
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              
              {/* Header Info (Timer, controls, name) */}
              <div className="mobile-card" style={{ padding: 16, background: "linear-gradient(135deg, rgba(20,22,26,0.95) 0%, rgba(10,11,12,0.95) 100%)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 5, background: "#EF4444", animation: "pulse 1.5s infinite" }} />
                    <span style={{ fontSize: 15, fontWeight: 900, color: "var(--aura-accent)", fontFamily: "monospace" }}>
                      {formatTimer(activeWorkout.elapsedSeconds)}
                    </span>
                  </div>
                  
                  <div style={{ display: "flex", gap: 8 }}>
                    <button 
                      onClick={() => setActiveWorkout(prev => ({ ...prev, isRunning: !prev.isRunning }))}
                      style={{ background: "var(--color-surface-h)", border: "none", color: "var(--color-text)", padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}
                    >
                      {activeWorkout.isRunning ? <><Pause size={12} /> Pause</> : <><Play size={12} /> Resume</>}
                    </button>
                    <button 
                      onClick={() => { if(window.confirm("Discard this workout session?")) setActiveWorkout(null); }}
                      style={{ background: "rgba(239,68,68,0.1)", border: "none", color: "#EF4444", padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700 }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                <input 
                  type="text"
                  value={activeWorkout.workout_name}
                  onChange={e => setActiveWorkout({ ...activeWorkout, workout_name: e.target.value })}
                  style={{ width: "100%", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.1)", color: "var(--color-text)", fontSize: 18, fontWeight: 800, paddingBottom: 6, outline: "none" }}
                  placeholder="Workout Session Name"
                />

                <input 
                  type="text"
                  value={activeWorkout.notes}
                  onChange={e => setActiveWorkout({ ...activeWorkout, notes: e.target.value })}
                  placeholder="Add notes or location..."
                  style={{ width: "100%", background: "none", border: "none", color: "var(--text-secondary)", fontSize: 12, marginTop: 10, outline: "none" }}
                />
              </div>

              {/* Exercises Blocks List */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {activeWorkout.exercises.map((block, exIdx) => {
                  const hasPrev = block.prevSets && block.prevSets.length > 0;
                  const prevBest = hasPrev ? Math.max(...block.prevSets.map(s => s.weight_kg), 0) : 0;
                  
                  return (
                    <div key={exIdx} className="mobile-card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--aura-accent)" }}>{exIdx + 1}</span>
                          <span style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)" }}>{block.exercise_name}</span>
                          
                          {/* Info details sheet popup trigger */}
                          <button
                            onClick={() => {
                              const lookupEx = exercisesList.find(e => e.name.toLowerCase() === block.exercise_name.toLowerCase());
                              if (lookupEx) {
                                setDetailExercise(lookupEx);
                              } else {
                                setDetailExercise({ name: block.exercise_name, category: "lifting", body_part_name: "strength" });
                              }
                            }}
                            style={{
                              background: "none", border: "none", padding: 4, display: "flex",
                              alignItems: "center", justifyContent: "center", cursor: "pointer",
                              color: "var(--aura-accent)"
                            }}
                          >
                            <Info size={14} />
                          </button>
                        </div>
                        
                        <button 
                          onClick={() => removeExercise(exIdx)}
                          style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", opacity: 0.8 }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      {/* Overload indicator */}
                      {hasPrev && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--color-surface)", padding: "6px 10px", borderRadius: 8, fontSize: 11, color: "var(--text-secondary)" }}>
                          <TrendingUp size={12} color="var(--aura-accent)" />
                          <span>Last session max load: <strong>{prevBest} kg</strong>. Aim for progression!</span>
                        </div>
                      )}

                      {/* Header columns */}
                      <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 50px 50px 32px", gap: 8, alignItems: "center", fontSize: 10, fontWeight: 800, color: "var(--text-secondary)", paddingBottom: 4, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <span>SET</span>
                        <span>PREV BEST</span>
                        <span style={{ textAlign: "center" }}>KG</span>
                        <span style={{ textAlign: "center" }}>REPS</span>
                        <span style={{ textAlign: "center" }}>✓</span>
                      </div>

                      {/* Sets list */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {block.sets.map((set, setIdx) => {
                          const matchingPrevSet = hasPrev ? block.prevSets[setIdx] : null;
                          const beatsPrev = matchingPrevSet && (
                            parseFloat(set.weight_kg) > matchingPrevSet.weight_kg ||
                            (parseFloat(set.weight_kg) === matchingPrevSet.weight_kg && parseInt(set.reps) > matchingPrevSet.reps)
                          );

                          return (
                            <div 
                              key={setIdx} 
                              style={{ 
                                display: "grid", 
                                gridTemplateColumns: "24px 1fr 50px 50px 32px", 
                                gap: 8, 
                                alignItems: "center",
                                background: set.completed ? "rgba(34,197,94,0.04)" : "transparent",
                                borderRadius: 6,
                                padding: "4px 0"
                              }}
                            >
                              {/* Set Label */}
                              <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-secondary)", fontFamily: "monospace" }}>
                                {setIdx + 1}
                              </span>

                              {/* Previous stats */}
                              <span style={{ fontSize: 11, color: beatsPrev ? "var(--aura-accent)" : "var(--text-secondary)", display: "flex", alignItems: "center", gap: 2 }}>
                                {beatsPrev && <TrendingUp size={10} />}
                                {matchingPrevSet ? `${matchingPrevSet.weight_kg}kg x ${matchingPrevSet.reps}` : "—"}
                              </span>

                              {/* Weight Input */}
                              <input 
                                type="number" 
                                value={set.weight_kg}
                                onChange={e => updateSetField(exIdx, setIdx, "weight_kg", e.target.value)}
                                style={{ width: 50, background: "var(--color-surface-h)", border: "1px solid var(--color-border)", borderRadius: 6, padding: 6, color: "var(--color-text)", fontSize: 12, textAlign: "center" }}
                              />

                              {/* Reps Input */}
                              <input 
                                type="number" 
                                value={set.reps}
                                onChange={e => updateSetField(exIdx, setIdx, "reps", e.target.value)}
                                style={{ width: 50, background: "var(--color-surface-h)", border: "1px solid var(--color-border)", borderRadius: 6, padding: 6, color: "var(--color-text)", fontSize: 12, textAlign: "center" }}
                              />

                              {/* Checkbox Trigger */}
                              <button
                                onClick={() => toggleSetComplete(exIdx, setIdx)}
                                style={{
                                  width: 28, height: 28, borderRadius: 6, border: "none",
                                  background: set.completed ? "var(--aura-accent)" : "rgba(255,255,255,0.05)",
                                  color: set.completed ? "#000" : "rgba(255,255,255,0.3)",
                                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer"
                                }}
                              >
                                <Check size={14} strokeWidth={3} />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Add Set Button */}
                      <button 
                        onClick={() => addSetToExercise(exIdx)}
                        style={{ background: "none", border: "none", color: "var(--aura-accent)", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, padding: "4px 0", marginTop: 4 }}
                      >
                        <Plus size={12} /> Add Set
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Add Exercise Controller */}
              <button 
                onClick={() => setPickerOpen(true)}
                style={{
                  width: "100%", padding: 15, borderRadius: 12,
                  border: "1.5px dashed rgba(255,255,255,0.15)", background: "var(--color-surface)",
                  color: "var(--color-text)", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer"
                }}
              >
                <Plus size={16} /> Add Exercise
              </button>

              {/* Save Panel */}
              <div className="mobile-card" style={{ padding: 16, marginTop: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <input 
                    type="checkbox"
                    id="save_as_template"
                    checked={saveAsTemplate}
                    onChange={e => setSaveAsTemplate(e.target.checked)}
                    style={{ accentColor: "var(--aura-accent)" }}
                  />
                  <label htmlFor="save_as_template" style={{ fontSize: 13, color: "var(--color-text)", fontWeight: 600 }}>
                    Auto-save session as template
                  </label>
                </div>

                <button
                  onClick={handleSaveWorkout}
                  disabled={savingWorkout}
                  style={{
                    width: "100%", background: "var(--aura-accent)", color: "var(--color-bg)", border: "none",
                    borderRadius: 12, padding: 15, fontWeight: 900, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 6
                  }}
                >
                  <Save size={16} /> {savingWorkout ? "Saving workout..." : "Save Workout Session"}
                </button>
              </div>

            </div>
          )}
        </>
      )}

      {/* ── WORKOUT HISTORY TAB ────────────────────────────────────── */}
      {activeMainTab === "history" && !expandedWorkoutId && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          
          {/* Search box */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            background: "var(--color-surface-h)", 
            border: "1px solid var(--color-border)",
            padding: "10px 14px", 
            borderRadius: 12, 
            gap: 10
          }}>
            <Search size={16} color="var(--text-secondary)" />
            <input 
              type="text" 
              placeholder="Search logged workouts..." 
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              style={{ background: 'none', border: 'none', outline: 'none', color: "var(--color-text)", width: '100%', fontSize: 14 }}
            />
          </div>

          {/* History List */}
          {loadingHistory ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>Loading logged history...</div>
          ) : filteredHistory.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)", fontSize: 13 }}>No matching workouts found in your history.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filteredHistory.map(workout => (
                <div 
                  key={workout.id}
                  onClick={() => openWorkoutDetail(workout.id)}
                  className="mobile-card"
                  style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                >
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--color-text)", margin: "0 0 4px" }}>{workout.workout_name}</h3>
                    <p style={{ color: "var(--text-secondary)", fontSize: 11, margin: 0 }}>
                      {new Date(workout.session_date).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                      <span style={{ fontSize: 10, background: "var(--color-surface-h)", color: "var(--color-text)", padding: "2px 6px", borderRadius: 6 }}>
                        {fmt.int(workout.total_volume)} kg
                      </span>
                      <span style={{ fontSize: 10, background: "var(--color-surface-h)", color: "var(--color-text)", padding: "2px 6px", borderRadius: 6 }}>
                        {workout.total_sets} sets
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={18} color="var(--text-secondary)" />
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* ── DETAILED HISTORY VIEW ──────────────────────────────────── */}
      {expandedWorkoutId && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0" }}>
            <button 
              onClick={() => { setExpandedWorkoutId(null); setDetailedWorkout(null); }}
              style={{ background: "var(--color-surface)", border: "none", color: "var(--color-text)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 10 }}
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--color-text)", margin: 0 }}>
                {detailedWorkout ? detailedWorkout.workout_name : "Loading..."}
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: 12, margin: 0 }}>Workout details</p>
            </div>
          </div>

          {loadingDetail ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>Loading session details...</div>
          ) : !detailedWorkout ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>Could not load workout record.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Stats Summary Card */}
              <div className="mobile-card" style={{ padding: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, textAlign: "center" }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "var(--aura-accent)" }}>{fmt.int(detailedWorkout.total_volume)}</div>
                    <div style={{ fontSize: 9, color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", marginTop: 2 }}>Volume kg</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "var(--aura-accent)" }}>{detailedWorkout.total_sets}</div>
                    <div style={{ fontSize: 9, color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", marginTop: 2 }}>Total Sets</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "var(--aura-accent)" }}>
                      {detailedWorkout.duration_sec > 0 ? Math.round(detailedWorkout.duration_sec / 60) + "m" : "—"}
                    </div>
                    <div style={{ fontSize: 9, color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", marginTop: 2 }}>Duration</div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {detailedWorkout.notes && (
                <div className="mobile-card" style={{ padding: 14 }}>
                  <h4 style={{ fontSize: 11, fontWeight: 800, color: "var(--text-secondary)", margin: "0 0 6px", textTransform: "uppercase" }}>Notes</h4>
                  <p style={{ fontSize: 12, color: "var(--color-text)", margin: 0, lineHeight: 1.4 }}>{detailedWorkout.notes}</p>
                </div>
              )}

              {/* Coach Feedback */}
              {coachNotes && coachNotes.length > 0 && (
                <div className="mobile-card" style={{ padding: 14 }}>
                  <h4 style={{ fontSize: 11, fontWeight: 800, color: "var(--aura-cyan)", margin: "0 0 6px", textTransform: "uppercase" }}>Coach Feedback</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {coachNotes.map(n => (
                      <div key={n.id} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 10, border: "1px solid rgba(255,255,255,0.04)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--text-secondary)", fontWeight: 700, marginBottom: 4 }}>
                          <span>{n.coach_name || "Coach"}</span>
                          <span>{new Date(n.created_at).toLocaleDateString()}</span>
                        </div>
                        <p style={{ fontSize: 12, color: "var(--color-text)", margin: 0, lineHeight: 1.4 }}>{n.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Exercises detailed blocks */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {Object.entries(
                  (detailedWorkout.sets || []).reduce((acc, set) => {
                    const name = set.exercise_name || "Unknown";
                    if (!acc[name]) acc[name] = [];
                    acc[name].push(set);
                    return acc;
                  }, {})
                ).map(([name, sets], idx) => {
                  const maxWeight = Math.max(...sets.map(s => s.weight_kg), 0);
                  const totalVol = sets.reduce((sum, s) => sum + s.volume_load, 0);

                  return (
                    <div key={idx} className="mobile-card" style={{ padding: 14 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)", margin: "0 0 4px" }}>{name}</h3>
                      <div style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 700, marginBottom: 12 }}>
                        {sets.length} sets · Max: {maxWeight}kg · Vol: {totalVol}kg
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 8, borderLeft: "2px solid rgba(255,255,255,0.06)" }}>
                        {sets.map((set, sIdx) => (
                          <div key={sIdx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, paddingBottom: 4, borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                            <span style={{ color: "var(--text-secondary)", fontWeight: 700, fontFamily: "monospace" }}>Set {set.set_order}</span>
                            <span style={{ color: "var(--color-text)", fontWeight: 800 }}>{set.weight_kg}kg x {set.reps} reps</span>
                            {set.one_rm_est > 0 && (
                              <span style={{ fontSize: 10, color: "var(--aura-accent)" }}>e1RM: {Math.round(set.one_rm_est)}kg</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Delete workout button */}
              <button
                disabled={deletingWorkout}
                onClick={() => handleDeleteWorkout(detailedWorkout.id)}
                style={{
                  width: "100%", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                  color: "#EF4444", borderRadius: 12, padding: 14, fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10
                }}
              >
                <Trash2 size={14} /> {deletingWorkout ? "Deleting Workout..." : "Delete Workout Record"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Exercise Picker Sheet (Only used when logger is open) */}
      <MobileBottomSheet 
        isOpen={pickerOpen} 
        onClose={() => setPickerOpen(false)} 
        title="Select Exercise"
      >
        <div style={{ position: "relative", marginBottom: 16 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
          <input
            type="text"
            placeholder="Search exercises..."
            value={pickerSearch}
            onChange={(e) => setPickerSearch(e.target.value)}
            style={{ width: "100%", background: "var(--color-surface-h)", border: "none", borderRadius: 12, padding: "12px 12px 12px 36px", color: "var(--color-text)", fontSize: 15, outline: "none" }}
          />
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "50vh", overflowY: "auto" }}>
          {filteredPickerExercises.map(ex => {
            const color = CATEGORY_COLORS[ex.category] || "#00f2fe";
            return (
              <button
                key={ex.id}
                onClick={() => addExercise(ex)}
                style={{ 
                  width: "100%", background: "transparent", border: "none", padding: "12px 8px", 
                  color: "var(--color-text)", textAlign: "left", fontSize: 14, fontWeight: 700, 
                  borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", 
                  justifyContent: "space-between", alignItems: "center", cursor: "pointer" 
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, position: 'relative', overflow: 'hidden',
                    background: `color-mix(in srgb, ${color} 15%, transparent)`,
                    display: "flex", justifyContent: "center", alignItems: "center",
                    fontSize: 9, fontWeight: 900, color: color, flexShrink: 0,
                    border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`
                  }}>
                    <span>{ex.name.slice(0, 2).toUpperCase()}</span>
                    {(ex.image_url || ex.gif_url) && (
                      <img 
                        src={resolveBackendUrl(ex.gif_url || ex.image_url)} 
                        alt={ex.name} 
                        style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => e.currentTarget.style.display = 'none'}
                      />
                    )}
                  </div>
                  {ex.name}
                </div>
                <Plus size={16} color="var(--aura-accent)" />
              </button>
            );
          })}
          {filteredPickerExercises.length === 0 && (
            <div style={{ textAlign: "center", padding: 20, color: "var(--text-secondary)", fontSize: 12 }}>No exercises found.</div>
          )}
        </div>
      </MobileBottomSheet>

      {/* ── EXERCISES EXPLORER TAB PANEL ── */}
      {activeMainTab === "exercises" && !expandedWorkoutId && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!selectedBodyPart ? (
            <div className="mobile-card" style={{ padding: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <div style={{ textAlign: "center" }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--color-text)", margin: "0 0 4px" }}>Select a Muscle Group</h3>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>Tap a body part to see exercises</p>
              </div>
              <BodyMap selected={selectedBodyPart} onSelect={setSelectedBodyPart} />
            </div>
          ) : (
            <>
              {/* Back Breadcrumb */}
              <button 
                onClick={() => setSelectedBodyPart(null)}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: 6, background: "var(--color-surface-h)", 
                  border: "1px solid var(--color-border)", padding: "8px 14px", borderRadius: 12, 
                  color: "var(--color-text)", fontSize: 13, fontWeight: 700, width: "fit-content", cursor: "pointer"
                }}
              >
                <ArrowLeft size={16} /> Back to Body Map
              </button>

              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--aura-accent)", textTransform: "capitalize" }}>
                {selectedBodyPart} Exercises
              </div>

              {/* Search box */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                background: "var(--color-surface)", 
                border: "1px solid var(--color-border)",
                padding: "12px 14px", 
                borderRadius: 14, 
                gap: 10
              }}>
                <Search size={16} color="var(--text-secondary)" />
                <input 
                  type="text" 
                  placeholder="Search all exercises..." 
                  value={exerciseSearch}
                  onChange={(e) => setExerciseSearch(e.target.value)}
                  style={{ background: 'none', border: 'none', outline: 'none', color: "var(--color-text)", width: '100%', fontSize: 14 }}
                />
              </div>

              {/* Equipment filter chips */}
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, width: "100%", scrollbarWidth: "none" }}>
                {EQUIPMENT_CHIPS.map(chip => (
                  <button 
                    key={chip} 
                    onClick={() => setSelectedEquipment(chip)}
                    style={{
                      padding: "6px 14px", borderRadius: 999, border: "none",
                      fontSize: 11, fontWeight: 700, cursor: "pointer",
                      whiteSpace: "nowrap", textTransform: "capitalize", transition: "all 0.2s",
                      background: selectedEquipment === chip ? "var(--aura-accent)" : "rgba(255,255,255,0.02)",
                      color: selectedEquipment === chip ? "#000" : "var(--text-secondary)",
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Exercises list */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {exercisesList
                  .filter(ex => {
                    const matchSearch = ex.name.toLowerCase().includes(exerciseSearch.toLowerCase());
                    const matchEquip = selectedEquipment === "All" || (ex.equipment && ex.equipment.toLowerCase() === selectedEquipment.toLowerCase());
                    const matchBodyPart = !selectedBodyPart || (ex.body_part_name || ex.category || "").toLowerCase() === selectedBodyPart.toLowerCase();
                    return matchSearch && matchEquip && matchBodyPart;
                  })
                  .map(ex => {
                    const color = CATEGORY_COLORS[ex.category] || "#00f2fe";
                    return (
                      <div 
                        key={ex.id}
                        onClick={() => setDetailExercise(ex)}
                        className="mobile-card"
                        style={{ 
                          padding: "14px 16px", display: "flex", alignItems: "center", 
                          gap: 12, cursor: "pointer", margin: 0,
                          background: "var(--color-surface)",
                          border: "1px solid var(--color-border)"
                        }}
                      >
                        {/* Visual indicator */}
                        <div style={{
                          width: 40, height: 40, borderRadius: 10, position: 'relative', overflow: 'hidden',
                          background: `color-mix(in srgb, ${color} 15%, transparent)`,
                          display: "flex", justifyContent: "center", alignItems: "center",
                          fontSize: 11, fontWeight: 900, color: color, flexShrink: 0,
                          border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`
                        }}>
                          <span>{ex.name.slice(0, 2).toUpperCase()}</span>
                          {(ex.image_url || ex.gif_url) && (
                            <img 
                              src={resolveBackendUrl(ex.gif_url || ex.image_url)} 
                              alt={ex.name} 
                              style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => e.currentTarget.style.display = 'none'}
                            />
                          )}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                            {ex.name}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2, textTransform: "capitalize" }}>
                            {ex.category} · {ex.equipment || "body weight"}
                          </div>
                        </div>

                        <ChevronRight size={16} color="var(--text-secondary)" />
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── CREATE WORKOUT TEMPLATE MODAL / SHEET ── */}
      <MobileBottomSheet
        isOpen={createTemplateOpen}
        onClose={() => setCreateTemplateOpen(false)}
        title="Create Workout Template"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 24 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              Template Name
            </label>
            <input
              type="text"
              placeholder="e.g. Chest & Triceps Blast, Leg Day Alpha"
              value={newTemplate.name}
              onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
              style={{
                width: "100%",
                background: "var(--color-surface-h)",
                border: "1px solid var(--color-border)",
                borderRadius: 12,
                padding: "12px 14px",
                color: "var(--color-text)",
                fontSize: 14,
                fontWeight: 700,
                outline: "none"
              }}
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                Exercises ({newTemplate.exercises.length})
              </label>
              <button
                type="button"
                onClick={() => {
                  setPickerTarget("createTemplate");
                  setPickerOpen(true);
                }}
                style={{
                  background: "rgba(6, 182, 212, 0.15)",
                  color: "var(--aura-cyan)",
                  border: "1px solid rgba(6, 182, 212, 0.3)",
                  padding: "4px 10px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  cursor: "pointer"
                }}
              >
                <Plus size={12} strokeWidth={3} /> Add Exercise
              </button>
            </div>

            {newTemplate.exercises.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", background: "var(--color-surface)", borderRadius: 12, border: "1px dashed var(--color-border)", color: "var(--text-secondary)", fontSize: 12 }}>
                No exercises added yet. Tap "Add Exercise" above.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {newTemplate.exercises.map((ex, exIdx) => (
                  <div key={exIdx} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--color-border)", borderRadius: 12, padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--color-text)" }}>
                        {exIdx + 1}. {ex.exercise_name}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveExerciseFromTemplate(exIdx)}
                        style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", padding: 2 }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Sets preview */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {ex.sets.map((s, sIdx) => (
                        <div key={sIdx} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                          <span style={{ color: "var(--text-secondary)", width: 36, fontFamily: "monospace" }}>Set {sIdx + 1}</span>
                          <input
                            type="number"
                            placeholder="KG"
                            value={s.weight_kg}
                            onChange={(e) => handleUpdateTemplateSet(exIdx, sIdx, "weight_kg", e.target.value)}
                            style={{ width: 60, background: "var(--color-surface-h)", border: "1px solid var(--color-border)", borderRadius: 6, padding: "4px 8px", color: "var(--color-text)", textAlign: "center" }}
                          />
                          <span style={{ color: "var(--text-secondary)" }}>kg ×</span>
                          <input
                            type="number"
                            placeholder="Reps"
                            value={s.reps}
                            onChange={(e) => handleUpdateTemplateSet(exIdx, sIdx, "reps", e.target.value)}
                            style={{ width: 50, background: "var(--color-surface-h)", border: "1px solid var(--color-border)", borderRadius: 6, padding: "4px 8px", color: "var(--color-text)", textAlign: "center" }}
                          />
                          <span style={{ color: "var(--text-secondary)" }}>reps</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSetFromTemplateExercise(exIdx, sIdx)}
                            style={{ background: "none", border: "none", color: "#EF4444", marginLeft: "auto", cursor: "pointer" }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddSetToTemplateExercise(exIdx)}
                      style={{ background: "none", border: "none", color: "var(--aura-accent)", fontSize: 11, fontWeight: 700, marginTop: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 2 }}
                    >
                      <Plus size={11} /> Add Set
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={savingTemplate}
            onClick={handleSaveNewTemplate}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 12,
              background: "var(--aura-accent)",
              color: "#ffffff",
              border: "none",
              fontWeight: 900,
              fontSize: 14,
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(139, 92, 246, 0.4)",
              marginTop: 8
            }}
          >
            {savingTemplate ? "Saving Template..." : "Save Template"}
          </button>
        </div>
      </MobileBottomSheet>

      {/* Reusable Mobile Overlay Detail Sheet */}
      {detailExercise && (
        <ExerciseDetailSheet 
          exercise={detailExercise} 
          onClose={() => setDetailExercise(null)} 
        />
      )}
    </div>
  );
}
