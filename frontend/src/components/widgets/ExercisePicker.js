import React, { useState, useEffect } from "react";
import { Search, ChevronLeft, LayoutGrid, Target, Dumbbell } from "lucide-react";
import { api } from "../../utils/api";
import { resolveBackendUrl } from "../../utils/config";

const CATEGORY_COLORS = {
  chest: "#f43f5e", back: "#3b82f6", "upper legs": "#10b981", shoulders: "#f59e0b",
  "upper arms": "#a78bfa", waist: "#06b6d4", "lower legs": "#84cc16", cardio: "#f97316",
  "lower arms": "#8b5cf6", neck: "#ec4899",
};

const BODY_PARTS = [
  { name: "chest", icon: "胸" },
  { name: "back", icon: "背" },
  { name: "shoulders", icon: "肩" },
  { name: "upper arms", icon: "腕" },
  { name: "lower arms", icon: "前" },
  { name: "waist", icon: "腹" },
  { name: "upper legs", icon: "脚" },
  { name: "lower legs", icon: "脹" },
  { name: "cardio", icon: "心" },
  { name: "neck", icon: "首" }
];

export default function ExercisePicker({ value, onChange, onSelect, onClose, isInline = false }) {
  const isModalMode = typeof onSelect === "function";

  const [isOpen, setIsOpen] = useState(isModalMode || isInline);
  const [search, setSearch] = useState("");
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEx, setSelectedEx] = useState(null);
  const [view, setView] = useState("categories");
  const [selectedCategory, setSelectedCategory] = useState(null);

  const handleClose = () => {
    if (isModalMode) { onClose?.(); }
    else { setIsOpen(false); }
  };

  useEffect(() => {
    if (isOpen && exercises.length === 0) {
      setLoading(true);
      api.getExercises({ limit: 2000 })
        .then(setExercises)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [isOpen, exercises.length]);

  useEffect(() => {
    if (value) {
      const ex = exercises.find(e => e.id === value);
      if (ex) setSelectedEx(ex);
    } else {
      setSelectedEx(null);
    }
  }, [value, exercises]);

  const filtered = exercises.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory ? (e.category === selectedCategory || e.body_part_name === selectedCategory) : true;
    return matchesSearch && matchesCategory;
  });

  const handleSelect = (ex) => {
    if (isModalMode) {
      onSelect(ex);
    } else {
      onChange?.(ex.id);
      setSelectedEx(ex);
      setIsOpen(false);
    }
  };

  const handleCategorySelect = (cat) => {
    setSelectedCategory(cat);
    setView("list");
  };

  const PickerContent = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexShrink: 0 }}>
        {view === "list" && (
          <button 
            onClick={() => { setView("categories"); setSelectedCategory(null); setSearch(""); }}
            style={{ background: "var(--bg-input)", border: "1px solid var(--border-input)", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-primary)", flexShrink: 0 }}
          >
            <ChevronLeft size={16} />
          </button>
        )}
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
          {view === "categories" ? "Select Muscle Group" : (selectedCategory ? selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1) : "Search Results")}
        </h2>
        {!isInline && (
          <button onClick={handleClose} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 20, color: "var(--text-muted)", cursor: "pointer", lineHeight: 1 }}>&times;</button>
        )}
      </div>

      {/* Search Bar */}
      <div style={{ position: "relative", marginBottom: 12, flexShrink: 0 }}>
        <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-3)" }}>
          <Search size={15} strokeWidth={2} />
        </div>
        <input
          autoFocus
          placeholder="Quick search by name..."
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            if (e.target.value && view === "categories") setView("list");
            if (!e.target.value && !selectedCategory) setView("categories");
          }}
          style={{
            width: "100%", padding: "10px 10px 10px 36px",
            background: "var(--bg-input)", border: "1.5px solid var(--border-input)",
            borderRadius: 10, color: "var(--text-primary)", fontSize: 13, outline: "none",
            transition: "all 0.2s"
          }}
          onFocus={e => e.target.style.borderColor = "var(--aura-accent)"}
          onBlur={e => e.target.style.borderColor = "var(--border-input)"}
        />
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 20 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--color-text-3)", padding: 60 }}>
             <div className="spinner" style={{ margin: "0 auto 12px" }} />
             <span>Accessing exercise database...</span>
          </div>
        ) : view === "categories" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {BODY_PARTS.map(cat => {
              const color = CATEGORY_COLORS[cat.name] || "#00BCD4";
              return (
                <button
                  key={cat.name}
                  onClick={() => handleCategorySelect(cat.name)}
                  style={{
                    display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "flex-start",
                    gap: 12, padding: "12px 14px", borderRadius: 12, border: "1.5px solid var(--border-card)",
                    background: "var(--bg-card)", cursor: "pointer", transition: "all 0.2s",
                    position: "relative", overflow: "hidden", textAlign: "left"
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = color;
                    e.currentTarget.style.background = `color-mix(in srgb, ${color} 5%, var(--bg-card))`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = "var(--border-card)";
                    e.currentTarget.style.background = "var(--bg-card)";
                  }}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    background: `color-mix(in srgb, ${color} 12%, transparent)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: color
                  }}>
                    {cat.name === 'cardio' ? <Target size={20} /> : <Dumbbell size={20} />}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, textTransform: "capitalize", color: "var(--text-primary)" }}>{cat.name}</span>
                </button>
              );
            })}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--color-text-3)", padding: 60 }}>
            <LayoutGrid size={48} style={{ opacity: 0.1, marginBottom: 12 }} />
            <p>No matching exercises found.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map(ex => {
              const color = CATEGORY_COLORS[ex.category] || "#00BCD4";
              return (
                <button
                  key={ex.id}
                  onClick={() => handleSelect(ex)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 14,
                    padding: "12px", border: "1.5px solid var(--border-card)",
                    borderRadius: 14, background: "var(--bg-card)", 
                    cursor: "pointer", textAlign: "left", transition: "all 0.2s"
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = "var(--aura-accent)";
                    e.currentTarget.style.background = "var(--bg-card-hover)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = "var(--border-card)";
                    e.currentTarget.style.background = "var(--bg-card)";
                  }}
                >
                  {ex.image_url ? (
                    <img
                      src={resolveBackendUrl(ex.image_url)} alt={ex.name} loading="lazy"
                      style={{ width: 52, height: 52, borderRadius: 10, objectFit: "cover", flexShrink: 0, background: "var(--bg-input)" }}
                      onError={e => e.target.style.display = "none"}
                    />
                  ) : (
                    <div style={{
                      width: 52, height: 52, borderRadius: 10, flexShrink: 0,
                      background: `color-mix(in srgb,${color} 20%,transparent)`,
                      display: "flex", justifyContent: "center", alignItems: "center",
                      fontSize: 14, fontWeight: 700, color: color
                    }}>
                      {ex.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ex.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-text-3)", marginTop: 2, display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ textTransform: "capitalize", color: color, fontWeight: 600 }}>{ex.category}</span>
                      {ex.equipment && <span>· {ex.equipment}</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      {!isInline && (
        <div style={{ paddingTop: 10, borderTop: "1px solid var(--border-card)", flexShrink: 0 }}>
           <button
            onClick={handleClose}
            style={{
              width: "100%", padding: "10px", borderRadius: 10, border: "none",
              background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13,
              fontWeight: 600, cursor: "pointer", transition: "all 0.2s"
            }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--border-input)"}
            onMouseLeave={e => e.currentTarget.style.background = "var(--bg-input)"}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );

  if (!isOpen) {
    return !isModalMode && !isInline ? (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          background: "var(--bg-input)", border: "1px solid var(--border-input)",
          borderRadius: 12, padding: "12px 16px", color: "var(--text-primary)", width: "100%",
          textAlign: "left", cursor: "pointer", fontSize: 14, marginBottom: 16
        }}
      >
        {selectedEx ? selectedEx.name : "Select an exercise..."}
      </button>
    ) : null;
  }

  if (isInline) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 400 }}>
        {PickerContent}
      </div>
    );
  }

  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, backdropFilter: "blur(2px)" }}
        onClick={handleClose}
      />
      <div
        style={{
          background: "var(--bg-secondary)",
          borderRadius: 16,
          position: "fixed",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 340, height: 480,
          padding: "14px 14px 10px",
          display: "flex", flexDirection: "column", zIndex: 1001,
          border: "1.5px solid var(--border-card)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.55)"
        }}
      >
        {PickerContent}
      </div>
    </>
  );
}
