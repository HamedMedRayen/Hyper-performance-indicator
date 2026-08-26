import React, { useState, useEffect } from "react";
import { api } from "../../utils/api";
import { Search, Filter, ChevronDown, ChevronUp, PlayCircle } from "lucide-react";
import "../styles/mobile.css";
import { resolveBackendUrl } from "../../utils/config";

const CATEGORY_COLORS = {
  chest: "#f43f5e", back: "#3b82f6", "upper legs": "#10b981", shoulders: "#f59e0b",
  "upper arms": "#a78bfa", waist: "#06b6d4", "lower legs": "#84cc16", cardio: "#f97316",
  "lower arms": "#8b5cf6", neck: "#ec4899",
};

const EQUIPMENT_CHIPS = ["All", "barbell", "dumbbell", "cable", "body weight", "machine", "band"];
const BODY_PART_CHIPS = ["All", "chest", "back", "shoulders", "upper arms", "lower arms", "waist", "upper legs", "lower legs", "cardio"];

function MobileExerciseRow({ ex, isExpanded, onExpand, onCollapse }) {
  const color = CATEGORY_COLORS[ex.category] || "var(--aura-accent)";
  const categoryLabel = ex.category || ex.body_part_name || "Exercise";

  let steps = [];
  try {
    if (ex.instruction_steps) {
      steps = typeof ex.instruction_steps === "string" ? JSON.parse(ex.instruction_steps) : ex.instruction_steps;
    } else if (ex.instructions) {
      const parsed = typeof ex.instructions === "string" ? JSON.parse(ex.instructions) : ex.instructions;
      if (Array.isArray(parsed)) steps = parsed;
    }
  } catch (e) { /* silent */ }

  return (
    <div className="mobile-card" style={{ marginBottom: 12, overflow: "hidden", padding: 0 }}>
      <div 
        onClick={() => isExpanded ? onCollapse() : onExpand()}
        style={{ 
          display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer",
          borderBottom: isExpanded ? "1px solid var(--color-border)" : "none"
        }}
      >
        {ex.image_url ? (
          <img src={resolveBackendUrl(ex.image_url)} alt={ex.name} loading="lazy" style={{ width: 50, height: 50, borderRadius: 12, objectFit: "cover", background: "rgba(255,255,255,0.05)" }} />
        ) : (
          <div style={{ width: 50, height: 50, borderRadius: 12, background: `color-mix(in srgb, ${color} 15%, transparent)`, color: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800 }}>
            {ex.name.substring(0, 2).toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ex.name}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color, textTransform: "capitalize" }}>{categoryLabel}</span>
            {ex.equipment && <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>• {ex.equipment}</span>}
          </div>
        </div>
        <div>
          {isExpanded ? <ChevronUp size={20} color="var(--text-secondary)" /> : <ChevronDown size={20} color="var(--text-secondary)" />}
        </div>
      </div>

      {isExpanded && (
        <div style={{ padding: "16px", background: "rgba(0,0,0,0.02)" }}>
          {(ex.gif_url || ex.image_url) && (
            <div style={{ width: "100%", borderRadius: 12, overflow: "hidden", marginBottom: 16, background: "#000", display: "flex", justifyContent: "center" }}>
              <img src={resolveBackendUrl(ex.gif_url || ex.image_url)} alt={ex.name} style={{ width: "100%", maxWidth: 300, objectFit: "cover" }} />
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {ex.target && <span style={{ padding: "4px 10px", borderRadius: 20, background: "rgba(255,255,255,0.05)", border: "1px solid var(--color-border)", fontSize: 11, color: "var(--text-primary)", textTransform: "capitalize" }}>Target: {ex.target}</span>}
            {ex.muscle_group && <span style={{ padding: "4px 10px", borderRadius: 20, background: "rgba(255,255,255,0.05)", border: "1px solid var(--color-border)", fontSize: 11, color: "var(--text-primary)", textTransform: "capitalize" }}>Group: {ex.muscle_group}</span>}
          </div>

          {steps.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Instructions</div>
              <ol style={{ paddingLeft: 18, margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                {steps.map((step, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>{step}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MobileExercises() {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [equipment, setEquipment] = useState("All");
  const [bodyPart, setBodyPart] = useState("All");
  const [expandedIdx, setExpandedIdx] = useState(null);

  useEffect(() => {
    setLoading(true);
    setExpandedIdx(null);
    const filters = { limit: 2000 };
    if (search.trim()) filters.search = search.trim();
    if (equipment !== "All") filters.equipment = equipment;
    if (bodyPart !== "All") filters.body_part = bodyPart;

    api.getExercises(filters)
      .then(setExercises)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search, equipment, bodyPart]);

  return (
    <div className="mobile-page" style={{ paddingBottom: 120 }}>
      {/* ── Sticky Header ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--color-bg)", paddingTop: 16, paddingBottom: 12, margin: "0 -20px", paddingLeft: 20, paddingRight: 20 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.5px", margin: "0 0 16px 0" }}>
          Library
        </h1>
        
        {/* Search Bar */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <Search size={18} color="var(--text-secondary)" style={{ position: "absolute", left: 14, top: 14 }} />
          <input 
            type="text"
            placeholder="Search exercises..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", height: 46, borderRadius: 23, background: "var(--bg-input)", border: "1px solid var(--border-input)",
              paddingLeft: 42, paddingRight: 16, fontSize: 15, color: "var(--text-primary)", outline: "none"
            }}
          />
        </div>

        {/* Filter Chips - Body Part */}
        <div className="mobile-horizontal-scroll" style={{ margin: "0 -20px 8px -20px", padding: "0 20px" }}>
          {BODY_PART_CHIPS.map(chip => (
            <button 
              key={chip} 
              onClick={() => setBodyPart(chip)}
              style={{
                flexShrink: 0, padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600, textTransform: "capitalize",
                background: bodyPart === chip ? "var(--aura-accent)" : "rgba(255,255,255,0.05)",
                color: bodyPart === chip ? "#fff" : "var(--text-primary)",
                border: bodyPart === chip ? "none" : "1px solid var(--color-border)",
                marginRight: 8
              }}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Filter Chips - Equipment */}
        <div className="mobile-horizontal-scroll" style={{ margin: "0 -20px", padding: "0 20px" }}>
          {EQUIPMENT_CHIPS.map(chip => (
            <button 
              key={chip} 
              onClick={() => setEquipment(chip)}
              style={{
                flexShrink: 0, padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600, textTransform: "capitalize",
                background: equipment === chip ? "var(--aura-purple)" : "rgba(255,255,255,0.05)",
                color: equipment === chip ? "#fff" : "var(--text-primary)",
                border: equipment === chip ? "none" : "1px solid var(--color-border)",
                marginRight: 8
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* ── Results List ── */}
      <div style={{ marginTop: 12 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--text-secondary)", padding: 40 }}>Loading...</div>
        ) : exercises.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-secondary)", padding: 40 }}>No exercises found.</div>
        ) : (
          exercises.map((ex, idx) => (
            <MobileExerciseRow 
              key={ex.id} 
              ex={ex} 
              isExpanded={expandedIdx === idx}
              onExpand={() => setExpandedIdx(idx)}
              onCollapse={() => setExpandedIdx(null)}
            />
          ))
        )}
      </div>
    </div>
  );
}
