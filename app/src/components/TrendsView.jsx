import React, { useState, useMemo } from "react";
import { TrendingUp, ChevronRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip, CartesianGrid, Cell } from "recharts";
import { MACRO_COLORS, INK, PAPER, MUTED } from "../theme.js";
import { dateKey, shortLabel } from "../lib/meals.js";
import { MacroBar } from "./ui.jsx";
import { DayDetail } from "./DayDetail.jsx";

export function TrendsView({ historySummary, goals, onDayChanged, onDeleteDays }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState([]);

  const toggleChecked = (date) =>
    setChecked((prev) => (prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]));

  const handleDeleteChecked = async () => {
    if (checked.length === 0) return;
    if (!window.confirm(`Delete ${checked.length} day${checked.length !== 1 ? "s" : ""} of meals? This can't be undone.`)) return;
    await onDeleteDays(checked);
    setChecked([]);
    setSelectMode(false);
  };
  const days = useMemo(() => {
    const arr = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = dateKey(d);
      const entry = historySummary[key];
      arr.push({
        date: key,
        label: shortLabel(key),
        calories: entry ? Math.round(entry.calories) : 0,
        protein: entry ? entry.protein : 0,
        carbs: entry ? entry.carbs : 0,
        fat: entry ? entry.fat : 0,
        fiber: entry ? entry.fiber : 0,
        logged: !!entry && entry.mealCount > 0,
      });
    }
    return arr;
  }, [historySummary]);

  const loggedDays = days.filter((d) => d.logged);
  const avg = (key) => (loggedDays.length > 0 ? loggedDays.reduce((s, d) => s + d[key], 0) / loggedDays.length : 0);

  if (selectedDate) return <DayDetail date={selectedDate} onBack={() => setSelectedDate(null)} onDayChanged={onDayChanged} />;

  return (
    <div>
      <div style={{ background: PAPER, border: `3px solid ${INK}`, padding: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
          <TrendingUp size={16} color={INK} />
          <div style={{ fontFamily: "'Archivo', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: MUTED }}>LAST 14 DAYS · CALORIES</div>
        </div>
        <div style={{ width: "100%", height: 180 }}>
          <ResponsiveContainer>
            <BarChart data={days} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E4D8" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9, fontFamily: "Archivo", fill: MUTED }} interval={1} axisLine={{ stroke: INK }} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fontFamily: "Archivo", fill: MUTED }} axisLine={false} tickLine={false} width={34} />
              <Tooltip contentStyle={{ fontFamily: "Archivo", fontSize: 12, border: `2px solid ${INK}`, borderRadius: 0 }} formatter={(val) => [`${val} kcal`, "Calories"]} />
              <ReferenceLine y={goals.calories} stroke={MACRO_COLORS.protein} strokeDasharray="4 4" strokeWidth={2} />
              <Bar dataKey="calories" radius={0}>
                {days.map((d, i) => (
                  <Cell key={i} fill={d.calories > goals.calories ? MACRO_COLORS.protein : INK} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ fontFamily: "'Archivo', sans-serif", fontSize: 10, color: MUTED, marginTop: 4 }}>Dashed line = your {goals.calories} kcal goal</div>
      </div>

      <div style={{ background: PAPER, border: `3px solid ${INK}`, padding: 16, marginBottom: 20 }}>
        <div style={{ fontFamily: "'Archivo', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: MUTED, marginBottom: 10 }}>
          AVERAGE ON LOGGED DAYS ({loggedDays.length})
        </div>
        <MacroBar label="Protein" grams={avg("protein")} maxGrams={goals.protein} color={MACRO_COLORS.protein} />
        <MacroBar label="Carbs" grams={avg("carbs")} maxGrams={goals.carbs} color={MACRO_COLORS.carbs} />
        <MacroBar label="Fat" grams={avg("fat")} maxGrams={goals.fat} color={MACRO_COLORS.fat} />
        <MacroBar label="Fiber" grams={avg("fiber")} maxGrams={goals.fiber} color={MACRO_COLORS.fiber} />
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontFamily: "'Archivo', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: MUTED }}>DAY BY DAY</div>
          {loggedDays.length > 0 && (
            <div style={{ display: "flex", gap: 6 }}>
              {selectMode && (
                <button onClick={handleDeleteChecked} disabled={checked.length === 0} style={{ background: checked.length ? MACRO_COLORS.protein : "#E8E4D8", color: PAPER, border: "none", padding: "4px 8px", fontSize: 10, fontWeight: 700, letterSpacing: 0.5, cursor: checked.length ? "pointer" : "default", fontFamily: "'Archivo', sans-serif" }}>
                  DELETE ({checked.length})
                </button>
              )}
              <button onClick={() => { setSelectMode((s) => !s); setChecked([]); }} style={{ background: "none", border: `1px solid ${INK}`, padding: "4px 8px", fontSize: 10, fontWeight: 700, letterSpacing: 0.5, cursor: "pointer", color: INK, fontFamily: "'Archivo', sans-serif" }}>
                {selectMode ? "CANCEL" : "SELECT"}
              </button>
            </div>
          )}
        </div>
        {[...days].reverse().map((d) => (
          <div
            key={d.date}
            onClick={() => d.logged && (selectMode ? toggleChecked(d.date) : setSelectedDate(d.date))}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px dashed #D8D3C4", fontFamily: "'Archivo', sans-serif", cursor: d.logged ? "pointer" : "default" }}
          >
            <span style={{ fontSize: 12, color: INK, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
              {selectMode && d.logged && (
                <span style={{ width: 14, height: 14, border: `1px solid ${INK}`, background: checked.includes(d.date) ? INK : PAPER, display: "inline-block" }} />
              )}
              {d.label}
            </span>
            <span style={{ fontSize: 12, color: d.logged ? INK : "#C9C4B4", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
              {d.logged ? `${d.calories} kcal` : "No log"}
              {d.logged && <ChevronRight size={14} />}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
