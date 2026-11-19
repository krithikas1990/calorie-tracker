import React, { useState, useMemo, useEffect } from "react";
import { Trash2, Loader2, ChevronLeft } from "lucide-react";
import { storageGet, storageSet } from "../storage.js";
import { INK, PAPER, MUTED } from "../theme.js";
import { sumMeal, sumDay } from "../lib/meals.js";
import { deletePhoto } from "../lib/photos.js";
import { MealPhoto } from "./MealPhoto.jsx";

export function DayDetail({ date, onBack, onDayChanged, backLabel = "BACK TO TRENDS" }) {
  const [dayMeals, setDayMeals] = useState(null);

  const handleDeleteMeal = async (meal) => {
    if (!window.confirm("Delete this meal? This can't be undone.")) return;
    const remaining = (dayMeals || []).filter((m) => m.id !== meal.id);
    if (meal.photoPath) await deletePhoto(meal.photoPath);
    setDayMeals(remaining);
    try {
      await storageSet(`day:${date}`, JSON.stringify(remaining));
    } catch (e) {}
    onDayChanged(date, remaining);
  };

  useEffect(() => {
    (async () => {
      try {
        const d = await storageGet(`day:${date}`);
        const parsed = d && d.value ? JSON.parse(d.value) : [];
        setDayMeals(parsed.filter((m) => m.status === "done"));
      } catch (e) {
        setDayMeals([]);
      }
    })();
  }, [date]);

  const totals = useMemo(() => sumDay(dayMeals || []), [dayMeals]);
  const heading = new Date(date + "T00:00:00").toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  const count = (dayMeals || []).length;

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "'Archivo', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: INK, padding: 0, marginBottom: 12 }}>
        <ChevronLeft size={14} /> {backLabel}
      </button>

      <div style={{ background: PAPER, border: `3px solid ${INK}`, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: MUTED }}>{heading.toUpperCase()}</div>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 40, fontWeight: 700, color: INK, lineHeight: 1.1 }}>{Math.round(totals.calories)}</div>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: INK }}>KCAL · {count} MEAL{count !== 1 ? "S" : ""}</div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>
          Protein {Math.round(totals.protein)}g · Carbs {Math.round(totals.carbs)}g · Fat {Math.round(totals.fat)}g · Fiber {Math.round(totals.fiber)}g
        </div>
      </div>

      {dayMeals === null && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: MUTED, fontSize: 12 }}>
          <Loader2 size={14} className="spin" /> Loading…
        </div>
      )}

      {dayMeals && dayMeals.length === 0 && (
        <div style={{ border: "2px dashed #C9C4B4", padding: "24px 16px", textAlign: "center", color: "#A39E8F", fontSize: 13 }}>
          No meals saved for this day.
        </div>
      )}

      {(dayMeals || []).map((meal) => (
        <div key={meal.id} style={{ background: PAPER, border: `2px solid ${INK}`, marginBottom: 12, padding: 12, display: "flex", gap: 12 }}>
          <MealPhoto meal={meal} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: MUTED }}>{meal.time}</div>
              <button onClick={() => handleDeleteMeal(meal)} style={{ background: "none", border: "none", cursor: "pointer", color: INK, padding: 2 }} aria-label="Delete meal">
                <Trash2 size={16} />
              </button>
            </div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 700, color: INK, lineHeight: 1.2 }}>
              {Math.round(sumMeal(meal.items).calories)} <span style={{ fontSize: 12, fontFamily: "'Archivo', sans-serif", fontWeight: 700, color: MUTED }}>KCAL</span>
            </div>
            {(meal.items || []).map((it, idx) => (
              <div key={idx} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, color: INK, borderTop: "1px dashed #D8D3C4", padding: "4px 0" }}>
                <span>{it.name}</span>
                <span style={{ color: MUTED, whiteSpace: "nowrap" }}>{Math.round(it.estimated_grams)}g · {Math.round(it.calories)} kcal</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
