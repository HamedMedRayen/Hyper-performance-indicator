import React, { useState, useEffect } from "react";
import Header from "../components/layout/Header";
import BodyMap from "../components/cards/BodyMap";
import { api } from "../utils/api";
import { Search, Filter, ChevronUp, ChevronDown } from "lucide-react";
import { resolveBackendUrl } from "../utils/config";

const CATEGORY_COLORS = {
  chest: "#f43f5e", back: "#3b82f6", "upper legs": "#10b981", shoulders: "#f59e0b",
  "upper arms": "#a78bfa", waist: "#06b6d4", "lower legs": "#84cc16", cardio: "#f97316",
  "lower arms": "#8b5cf6", neck: "#ec4899",
};

const EQUIPMENT_CHIPS = [
  "All", "barbell", "dumbbell", "cable", "body weight",
  "kettlebell", "resistance band", "smith machine", "leverage machine",
];

/* ── Detail Card ──────────────────────────────────────────── */
function ExerciseDetailCard({ ex, onClose }) {
  const [showInstructions, setShowInstructions] = useState(false);
  let steps = [];
  try {
    if (ex.instruction_steps) {
      steps = typeof ex.instruction_steps === "string"
        ? JSON.parse(ex.instruction_steps) : ex.instruction_steps;
    }
  } catch (e) { /* silent */ }
  if (steps.length === 0 && ex.instructions) {
    try {
      const parsed = typeof ex.instructions === "string" ? JSON.parse(ex.instructions) : ex.instructions;
      if (Array.isArray(parsed)) steps = parsed;
    } catch (e) { /* not array */ }
  }

  const color = CATEGORY_COLORS[ex.category] || "#00BCD4";

  return (
    <div style={{
      background: "var(--color-surface)",
      borderRadius: 16, padding: 24, marginTop: 12, marginBottom: 20,
      border: "1px solid var(--color-border)",
      boxShadow: "var(--shadow-card)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "var(--color-text)", marginBottom: 6, lineHeight: 1.2 }}>
            {ex.name}
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-2)", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {ex.category && <span style={{ textTransform: "capitalize" }}>{ex.category}</span>}
            {ex.muscle_group && <span>· {ex.muscle_group}</span>}
            {ex.equipment && <span>· {ex.equipment}</span>}
          </div>
        </div>
        <button onClick={onClose} style={{
          background: "var(--color-surface)", border: "none", fontSize: 16, cursor: "pointer",
          color: "var(--color-text-3)", padding: "4px 8px", borderRadius: 8,
          transition: "background 0.15s",
        }}
          onMouseEnter={e => e.currentTarget.style.background = "var(--color-surface-h)"}
          onMouseLeave={e => e.currentTarget.style.background = "var(--color-surface)"}
        >×</button>
      </div>

      {/* Muscle tags */}
      {(ex.target || ex.muscle_group) && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {ex.target && (
            <span style={{
              background: "color-mix(in srgb, var(--aura-accent) 12%, transparent)", color: "var(--aura-accent)",
              borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 500,
              textTransform: "capitalize",
            }}>{ex.target}</span>
          )}
          {ex.muscle_group && ex.muscle_group !== ex.target && (
            <span style={{
              background: "color-mix(in srgb, var(--aura-accent) 12%, transparent)", color: "var(--aura-accent)",
              borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 500,
              textTransform: "capitalize",
            }}>{ex.muscle_group}</span>
          )}
          {ex.equipment && (
            <span style={{
              background: "var(--bg-input)", color: "var(--color-text-2)",
              borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 500,
              textTransform: "capitalize",
            }}>{ex.equipment}</span>
          )}
        </div>
      )}

      {/* GIF / Image */}
      <div style={{
        borderRadius: 14, overflow: "hidden",
        background: "var(--color-bg-hover)",
        display: "flex", justifyContent: "center", alignItems: "center",
        marginBottom: 16, minHeight: 280,
      }}>
        {ex.gif_url ? (
          <img src={resolveBackendUrl(ex.gif_url)} alt={ex.name} loading="lazy"
            style={{ width: "100%", maxWidth: 340, borderRadius: 14, objectFit: "cover" }}
            onError={e => e.target.style.display = "none"} />
        ) : ex.image_url ? (
          <img src={resolveBackendUrl(ex.image_url)} alt={ex.name} loading="lazy"
            style={{ width: "100%", maxWidth: 340, borderRadius: 14, objectFit: "cover" }}
            onError={e => e.target.style.display = "none"} />
        ) : (
          <div style={{
            width: 280, height: 280, borderRadius: 14,
            background: `color-mix(in srgb,${color} 20%,transparent)`,
            display: "flex", justifyContent: "center", alignItems: "center",
            fontSize: 48, fontWeight: 700, color: color,
          }}>{ex.name.slice(0, 2).toUpperCase()}</div>
        )}
      </div>

      {/* Instructions Accordion */}
      {steps.length > 0 && (
        <div>
          <button onClick={() => setShowInstructions(!showInstructions)}
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 10,
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              color: "var(--aura-accent)", cursor: "pointer", fontSize: 13, fontWeight: 600,
              display: "flex", justifyContent: "space-between", alignItems: "center",
              transition: "all 0.2s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--color-surface-h)"}
            onMouseLeave={e => e.currentTarget.style.background = "var(--color-surface)"}
          >
            <span>How to perform</span>
            {showInstructions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <div style={{
            maxHeight: showInstructions ? 600 : 0,
            overflow: "hidden",
            transition: "max-height 0.35s ease",
          }}>
            <div style={{
              marginTop: 10, padding: 14,
              background: "color-mix(in srgb, var(--aura-accent) 6%, transparent)",
              borderRadius: 10, fontSize: 13,
              color: "var(--color-text-2)", lineHeight: 1.7,
            }}>
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                {steps.map((step, idx) => (
                  <li key={idx} style={{ marginBottom: 6 }}>{step}</li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Exercise Row ─────────────────────────────────────────── */
function ExerciseRow({ ex, isExpanded, onExpand, onCollapse }) {
  const color = CATEGORY_COLORS[ex.category] || "#00BCD4";
  const categoryLabel = ex.category || ex.body_part_name || "";

  return (
    <div>
      <button onClick={() => isExpanded ? onCollapse() : onExpand()}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 12,
          padding: "12px 10px",
          border: "1px solid var(--color-border)",
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-surface)", cursor: "pointer", textAlign: "left",
          transition: "all 0.2s ease", borderRadius: 10,
          boxShadow: "var(--shadow-card)", marginBottom: 6,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = "var(--color-surface-h)";
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 4px 20px color-mix(in srgb, var(--aura-accent) 15%, transparent)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = "var(--color-surface)";
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        {ex.image_url ? (
          <img src={resolveBackendUrl(ex.image_url)} alt={ex.name} loading="lazy"
            style={{
              width: 48, height: 48, borderRadius: 10, objectFit: "cover",
              flexShrink: 0, background: "var(--color-bg-hover)"
            }}
            onError={e => e.target.style.display = "none"} />
        ) : (
          <div style={{
            width: 48, height: 48, borderRadius: 10,
            background: `color-mix(in srgb,${color} 25%,transparent)`,
            flexShrink: 0, display: "flex", justifyContent: "center", alignItems: "center",
            fontSize: 12, fontWeight: 700, color: color
          }}>
            {ex.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 500, color: "var(--color-text)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
          }}>
            {ex.name}
          </div>
          <div style={{ fontSize: 11, color: "var(--color-text-3)", marginTop: 2, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {ex.target && <span style={{
              textTransform: "capitalize",
              background: "color-mix(in srgb, var(--aura-accent) 12%, transparent)", color: "var(--aura-accent)",
              borderRadius: 999, padding: "1px 8px", fontSize: 10
            }}>{ex.target}</span>}
            {ex.equipment && <span style={{ opacity: 0.7 }}>· {ex.equipment}</span>}
          </div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999,
          background: `color-mix(in srgb,${color} 12%,transparent)`,
          color: color, flexShrink: 0, textTransform: "capitalize",
        }}>{categoryLabel}</span>
      </button>
      {isExpanded && <ExerciseDetailCard ex={ex} onClose={onCollapse} />}
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────── */
export default function Exercises() {
  const [exercises, setExercises] = useState([]);
  const [selected, setSelected] = useState(null);
  const [equipment, setEquipment] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [visibleCount, setVisibleCount] = useState(40);

  useEffect(() => {
    setLoading(true);
    setExpandedIdx(null);
    setVisibleCount(40);
    const filters = {};
    if (selected) filters.body_part = selected;
    if (equipment && equipment !== "All") filters.equipment = equipment;
    if (search.trim()) filters.search = search.trim();
    filters.limit = 2000;
    api.getExercises(filters)
      .then(data => {
        setExercises(Array.isArray(data) ? data : (data.exercises || []));
      })
      .catch(() => {
        setExercises([]);
      })
      .finally(() => setLoading(false));
  }, [selected, equipment, search]);

  const hasActiveFilters = Boolean(selected || (equipment && equipment !== "All") || search.trim());

  const handleClearFilters = () => {
    setSelected(null);
    setEquipment("All");
    setSearch("");
  };

  const glassCard = {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: 16,
    boxShadow: "var(--shadow-card)",
  };

  const displayedExercises = exercises.slice(0, visibleCount);

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 100 }}>
      <Header
        title="Exercises"
        subtitle={
          loading
            ? "Loading exercises library..."
            : hasActiveFilters
            ? `${exercises.length} exercise${exercises.length === 1 ? "" : "s"} found${selected ? ` for ${selected}` : ""}${equipment !== "All" ? ` (${equipment})` : ""}`
            : `${exercises.length.toLocaleString()} exercises available`
        }
      />
      <div className="page-inner">

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 16 }}>
          <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-3)" }}>
            <Search size={15} strokeWidth={1.8} />
          </div>
          <input
            style={{
              width: "100%", paddingLeft: 38, padding: "10px 14px 10px 38px",
              background: "var(--bg-input)",
              border: "1px solid var(--border-input)",
              borderRadius: 10, color: "var(--color-text)", fontSize: 14,
              fontFamily: "inherit", outline: "none",
              transition: "border-color 0.15s",
            }}
            placeholder="Search exercises by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={e => e.target.style.borderColor = "var(--aura-accent)"}
            onBlur={e => e.target.style.borderColor = "var(--border-input)"}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", color: "var(--color-text-3)",
                cursor: "pointer", fontSize: 14, padding: 4
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Equipment filter chips */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18, padding: "6px 0", alignItems: "center" }}>
          <Filter size={14} strokeWidth={1.8} style={{ color: "var(--color-text-3)", marginRight: 4 }} />
          {EQUIPMENT_CHIPS.map(chip => (
            <button key={chip} onClick={() => setEquipment(chip)}
              style={{
                padding: "5px 14px", borderRadius: 999, border: "none",
                fontSize: 12, fontWeight: 500, cursor: "pointer",
                transition: "all 0.2s", textTransform: "capitalize",
                background: equipment === chip ? "var(--aura-accent)" : "var(--bg-input)",
                color: equipment === chip ? "var(--color-on-accent)" : "var(--color-text-2)",
              }}>{chip}</button>
          ))}
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              style={{
                marginLeft: "auto", padding: "4px 12px", borderRadius: 999,
                border: "1px dashed var(--color-border)", background: "transparent",
                color: "var(--aura-accent)", fontSize: 12, fontWeight: 600, cursor: "pointer",
                transition: "all 0.15s"
              }}
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Layout: Body Map + Exercise List */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 20, marginBottom: 20 }}
          className="responsive-layout">
          {/* Body Map */}
          <div style={{ ...glassCard, padding: 16, height: "fit-content" }}>
            <BodyMap selected={selected} onSelect={setSelected} />
          </div>

          {/* Exercise List */}
          <div style={{ ...glassCard, padding: 20 }}>
            <div style={{
              fontSize: 14, fontWeight: 600, color: "var(--color-text)",
              marginBottom: 16, paddingBottom: 12,
              borderBottom: "1px solid var(--color-border)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span>
                Exercises {selected && `— ${selected}`}
                {equipment !== "All" && ` · ${equipment}`}
              </span>
              <span style={{ fontSize: 12, fontWeight: 400, color: "var(--color-text-3)" }}>
                {exercises.length.toLocaleString()} result{exercises.length === 1 ? "" : "s"}
              </span>
            </div>

            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
                <div className="spinner" />
              </div>
            ) : exercises.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--color-text-3)", padding: 40 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No exercises found</div>
                <div style={{ fontSize: 13, color: "var(--color-text-3)", marginBottom: 16 }}>Try clearing your filters or search terms.</div>
                {hasActiveFilters && (
                  <button
                    onClick={handleClearFilters}
                    style={{
                      padding: "8px 18px", borderRadius: 8, background: "var(--aura-accent)",
                      color: "var(--color-on-accent)", border: "none", fontWeight: 600, cursor: "pointer"
                    }}
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            ) : (
              <>
                {displayedExercises.map((ex, idx) => (
                  <ExerciseRow key={ex.id} ex={ex}
                    isExpanded={expandedIdx === idx}
                    onExpand={() => setExpandedIdx(idx)}
                    onCollapse={() => setExpandedIdx(null)} />
                ))}

                {visibleCount < exercises.length && (
                  <div style={{ textAlign: "center", marginTop: 20 }}>
                    <button
                      onClick={() => setVisibleCount(prev => prev + 50)}
                      style={{
                        padding: "10px 24px", borderRadius: 10,
                        background: "var(--bg-input)", border: "1px solid var(--border-input)",
                        color: "var(--color-text)", fontSize: 13, fontWeight: 600,
                        cursor: "pointer", transition: "all 0.2s"
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = "var(--aura-accent)"}
                      onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border-input)"}
                    >
                      Show More ({exercises.length - visibleCount} remaining)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .responsive-layout { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
