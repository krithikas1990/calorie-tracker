import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { INK, PAPER, MUTED } from "../theme.js";
import { dateKey } from "../lib/meals.js";
import { DayDetail } from "./DayDetail.jsx";

export function CalendarView({ historySummary, onDayChanged }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const today = dateKey();

  if (selectedDate) return <DayDetail date={selectedDate} onBack={() => setSelectedDate(null)} onDayChanged={onDayChanged} backLabel="BACK TO CALENDAR" />;

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthLabel = viewMonth.toLocaleDateString([], { month: "long", year: "numeric" });
  const loggedCount = cells.filter((d) => {
    if (!d) return false;
    const e = historySummary[dateKey(new Date(year, month, d))];
    return e && e.mealCount > 0;
  }).length;

  const navBtn = { background: "none", border: `1px solid ${INK}`, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: INK, padding: 0 };

  return (
    <div>
      <div style={{ background: PAPER, border: `3px solid ${INK}`, padding: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <button onClick={() => setViewMonth(new Date(year, month - 1, 1))} style={navBtn} aria-label="Previous month"><ChevronLeft size={16} /></button>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 700, color: INK }}>{monthLabel}</div>
          <button onClick={() => setViewMonth(new Date(year, month + 1, 1))} style={navBtn} aria-label="Next month"><ChevronRight size={16} /></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, textAlign: "center" }}>
          {["S", "M", "T", "W", "T", "F", "S"].map((w, i) => (
            <div key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: MUTED, paddingBottom: 4 }}>{w}</div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={`e${i}`} />;
            const key = dateKey(new Date(year, month, d));
            const entry = historySummary[key];
            const logged = !!entry && entry.mealCount > 0;
            const isToday = key === today;
            const isFuture = key > today;
            return (
              <button
                key={key}
                onClick={() => logged && setSelectedDate(key)}
                disabled={!logged}
                style={{
                  aspectRatio: "1",
                  border: isToday ? `2px solid ${INK}` : "1px solid #E8E4D8",
                  background: logged ? INK : PAPER,
                  color: logged ? PAPER : isFuture ? "#C9C4B4" : INK,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: logged ? "pointer" : "default",
                  fontFamily: "'Archivo', sans-serif",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                }}
              >
                <span>{d}</span>
                {logged && <span style={{ fontSize: 8, fontWeight: 400, opacity: 0.8 }}>{Math.round(entry.calories)}</span>}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 10, color: MUTED, marginTop: 10 }}>
          {loggedCount} day{loggedCount !== 1 ? "s" : ""} logged this month · tap a dark day to see its meals
        </div>
      </div>
    </div>
  );
}
