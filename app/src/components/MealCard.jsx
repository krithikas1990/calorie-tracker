import React, { useState, useMemo, useEffect } from "react";
import { Trash2, Loader2, ChevronDown, ChevronUp, AlertCircle, Minus, Plus, RotateCcw, Pencil, Check } from "lucide-react";
import { MACRO_COLORS, INK, PAPER, MUTED } from "../theme.js";
import { sumMeal } from "../lib/meals.js";
import { Rule, MacroBar } from "./ui.jsx";
import { MealPhoto } from "./MealPhoto.jsx";

function EditableGramRow({ item, onChange, onReset, onRename, onConfirm }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(Math.round(item.estimated_grams)));
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(item.name);
  const [renameStatus, setRenameStatus] = useState(null);

  const commitName = async () => {
    const newName = nameDraft.trim();
    setEditingName(false);
    if (!newName || newName === item.name) {
      setNameDraft(item.name);
      return;
    }
    setRenameStatus("saving");
    try {
      await onRename(newName);
      setRenameStatus(null);
    } catch (e) {
      setNameDraft(item.name);
      setRenameStatus("error");
    }
  };

  useEffect(() => setDraft(String(Math.round(item.estimated_grams))), [item.estimated_grams]);

  const commit = () => {
    const num = parseFloat(draft);
    if (!isNaN(num) && num >= 0) onChange(num);
    else setDraft(String(Math.round(item.estimated_grams)));
    setEditing(false);
  };

  const wasEdited = Math.round(item.estimated_grams) !== Math.round(item.original_grams);

  return (
    <div style={{ padding: "6px 0", borderTop: "1px dashed #D8D3C4" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: INK }}>
        {editingName ? (
          <input
            autoFocus
            type="text"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
            style={{ flex: 1, fontSize: 12, border: `1px solid ${INK}`, padding: "2px 4px", fontFamily: "'Archivo', sans-serif" }}
          />
        ) : (
          <button
            onClick={() => { setNameDraft(item.name); setRenameStatus(null); setEditingName(true); }}
            disabled={renameStatus === "saving"}
            style={{ flex: 1, display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontSize: 12, color: INK, fontFamily: "'Archivo', sans-serif" }}
            aria-label="Rename item"
          >
            {item.name} <Pencil size={11} color={MUTED} />
          </button>
        )}
        <span style={{ fontWeight: 700, marginLeft: 8 }}>
          {renameStatus === "saving" ? <Loader2 size={12} className="spin" /> : `${Math.round(item.calories)} kcal`}
        </span>
      </div>
      {renameStatus === "error" && (
        <div style={{ fontSize: 10, color: MACRO_COLORS.protein, marginTop: 2 }}>
          Couldn't look up that food. Check your connection and try again.
        </div>
      )}
      {item.needs_confirm && !editingName && renameStatus !== "saving" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, fontSize: 11, color: MACRO_COLORS.carbs, fontWeight: 700 }}>
          <span>Is this right?</span>
          <button onClick={onConfirm} style={{ display: "flex", alignItems: "center", gap: 3, background: "none", border: `1px solid ${INK}`, padding: "2px 6px", cursor: "pointer", fontSize: 10, fontWeight: 700, color: INK, fontFamily: "'Archivo', sans-serif" }}>
            <Check size={11} /> YES
          </button>
          <button onClick={() => { setNameDraft(item.name); setRenameStatus(null); setEditingName(true); }} style={{ display: "flex", alignItems: "center", gap: 3, background: "none", border: `1px solid ${INK}`, padding: "2px 6px", cursor: "pointer", fontSize: 10, fontWeight: 700, color: INK, fontFamily: "'Archivo', sans-serif" }}>
            <Pencil size={11} /> RENAME
          </button>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <button onClick={() => onChange(Math.max(0, item.estimated_grams - 10))} style={stepperBtnStyle} aria-label="Decrease grams">
          <Minus size={12} />
        </button>
        {editing ? (
          <input
            autoFocus
            type="number"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && commit()}
            style={{ width: 56, textAlign: "center", fontSize: 12, fontWeight: 700, border: `1px solid ${INK}`, padding: "2px 4px", fontFamily: "'Archivo', sans-serif" }}
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            style={{ width: 56, textAlign: "center", fontSize: 12, fontWeight: 700, background: "none", border: `1px solid ${MUTED}`, padding: "2px 4px", cursor: "pointer", fontFamily: "'Archivo', sans-serif", color: INK }}
          >
            {Math.round(item.estimated_grams)}g
          </button>
        )}
        <button onClick={() => onChange(item.estimated_grams + 10)} style={stepperBtnStyle} aria-label="Increase grams">
          <Plus size={12} />
        </button>
        {wasEdited && (
          <button onClick={onReset} style={{ ...stepperBtnStyle, marginLeft: "auto" }} aria-label="Reset to AI estimate" title="Reset to AI estimate">
            <RotateCcw size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

const stepperBtnStyle = {
  width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
  border: `1px solid ${INK}`, background: PAPER, cursor: "pointer", padding: 0,
};

export function MealCard({ meal, onDelete, onUpdateItemGrams, onResetItem, onRenameItem, onConfirmItem }) {
  const [open, setOpen] = useState(false);
  const totals = useMemo(() => sumMeal(meal.items || []), [meal.items]);

  return (
    <div style={{ background: PAPER, border: `2px solid ${INK}`, marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 12, padding: 12 }}>
        <MealPhoto meal={meal} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ fontFamily: "'Archivo', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: MUTED }}>{meal.time}</div>
            <button onClick={() => onDelete(meal.id)} style={{ background: "none", border: "none", cursor: "pointer", color: INK, padding: 2 }} aria-label="Delete meal">
              <Trash2 size={16} />
            </button>
          </div>

          {meal.status === "loading" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontFamily: "'Archivo', sans-serif", fontSize: 13, color: INK }}>
              <Loader2 size={16} className="spin" />
              Reading the plate…
            </div>
          )}

          {meal.status === "error" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontFamily: "'Archivo', sans-serif", fontSize: 13, color: MACRO_COLORS.protein }}>
              <AlertCircle size={16} />
              {meal.error || "Couldn't analyze this photo."}
            </div>
          )}

          {meal.status === "done" && (
            <>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 700, color: INK, lineHeight: 1.1, marginTop: 2 }}>
                {Math.round(totals.calories)} <span style={{ fontSize: 13, fontFamily: "'Archivo', sans-serif", fontWeight: 700, color: MUTED }}>KCAL</span>
              </div>
              <div style={{ fontFamily: "'Archivo', sans-serif", fontSize: 12, color: "#4A4636", marginTop: 2 }}>
                {(meal.items || []).map((i) => i.name).join(", ")}
              </div>
              {(meal.items || []).some((i) => i.needs_confirm) && (
                <div style={{ fontSize: 10, fontWeight: 700, color: MACRO_COLORS.carbs, marginTop: 2 }}>
                  {(meal.items || []).filter((i) => i.needs_confirm).length} item(s) to confirm
                </div>
              )}
              <button
                onClick={() => setOpen((o) => !o)}
                style={{ marginTop: 6, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "'Archivo', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: INK, padding: 0 }}
              >
                {open ? "HIDE DETAIL" : "SHOW DETAIL"}
                {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </>
          )}
        </div>
      </div>

      {meal.status === "done" && open && (
        <div style={{ padding: "0 12px 14px 12px" }}>
          <Rule />
          <div style={{ paddingTop: 10 }}>
            <MacroBar label="Protein" grams={totals.protein} maxGrams={Math.max(1, Math.round(totals.protein) || 1)} color={MACRO_COLORS.protein} />
            <MacroBar label="Carbs" grams={totals.carbs} maxGrams={Math.max(1, Math.round(totals.carbs) || 1)} color={MACRO_COLORS.carbs} />
            <MacroBar label="Fat" grams={totals.fat} maxGrams={Math.max(1, Math.round(totals.fat) || 1)} color={MACRO_COLORS.fat} />
            <MacroBar label="Fiber" grams={totals.fiber} maxGrams={Math.max(1, Math.round(totals.fiber) || 1)} color={MACRO_COLORS.fiber} />
          </div>

          <div style={{ fontFamily: "'Archivo', sans-serif", fontSize: 11, color: MUTED, marginTop: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: MUTED, marginBottom: 2 }}>
              TAP A WEIGHT TO CORRECT THE ESTIMATE
            </div>
            {meal.items.map((it, idx) => (
              <EditableGramRow key={idx} item={it} onChange={(g) => onUpdateItemGrams(meal.id, idx, g)} onReset={() => onResetItem(meal.id, idx)} onRename={(name) => onRenameItem(meal.id, idx, name)} onConfirm={() => onConfirmItem(meal.id, idx)} />
            ))}
          </div>

          {meal.note && <div style={{ fontFamily: "'Archivo', sans-serif", fontSize: 10, color: "#A39E8F", marginTop: 6, fontStyle: "italic" }}>{meal.note}</div>}
        </div>
      )}
    </div>
  );
}
