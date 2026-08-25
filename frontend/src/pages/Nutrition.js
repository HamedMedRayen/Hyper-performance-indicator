import React, { useState, useEffect } from "react";
import {
  Apple, Plus, History, Settings, Brain, Save, Search, Utensils, Zap,
  Clipboard, Copy, Camera, Droplet, Sparkles, ChevronLeft, ChevronRight,
  Calendar, Trash2, PieChart, Flame, Footprints, Clock, Award, ShieldCheck,
  Sunrise, Sun, Moon, BookOpen, LayoutDashboard, TrendingUp, Play, Square,
  Edit3, BarChart2
} from "lucide-react";
import { useTheme } from "../utils/theme";
import Header from "../components/layout/Header";
import { api } from "../utils/api";
import { useToast } from "../components/common/Toast";
import { getItem, setItem } from "../utils/storage";

// Modals & Sub-components
import FoodSearchModal from "../components/nutrition/FoodSearchModal";
import QuickAddModal from "../components/nutrition/QuickAddModal";
import RecipeBuilderModal from "../components/nutrition/RecipeBuilderModal";
import CustomFoodModal from "../components/nutrition/CustomFoodModal";
import NutritionCalculator from "../components/nutrition/NutritionCalculator";
import MealScanModal from "../components/nutrition/MealScanModal";
import EditGoalsModal from "../components/nutrition/EditGoalsModal";
import WeeklyReportView from "../components/nutrition/WeeklyReportView";
import CalorieRingHeader from "../components/nutrition/CalorieRingHeader";
import MacroRing from "../components/nutrition/MacroRing";

const MEAL_CATEGORIES = [
  { id: "Breakfast", name: "Breakfast", icon: Sunrise, color: "#ff922b" },
  { id: "Lunch", name: "Lunch", icon: Sun, color: "#fcc419" },
  { id: "Dinner", name: "Dinner", icon: Moon, color: "#845ef7" },
  { id: "Snacks", name: "Snacks", icon: Apple, color: "#51cf66" }
];

export default function Nutrition() {
  const { theme, previewTheme } = useTheme();
  const activeTheme = previewTheme || theme;
  const toast = useToast();

  // Navigation Sub-Sections (Tabs matching design system)
  const [activeTab, setActiveTab] = useState("diary"); // 'diary', 'dashboard', 'report', 'ai_tools'

  // Date Navigation State
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Nutrition Data
  const [loading, setLoading] = useState(true);
  const [todayData, setTodayData] = useState({ meals: [], totals: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 } });
  const [history, setHistory] = useState([]);
  const [todayWater, setTodayWater] = useState(0);

  // Fasting Tracker State
  const [fasting, setFasting] = useState({
    active: false,
    startTime: null,
    targetHours: 16,
    windowLabel: "16:8 Fasting"
  });
  const [elapsedFastingSeconds, setElapsedFastingSeconds] = useState(0);

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'search', 'quick', 'recipe', 'custom', 'vision', 'edit_goals'
  const [targetCategory, setTargetCategory] = useState("Breakfast");
  const [scanText, setScanText] = useState("");
  const [scanningText, setScanningText] = useState(false);

  // Targets State (Editable Calories & Macros)
  const [targets, setTargets] = useState({
    calories: 2000,
    protein: 150,
    carbs: 220,
    fat: 65,
    water: 3000,
    exerciseCalories: 300,
    stepsGoal: 10000
  });

  const [exerciseBurned, setExerciseBurned] = useState(0);
  const [stepsCount, setStepsCount] = useState(4200);

  useEffect(() => {
    fetchTargets();
    loadFastingState();
  }, []);

  useEffect(() => {
    refreshData(selectedDate);
  }, [selectedDate]);

  // Fasting Timer Effect
  useEffect(() => {
    let interval = null;
    if (fasting.active && fasting.startTime) {
      const updateTimer = () => {
        const start = new Date(fasting.startTime).getTime();
        const now = new Date().getTime();
        const diffSecs = Math.max(0, Math.floor((now - start) / 1000));
        setElapsedFastingSeconds(diffSecs);
      };
      updateTimer();
      interval = setInterval(updateTimer, 1000);
    } else {
      setElapsedFastingSeconds(0);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [fasting]);

  const loadFastingState = async () => {
    try {
      const saved = await getItem("aura_fasting_state");
      if (saved) setFasting(JSON.parse(saved));
    } catch (e) {
      console.error("Failed to load fasting state", e);
    }
  };

  const toggleFasting = async () => {
    let nextState;
    if (fasting.active) {
      nextState = { ...fasting, active: false, startTime: null };
      if (toast?.success) toast.success("Fasting period completed!");
    } else {
      nextState = { ...fasting, active: true, startTime: new Date().toISOString() };
      if (toast?.success) toast.success(`Started ${fasting.windowLabel}!`);
    }
    setFasting(nextState);
    await setItem("aura_fasting_state", JSON.stringify(nextState));
  };

  const fetchTargets = async () => {
    try {
      const savedTargets = await getItem("aura_macro_targets");
      if (savedTargets) {
        const parsed = JSON.parse(savedTargets);
        setTargets({
          calories: 2000,
          protein: 150,
          carbs: 220,
          fat: 65,
          water: 3000,
          stepsGoal: 10000,
          exerciseCalories: 300,
          ...parsed
        });
      } else {
        const latest = await api.getLatestNutritionTargets();
        if (latest) {
          setTargets({
            calories: latest.final_calories || 2000,
            protein: latest.final_protein || 150,
            carbs: latest.final_carbs || 220,
            fat: latest.final_fat || 65,
            water: 3000,
            exerciseCalories: 300,
            stepsGoal: 10000
          });
        }
      }
    } catch (e) {
      console.error("Failed to fetch targets", e);
    }
  };

  const refreshData = async (dateStr) => {
    setLoading(true);
    try {
      const [today, water, hist] = await Promise.all([
        api.getNutritionToday(dateStr),
        api.getWaterToday(),
        api.getNutritionHistory()
      ]);
      setTodayData(today || { meals: [], totals: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 } });
      setTodayWater(water?.amount_ml || 0);
      setHistory(hist || []);
    } catch (e) {
      console.error("Failed to fetch nutrition data", e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddWater = async (ml) => {
    setTodayWater(prev => prev + ml);
    try {
      await api.logWater(ml, "add");
    } catch (e) {
      refreshData(selectedDate);
    }
  };

  const handleDeleteLog = async (logId) => {
    try {
      await api.deleteNutritionLog(logId);
      if (toast?.success) toast.success("Item removed");
      refreshData(selectedDate);
    } catch (e) {
      if (toast?.error) toast.error("Failed to delete log");
    }
  };

  const handleCopyYesterday = async () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    const yStr = d.toISOString().split('T')[0];

    try {
      await api.copyMeals(yStr, selectedDate);
      if (toast?.success) toast.success("Meals copied from previous day!");
      refreshData(selectedDate);
    } catch (e) {
      if (toast?.error) toast.error("Failed to copy meals");
    }
  };

  const handleScanText = async () => {
    if (!scanText.trim()) return;
    setScanningText(true);
    try {
      await api.scanMeal(scanText.trim(), targetCategory, selectedDate);
      setScanText("");
      if (toast?.success) toast.success(`Meal logged into ${targetCategory}!`);
      refreshData(selectedDate);
    } catch (err) {
      if (toast?.error) toast.error("Failed to analyze meal text.");
    } finally {
      setScanningText(false);
    }
  };

  const changeDate = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const openFoodSearch = (category = "Breakfast") => {
    setTargetCategory(category);
    setActiveModal('search');
  };

  const openQuickAdd = (category = "Breakfast") => {
    setTargetCategory(category);
    setActiveModal('quick');
  };

  const foodCalories = Math.round(todayData.totals.calories || 0);
  const remainingCalories = targets.calories - foodCalories + exerciseBurned;
  const isToday = selectedDate === new Date().toISOString().split("T")[0];

  const formatFastingTime = (totalSecs) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const mealsByCategory = MEAL_CATEGORIES.reduce((acc, cat) => {
    acc[cat.id] = (todayData.meals || []).filter(m => (m.meal_category || "Breakfast") === cat.id);
    return acc;
  }, {});

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 100 }}>
      <Header title="Nutrition Hub" subtitle="MyFitnessPal-Style Food Logging & Energy Tracker" />

      <div className="page-inner" style={{ maxWidth: 880, margin: "0 auto", padding: "0 16px" }}>

        {/* ── Sub-Navigation Bar (Tabs matching design system) ── */}
        <div style={{
          display: "flex",
          gap: 6,
          background: "var(--color-bg-card)",
          padding: 6,
          borderRadius: 16,
          border: "1px solid var(--color-border)",
          marginBottom: 20
        }}>
          <button
            onClick={() => setActiveTab("diary")}
            className={`tab-btn ${activeTab === "diary" ? "active" : ""}`}
          >
            <BookOpen size={16} /> Diary & Meals
          </button>
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`tab-btn ${activeTab === "dashboard" ? "active" : ""}`}
          >
            <LayoutDashboard size={16} /> Dashboard
          </button>
          <button
            onClick={() => setActiveTab("report")}
            className={`tab-btn ${activeTab === "report" ? "active" : ""}`}
          >
            <BarChart2 size={16} /> Weekly Report & Archive
          </button>
          <button
            onClick={() => setActiveTab("ai_tools")}
            className={`tab-btn ${activeTab === "ai_tools" ? "active" : ""}`}
          >
            <Brain size={16} /> AI Tools
          </button>
        </div>

        {/* ── DATE NAVIGATION BAR ── */}
        <div className="card" style={{
          padding: "12px 20px",
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--color-bg-card)",
          borderRadius: 16
        }}>
          <button onClick={() => changeDate(-1)} className="date-nav-btn">
            <ChevronLeft size={18} /> Prev
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 16 }}>
            <Calendar size={18} color="var(--aura-accent, #00f2fe)" />
            <span>{isToday ? `Today (${selectedDate})` : selectedDate}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {!isToday && (
              <button onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])} className="date-nav-btn" style={{ color: "var(--aura-accent, #00f2fe)" }}>
                Today
              </button>
            )}
            <button onClick={() => changeDate(1)} className="date-nav-btn">
              Next <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* ── TOP CALORIE REMAINING RING HEADER ── */}
        <CalorieRingHeader
          targets={targets}
          foodCalories={foodCalories}
          exerciseBurned={exerciseBurned}
          remainingCalories={remainingCalories}
          todayData={todayData}
          onSetGoal={() => setActiveModal('calculator')}
          onEditGoals={() => setActiveModal('edit_goals')}
        />

        {/* ========================================================= */}
        {/* TAB 1: DIARY & MEALS VIEW                                 */}
        {/* ========================================================= */}
        {activeTab === "diary" && (
          <div>
            {/* Fasting Tracker Section */}
            <div className="card" style={{
              padding: "16px 20px",
              marginBottom: 20,
              background: "linear-gradient(135deg, rgba(186, 85, 211, 0.08) 0%, rgba(0, 242, 254, 0.05) 100%)",
              border: "1px solid rgba(186, 85, 211, 0.2)",
              borderRadius: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(186, 85, 211, 0.15)", display: "flex", justifyContent: "center", alignItems: "center", color: "#ba55d3" }}>
                  <Clock size={22} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>Fasting ({fasting.windowLabel})</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-3)" }}>
                    {fasting.active
                      ? `Elapsed: ${formatFastingTime(elapsedFastingSeconds)}`
                      : "20:00 - 10:00 Window"}
                  </div>
                </div>
              </div>
              <button
                onClick={toggleFasting}
                style={{
                  padding: "8px 18px",
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 13,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: fasting.active ? "rgba(255, 77, 79, 0.2)" : "var(--aura-accent, #00f2fe)",
                  color: fasting.active ? "#ff4d4f" : "#000"
                }}
              >
                {fasting.active ? <Square size={14} fill="#ff4d4f" /> : <Play size={14} fill="#000" />}
                {fasting.active ? "End Fast" : "Start Fast"}
              </button>
            </div>

            {/* Meal Category Sub-Sections (Breakfast, Lunch, Dinner, Snacks) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {MEAL_CATEGORIES.map(cat => {
                const IconComponent = cat.icon;
                const categoryMeals = mealsByCategory[cat.id] || [];
                const categoryKcal = Math.round(categoryMeals.reduce((sum, m) => sum + (m.calories || 0), 0));

                return (
                  <div key={cat.id} className="card" style={{ padding: 20, borderRadius: 18, background: "var(--color-bg-card)" }}>
                    {/* Meal Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: "1px solid var(--color-border)", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: `${cat.color}20`, display: "flex", justifyContent: "center", alignItems: "center", color: cat.color }}>
                          <IconComponent size={18} />
                        </div>
                        <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>{cat.name}</h3>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: "var(--aura-accent, #00f2fe)" }}>
                        {categoryKcal} <span style={{ fontSize: 12, color: "var(--color-text-3)" }}>kcal</span>
                      </div>
                    </div>

                    {/* Meal Items List */}
                    {categoryMeals.length === 0 ? (
                      <div style={{ fontSize: 13, color: "var(--color-text-3)", padding: "10px 0", fontStyle: "italic" }}>
                        No foods logged in {cat.name} yet.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                        {categoryMeals.map(item => (
                          <div key={item.id} style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "8px 12px",
                            background: "rgba(255,255,255,0.02)",
                            borderRadius: 10,
                            border: "1px solid rgba(255,255,255,0.04)"
                          }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 14 }}>{item.meal_name}</div>
                              <div style={{ fontSize: 11, color: "var(--color-text-3)" }}>
                                P: {Math.round(item.protein_g || 0)}g • C: {Math.round(item.carbs_g || 0)}g • F: {Math.round(item.fat_g || 0)}g
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <span style={{ fontWeight: 800, fontSize: 14 }}>{Math.round(item.calories || 0)} kcal</span>
                              <button onClick={() => handleDeleteLog(item.id)} style={{ background: "none", border: "none", color: "#ff4d4f", cursor: "pointer", opacity: 0.7 }}>
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action Bar (+ ADD FOOD & QUICK ADD) */}
                    <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                      <button
                        onClick={() => openFoodSearch(cat.id)}
                        style={{
                          flex: 1,
                          padding: "10px",
                          borderRadius: 10,
                          border: "1px dashed var(--aura-accent, #00f2fe)",
                          background: "rgba(0, 242, 254, 0.05)",
                          color: "var(--aura-accent, #00f2fe)",
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          gap: 6
                        }}
                      >
                        <Plus size={16} /> ADD FOOD
                      </button>
                      <button
                        onClick={() => openQuickAdd(cat.id)}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 10,
                          border: "1px solid var(--color-border)",
                          background: "rgba(255,255,255,0.03)",
                          color: "var(--color-text-3)",
                          fontWeight: 600,
                          fontSize: 12,
                          cursor: "pointer"
                        }}
                      >
                        Quick Add
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Copy Prev Day Action */}
            <div style={{ marginTop: 20, textAlign: "center" }}>
              <button
                onClick={handleCopyYesterday}
                className="date-nav-btn"
                style={{ margin: "0 auto", padding: "10px 20px" }}
              >
                <Copy size={15} /> Copy Meals From Yesterday
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: DASHBOARD / OVERVIEW VIEW                          */}
        {/* ========================================================= */}
        {activeTab === "dashboard" && (
          <div>
            {/* Macro Progress Rings Grid */}
            <div className="card" style={{ padding: 24, marginBottom: 20, background: "var(--color-bg-card)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Macronutrients Goals</h3>
                <button onClick={() => setActiveModal('edit_goals')} style={{ background: "none", border: "none", color: "var(--aura-accent, #00f2fe)", cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                  <Edit3 size={14} /> Edit Target Macros
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, textAlign: "center", marginTop: 16 }}>
                <MacroRing value={foodCalories} target={targets.calories} color="var(--aura-accent)" label="Calories" unit="kcal" />
                <MacroRing value={todayData.totals.protein_g} target={targets.protein} color="var(--aura-accent2)" label="Protein" unit="g" />
                <MacroRing value={todayData.totals.carbs_g} target={targets.carbs} color="var(--aura-accent3)" label="Carbs" unit="g" />
                <MacroRing value={todayData.totals.fat_g} target={targets.fat} color="var(--aura-accent4)" label="Fat" unit="g" />
              </div>
            </div>

            {/* Dashboard Widgets Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              {/* Steps Widget */}
              <div className="card" style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255, 107, 107, 0.15)", display: "flex", justifyContent: "center", alignItems: "center", color: "#ff6b6b" }}>
                    <Footprints size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "var(--color-text-3)" }}>Steps Count</div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{(stepsCount || 0).toLocaleString()}</div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "var(--color-text-3)", marginBottom: 6 }}>Goal: {(targets?.stepsGoal || 10000).toLocaleString()} steps</div>
                <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, ((stepsCount || 0) / (targets?.stepsGoal || 10000)) * 100)}%`, height: "100%", background: "#ff6b6b" }} />
                </div>
              </div>

              {/* Exercise Widget */}
              <div className="card" style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(81, 207, 102, 0.15)", display: "flex", justifyContent: "center", alignItems: "center", color: "#51cf66" }}>
                    <Flame size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "var(--color-text-3)" }}>Exercise Burned</div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{exerciseBurned} <span style={{ fontSize: 12, fontWeight: 400 }}>cal</span></div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "var(--color-text-3)" }}>Tracked workouts</div>
              </div>

              {/* Water Widget */}
              <div className="card" style={{ padding: 20, gridColumn: "span 2" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(0, 242, 254, 0.15)", display: "flex", justifyContent: "center", alignItems: "center", color: "var(--aura-accent, #00f2fe)" }}>
                      <Droplet size={20} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--color-text-3)" }}>Water Intake</div>
                      <div style={{ fontSize: 18, fontWeight: 800 }}>{todayWater} <span style={{ fontSize: 12, fontWeight: 400, color: "var(--color-text-3)" }}>/ {targets.water} ml</span></div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => handleAddWater(250)} className="btn-secondary" style={{ padding: "6px 14px", fontSize: 12 }}>+250ml</button>
                    <button onClick={() => handleAddWater(500)} className="btn-secondary" style={{ padding: "6px 14px", fontSize: 12 }}>+500ml</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: WEEKLY REPORT & DAYS ARCHIVE                       */}
        {/* ========================================================= */}
        {activeTab === "report" && (
          <WeeklyReportView
            targets={targets}
            history={history}
            onSelectDate={(dateStr) => {
              setSelectedDate(dateStr);
              setActiveTab("diary");
            }}
          />
        )}

        {/* ========================================================= */}
        {/* TAB 4: AI & LOGGING TOOLS HUB                             */}
        {/* ========================================================= */}
        {activeTab === "ai_tools" && (
          <div>
            {/* Featured AI Vision Meal Scanner Card */}
            <div
              className="card"
              style={{
                padding: 24,
                marginBottom: 20,
                background: "color-mix(in srgb, var(--aura-accent) 12%, var(--bg-card))",
                border: "1px solid var(--border-card)",
                borderRadius: 20,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  background: "var(--aura-accent)",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  color: "var(--color-on-accent)",
                  boxShadow: "0 4px 15px color-mix(in srgb, var(--aura-accent) 30%, transparent)"
                }}>
                  <Camera size={26} />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 900, margin: 0, color: "var(--color-text)" }}>AI Vision Photo Meal Scanner</h3>
                  <p style={{ fontSize: 13, color: "var(--color-text-2)", margin: "4px 0 0" }}>
                    Snap or upload a photo of your plate for instant food & macro detection
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal('vision')}
                style={{
                  padding: "12px 22px",
                  borderRadius: 14,
                  background: "var(--aura-accent)",
                  color: "var(--color-on-accent)",
                  fontWeight: 800,
                  fontSize: 14,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  whiteSpace: "nowrap"
                }}
              >
                <Camera size={18} /> Open Photo Scan
              </button>
            </div>

            {/* AI Natural Language Text Scanner Card with Obligatory Category Selector */}
            <div className="card" style={{ padding: 24, marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", gap: 8, marginBottom: 12, color: "var(--color-text)" }}>
                <Brain size={20} color="var(--aura-accent)" /> AI Meal Text Assistant
              </h2>

              {/* Obligatory Meal Category Pills */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--aura-accent)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6, display: "block" }}>
                  Select Meal Section (Obligatory)
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["Breakfast", "Lunch", "Dinner", "Snacks"].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setTargetCategory(cat)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 700,
                        border: "1px solid var(--color-border)",
                        cursor: "pointer",
                        background: targetCategory === cat ? "var(--aura-accent)" : "var(--color-surface)",
                        color: targetCategory === cat ? "var(--color-on-accent)" : "var(--color-text-2)",
                        transition: "all 0.2s ease"
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <input
                  type="text"
                  className="themed-input"
                  placeholder={`Describe a meal for ${targetCategory} (e.g. 2 eggs and toast)...`}
                  style={{ flex: 1 }}
                  value={scanText}
                  onChange={(e) => setScanText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleScanText(); }}
                />
                <button
                  onClick={handleScanText}
                  disabled={scanningText}
                  className="themed-input"
                  style={{
                    width: "auto",
                    background: "linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)",
                    color: "#000",
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    cursor: "pointer",
                    border: "none",
                    opacity: scanningText ? 0.7 : 1
                  }}
                >
                  <Sparkles size={16} /> {scanningText ? "Analyzing..." : "Ask AI"}
                </button>
              </div>
            </div>

            {/* Quick Actions Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              <button onClick={() => openFoodSearch('Breakfast')} className="action-card">
                <Search size={24} color="var(--aura-accent, #00f2fe)" />
                <span>Food Search</span>
              </button>
              <button onClick={() => setActiveModal('vision')} className="action-card" style={{ border: "1px solid rgba(0,242,254,0.4)" }}>
                <Camera size={24} color="var(--aura-accent, #00f2fe)" />
                <span>Meal Photo Scan</span>
              </button>
              <button onClick={() => setActiveModal('recipe')} className="action-card">
                <Utensils size={24} color="var(--aura-accent2)" />
                <span>Recipe Builder</span>
              </button>
              <button onClick={() => setActiveModal('custom')} className="action-card">
                <Clipboard size={24} color="var(--aura-accent4)" />
                <span>Custom Food</span>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── MODALS ── */}
      {activeModal === 'search' && (
        <FoodSearchModal
          initialCategory={targetCategory}
          targetDate={selectedDate}
          onClose={() => setActiveModal(null)}
          onLog={() => refreshData(selectedDate)}
          onSwitchToCustom={() => setActiveModal('custom')}
        />
      )}
      {activeModal === 'quick' && (
        <QuickAddModal
          initialCategory={targetCategory}
          targetDate={selectedDate}
          onClose={() => setActiveModal(null)}
          onLog={() => refreshData(selectedDate)}
        />
      )}
      {activeModal === 'recipe' && (
        <RecipeBuilderModal
          onClose={() => setActiveModal(null)}
          onSave={() => refreshData(selectedDate)}
        />
      )}
      {activeModal === 'custom' && (
        <CustomFoodModal
          onClose={() => setActiveModal(null)}
          onSave={() => refreshData(selectedDate)}
        />
      )}
      {activeModal === 'vision' && (
        <MealScanModal
          initialCategory={targetCategory}
          targetDate={selectedDate}
          onClose={() => setActiveModal(null)}
          onLog={() => refreshData(selectedDate)}
        />
      )}
      {activeModal === 'calculator' && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: 16
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 720,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#0d1117",
              borderRadius: 24,
              border: "1px solid var(--aura-accent, #00f2fe)",
              padding: 24,
              boxShadow: "0 20px 50px rgba(0,0,0,0.8)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
              <button
                onClick={() => setActiveModal(null)}
                style={{ background: "none", border: "none", color: "#aaa", fontSize: 20, cursor: "pointer", fontWeight: 800 }}
              >
                ✕
              </button>
            </div>
            <NutritionCalculator
              onSaveSuccess={() => {
                fetchTargets();
                refreshData(selectedDate);
                setActiveModal(null);
              }}
            />
          </div>
        </div>
      )}
      {activeModal === 'edit_goals' && (
        <EditGoalsModal
          currentTargets={targets}
          onClose={() => setActiveModal(null)}
          onSave={(newTargets) => setTargets(newTargets)}
        />
      )}

      {/* ── STYLES ── */}
      <style>{`
        .tab-btn {
          flex: 1;
          padding: 10px 14px;
          border-radius: 12px;
          border: none;
          background: transparent;
          color: var(--color-text-3);
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .tab-btn.active {
          background: var(--aura-accent, #00f2fe);
          color: #000;
          box-shadow: 0 2px 10px rgba(0, 242, 254, 0.3);
        }
        .date-nav-btn {
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--color-border);
          color: var(--color-text);
          padding: 6px 12px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          display: flex;
          alignItems: center;
          gap: 4px;
          cursor: pointer;
        }
        .date-nav-btn:hover {
          background: rgba(255,255,255,0.1);
        }
        .action-card {
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          padding: 20px;
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .action-card:hover {
          transform: translateY(-4px);
          border-color: var(--aura-accent, #00f2fe);
          background: rgba(255,255,255,0.02);
        }
        .action-card span {
          font-size: 13px;
          font-weight: 700;
          color: var(--color-text);
        }
        .macro-badge {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: rgba(255,255,255,0.04);
          padding: 12px;
          border-radius: 12px;
          gap: 4px;
        }
      `}</style>
    </div>
  );
}
