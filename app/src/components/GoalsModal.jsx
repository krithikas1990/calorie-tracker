import React, { useState } from "react";
import { X } from "lucide-react";
import { MACRO_COLORS, INK, PAPER, MUTED } from "../theme.js";

export function GoalsModal({ goals, onSave, onClose, onResetToday, foodDictionary = [], onRemoveFood, onDeleteAll }) {
  const [draft, setDraft] = useState(goals);

  const field = (key, label, unit) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: MUTED, marginBottom: 4 }}>
        {label.toUpperCase()} {unit ? `(${unit})` : ""}
      </label>
      <input
        type="number"
        min="0"
        value={draft[key]}
        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value === "" ? "" : Number(e.target.value) }))}
        style={{ width: "100%", border: `2px solid ${INK}`, padding: "8px 10px", fontSize: 15, fontWeight: 700, fontFamily: "'Archivo', sans-serif", background: PAPER, color: INK, boxSizing: "border-box" }}
      />
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(26,26,26,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
      <div style={{ background: PAPER, border: `3px solid ${INK}`, borderBottom: "none", width: "100%", maxWidth: 420, padding: 20, maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 20, color: INK }}>Daily Goals</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: INK }}>
            <X size={20} />
          </button>
        </div>
        {field("calories", "Calories", "kcal")}
        {field("protein", "Protein", "g")}
        {field("carbs", "Carbs", "g")}
        {field("fat", "Fat", "g")}
        {field("fiber", "Fiber", "g")}

        <button
          onClick={() => onSave({ ...draft, calories: Number(draft.calories) || 0, protein: Number(draft.protein) || 0, carbs: Number(draft.carbs) || 0, fat: Number(draft.fat) || 0, fiber: Number(draft.fiber) || 0 })}
          style={{ width: "100%", background: INK, color: PAPER, border: "none", padding: "12px 0", fontWeight: 800, fontSize: 13, letterSpacing: 1, cursor: "pointer", fontFamily: "'Archivo', sans-serif", marginTop: 6 }}
        >
          SAVE GOALS
        </button>
        <button
          onClick={onResetToday}
          style={{ width: "100%", background: "none", color: MACRO_COLORS.protein, border: `1px solid ${MACRO_COLORS.protein}`, padding: "10px 0", fontWeight: 700, fontSize: 12, letterSpacing: 0.5, cursor: "pointer", fontFamily: "'Archivo', sans-serif", marginTop: 10 }}
        >
          CLEAR TODAY'S MEALS
        </button>
        <button
          onClick={onDeleteAll}
          style={{ width: "100%", background: "none", color: MACRO_COLORS.protein, border: `1px solid ${MACRO_COLORS.protein}`, padding: "10px 0", fontWeight: 700, fontSize: 12, letterSpacing: 0.5, cursor: "pointer", fontFamily: "'Archivo', sans-serif", marginTop: 8 }}
        >
          DELETE ALL HISTORY
        </button>

        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: MUTED, marginBottom: 6 }}>MY FOOD NAMES</div>
          {foodDictionary.length === 0 ? (
            <div style={{ fontSize: 12, color: "#A39E8F" }}>Rename a food item in any meal and it will be remembered here.</div>
          ) : (
            foodDictionary.map((f) => (
              <div key={f.from} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "6px 0", borderTop: "1px dashed #D8D3C4", fontSize: 12, color: INK }}>
                <span><strong>{f.to}</strong> <span style={{ color: MUTED }}>(AI said "{f.from}")</span></span>
                <button onClick={() => onRemoveFood(f.from)} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, padding: 2 }} aria-label={`Forget ${f.to}`}>
                  <X size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
