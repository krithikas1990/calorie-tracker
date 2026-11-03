import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  Camera, Trash2, Loader2, ChevronDown, ChevronUp, AlertCircle,
  Settings, Minus, Plus, RotateCcw, X, TrendingUp, CalendarDays,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip, CartesianGrid, Cell } from "recharts";
import { storageGet, storageSet } from "./storage.js";
import { Filesystem, Directory } from "@capacitor/filesystem";

// Point this at your deployed backend (see README). During local testing
// this defaults to your local dev server.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

const MACRO_COLORS = { protein: "#B23A48", carbs: "#C9971F", fat: "#6B7A3B", fiber: "#8B5E3C" };
const INK = "#1A1A1A";
const PAPER = "#FAFAF7";
const BG = "#EFEBDD";
const MUTED = "#7A756A";
const DEFAULT_GOALS = { calories: 2000, protein: 90, carbs: 250, fat: 65, fiber: 30 };

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shortLabel(dStr) {
  const d = new Date(dStr + "T00:00:00");
  return d.toLocaleDateString([], { weekday: "short" }).slice(0, 3) + " " + d.getDate();
}

// Downscales + re-encodes as JPEG so phone camera photos (often 5-15MB) stay
// well under Vercel's serverless function payload limit (4.5MB).
const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.8;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      resolve(dataUrl.split(",")[1]);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read image"));
    };
    img.src = objectUrl;
  });
}

// Meal photos are saved as files on the device, so they survive app restarts.
const PHOTO_DIR = "meal-photos";

async function savePhoto(id, base64) {
  const path = `${PHOTO_DIR}/${id}.jpg`;
  await Filesystem.writeFile({ path, data: base64, directory: Directory.Data, recursive: true });
  return path;
}

async function loadPhoto(path) {
  const { data } = await Filesystem.readFile({ path, directory: Directory.Data });
  if (typeof data === "string") return `data:image/jpeg;base64,${data}`;
  return URL.createObjectURL(data);
}

async function deletePhoto(path) {
  try {
    await Filesystem.deleteFile({ path, directory: Directory.Data });
  } catch (e) {}
}

// Calls YOUR backend (not Anthropic directly) so the API key never lives on the phone.
async function analyzeMealImage(base64Data, mediaType) {
  const response = await fetch(`${BACKEND_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64Data, mediaType }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Analysis failed (${response.status}) ${detail}`.trim());
  }
  const parsed = await response.json();
  if (!Array.isArray(parsed.items)) throw new Error("Malformed response from server");
  return parsed;
}

async function askCoach(question, context) {
  const response = await fetch(`${BACKEND_URL}/api/insights`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, context }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Coach request failed (${response.status}) ${detail}`.trim());
  }
  const parsed2 = await response.json();
  if (!parsed2.answer) throw new Error("Malformed response from server");
  return parsed2.answer;
}

function normalizeItems(rawItems) {
  return rawItems.map((it) => {
    const grams = Number(it.estimated_grams) || 0;
    const perGram =
      grams > 0
        ? {
            calories: (it.calories || 0) / grams,
            protein: (it.protein_g || 0) / grams,
            carbs: (it.carbs_g || 0) / grams,
            fat: (it.fat_g || 0) / grams,
            fiber: (it.fiber_g || 0) / grams,
          }
        : { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    return {
      name: it.name,
      original_grams: grams,
      estimated_grams: grams,
      perGram,
      calories: it.calories || 0,
      protein_g: it.protein_g || 0,
      carbs_g: it.carbs_g || 0,
      fat_g: it.fat_g || 0,
      fiber_g: it.fiber_g || 0,
    };
  });
}

function recomputeItem(item, newGrams) {
  const g = Math.max(0, newGrams);
  return {
    ...item,
    estimated_grams: g,
    calories: item.perGram.calories * g,
    protein_g: item.perGram.protein * g,
    carbs_g: item.perGram.carbs * g,
    fat_g: item.perGram.fat * g,
    fiber_g: item.perGram.fiber * g,
  };
}

function sumMeal(items) {
  return (items || []).reduce(
    (acc, it) => ({
      calories: acc.calories + (it.calories || 0),
      protein: acc.protein + (it.protein_g || 0),
      carbs: acc.carbs + (it.carbs_g || 0),
      fat: acc.fat + (it.fat_g || 0),
      fiber: acc.fiber + (it.fiber_g || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );
}

function sumDay(meals) {
  return meals
    .filter((m) => m.status === "done")
    .reduce(
      (acc, m) => {
        const t = sumMeal(m.items);
        return {
          calories: acc.calories + t.calories,
          protein: acc.protein + t.protein,
          carbs: acc.carbs + t.carbs,
          fat: acc.fat + t.fat,
          fiber: acc.fiber + t.fiber,
        };
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    );
}

function Rule({ thick }) {
  return <div style={{ height: thick ? 6 : 2, background: INK, width: "100%" }} />;
}

function MacroBar({ label, grams, maxGrams, color }) {
  const pct = maxGrams > 0 ? Math.min(100, (grams / maxGrams) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Archivo', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: INK, marginBottom: 3 }}>
        <span>{label.toUpperCase()}</span>
        <span>{grams.toFixed(1)} / {maxGrams}g</span>
      </div>
      <div style={{ height: 8, background: "#E8E4D8", width: "100%" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

function EditableGramRow({ item, onChange, onReset }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(Math.round(item.estimated_grams)));

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
        <span style={{ flex: 1 }}>{item.name}</span>
        <span style={{ fontWeight: 700, marginLeft: 8 }}>{Math.round(item.calories)} kcal</span>
      </div>
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

function MealPhoto({ meal }) {
  const [src, setSrc] = useState(meal.photoPath ? null : meal.imageUrl);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (meal.photoPath) {
      loadPhoto(meal.photoPath)
        .then((url) => { if (!cancelled) { setSrc(url); setFailed(false); } })
        .catch(() => { if (!cancelled) setFailed(true); });
    }
    return () => { cancelled = true; };
  }, [meal.photoPath]);

  const boxStyle = { width: 72, height: 72, border: `2px solid ${INK}`, flexShrink: 0 };

  if (failed || !src) {
    return (
      <div style={{ ...boxStyle, display: "flex", alignItems: "center", justifyContent: "center", background: "#E8E4D8", color: MUTED }}>
        <Camera size={20} />
      </div>
    );
  }
  return <img src={src} alt="meal" onError={() => setFailed(true)} style={{ ...boxStyle, objectFit: "cover" }} />;
}

function MealCard({ meal, onDelete, onUpdateItemGrams, onResetItem }) {
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
              <EditableGramRow key={idx} item={it} onChange={(g) => onUpdateItemGrams(meal.id, idx, g)} onReset={() => onResetItem(meal.id, idx)} />
            ))}
          </div>

          {meal.note && <div style={{ fontFamily: "'Archivo', sans-serif", fontSize: 10, color: "#A39E8F", marginTop: 6, fontStyle: "italic" }}>{meal.note}</div>}
        </div>
      )}
    </div>
  );
}

function GoalsModal({ goals, onSave, onClose, onResetToday }) {
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
      </div>
    </div>
  );
}

function TrendsView({ historySummary, goals }) {
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
        <div style={{ fontFamily: "'Archivo', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: MUTED, marginBottom: 10 }}>DAY BY DAY</div>
        {[...days].reverse().map((d) => (
          <div key={d.date} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px dashed #D8D3C4", fontFamily: "'Archivo', sans-serif" }}>
            <span style={{ fontSize: 12, color: INK, fontWeight: 600 }}>{d.label}</span>
            <span style={{ fontSize: 12, color: d.logged ? INK : "#C9C4B4", fontWeight: 700 }}>{d.logged ? `${d.calories} kcal` : "No log"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CoachView({ meals, historySummary, goals }) {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Ask me anything about your logged meals — like \"how was my protein this week?\" or \"what should I eat more of?\"" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const buildContext = () => {
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = dateKey(d);
      const entry = historySummary[key];
      if (entry && entry.mealCount > 0) {
        days.push({
          date: key,
          calories: Math.round(entry.calories),
          protein: Math.round(entry.protein),
          carbs: Math.round(entry.carbs),
          fat: Math.round(entry.fat),
          fiber: Math.round(entry.fiber),
        });
      }
    }
    const todayMeals = meals
      .filter((m) => m.status === "done")
      .map((m) => ({
        time: m.time,
        items: (m.items || []).map((it) => ({
          name: it.name,
          grams: Math.round(it.estimated_grams),
          calories: Math.round(it.calories),
          protein_g: Math.round(it.protein_g),
          carbs_g: Math.round(it.carbs_g),
          fat_g: Math.round(it.fat_g),
          fiber_g: Math.round(it.fiber_g),
        })),
      }));
    return { goals, last14Days: days, todayMeals };
  };

  const handleSend = async () => {
    const question = input.trim();
    if (!question || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setLoading(true);
    try {
      const context = buildContext();
      const answer = await askCoach(question, context);
      setMessages((prev) => [...prev, { role: "assistant", text: answer }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", text: `Sorry, I couldn't get an answer (${err.message || "unknown error"}).` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "60vh" }}>
      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: "auto", background: PAPER, border: `3px solid ${INK}`, padding: 14, marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              background: m.role === "user" ? INK : "#EFEBDD",
              color: m.role === "user" ? PAPER : INK,
              padding: "8px 12px",
              fontFamily: "'Archivo', sans-serif",
              fontSize: 13,
              lineHeight: 1.4,
              border: m.role === "user" ? "none" : `1px solid ${MUTED}`,
            }}
          >
            {m.text}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, color: MUTED, fontFamily: "'Archivo', sans-serif", fontSize: 12 }}>
            <Loader2 size={14} className="spin" /> Thinking…
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask about your meals..."
          style={{ flex: 1, border: `2px solid ${INK}`, padding: "10px 12px", fontSize: 13, fontFamily: "'Archivo', sans-serif", background: PAPER, color: INK, boxSizing: "border-box" }}
        />
        <button
          onClick={handleSend}
          disabled={loading}
          style={{ background: INK, color: PAPER, border: "none", padding: "0 18px", fontWeight: 800, fontSize: 12, letterSpacing: 1, cursor: loading ? "default" : "pointer", fontFamily: "'Archivo', sans-serif", opacity: loading ? 0.6 : 1 }}
        >
          SEND
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [meals, setMeals] = useState([]);
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [historySummary, setHistorySummary] = useState({});
  const [tab, setTab] = useState("today");
  const [showGoals, setShowGoals] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const fileInputRef = useRef(null);
  const today = dateKey();

  useEffect(() => {
    (async () => {
      try {
        const g = await storageGet("goals");
        if (g && g.value) setGoals(JSON.parse(g.value));
      } catch (e) {}
      try {
        const h = await storageGet("history-summary");
        if (h && h.value) setHistorySummary(JSON.parse(h.value));
      } catch (e) {}
      try {
        const d = await storageGet(`day:${today}`);
        if (d && d.value) setMeals(JSON.parse(d.value));
      } catch (e) {}
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const totals = sumDay(meals);
    const doneCount = meals.filter((m) => m.status === "done").length;
    const nextSummary = { ...historySummary, [today]: { ...totals, mealCount: doneCount } };
    setHistorySummary(nextSummary);
    (async () => {
      try {
        await storageSet(`day:${today}`, JSON.stringify(meals));
        await storageSet("history-summary", JSON.stringify(nextSummary));
      } catch (e) {
        console.error("Storage save failed", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meals, loaded]);

  const dayTotals = useMemo(() => sumDay(meals), [meals]);

  const handleFileSelected = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;

    const id = uid();
    const imageUrl = URL.createObjectURL(file);
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    setMeals((prev) => [{ id, imageUrl, time, status: "loading", items: [] }, ...prev]);

    try {
      const base64 = await fileToBase64(file);
      try {
        const photoPath = await savePhoto(id, base64);
        setMeals((prev) => prev.map((m) => (m.id === id ? { ...m, photoPath } : m)));
      } catch (e) {
        console.error("Photo save failed", e);
      }
      const result = await analyzeMealImage(base64, "image/jpeg");
      const items = normalizeItems(result.items);
      setMeals((prev) => prev.map((m) => (m.id === id ? { ...m, status: "done", items, note: result.note } : m)));
    } catch (err) {
      setMeals((prev) => prev.map((m) => (m.id === id ? { ...m, status: "error", error: err.message || "Analysis failed" } : m)));
    }
  };

  const handleDelete = (id) => {
    const meal = meals.find((m) => m.id === id);
    if (meal && meal.photoPath) deletePhoto(meal.photoPath);
    setMeals((prev) => prev.filter((m) => m.id !== id));
  };

  const handleUpdateItemGrams = (mealId, itemIdx, newGrams) => {
    setMeals((prev) =>
      prev.map((m) => {
        if (m.id !== mealId) return m;
        const items = m.items.map((it, idx) => (idx === itemIdx ? recomputeItem(it, newGrams) : it));
        return { ...m, items };
      })
    );
  };

  const handleResetItem = (mealId, itemIdx) => {
    setMeals((prev) =>
      prev.map((m) => {
        if (m.id !== mealId) return m;
        const items = m.items.map((it, idx) => (idx === itemIdx ? recomputeItem(it, it.original_grams) : it));
        return { ...m, items };
      })
    );
  };

  const handleSaveGoals = async (newGoals) => {
    setGoals(newGoals);
    setShowGoals(false);
    try {
      await storageSet("goals", JSON.stringify(newGoals));
    } catch (e) {
      console.error("Could not save goals", e);
    }
  };

  const handleResetToday = () => {
    meals.forEach((m) => m.photoPath && deletePhoto(m.photoPath));
    setMeals([]);
    setShowGoals(false);
  };

  const pct = (val, goalVal) => Math.min(100, goalVal > 0 ? (val / goalVal) * 100 : 0);

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Archivo', sans-serif", display: "flex", justifyContent: "center", padding: "20px 12px 90px 12px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Archivo:wght@400;500;700;800&display=swap');
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input[type="file"] { display: none; }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 22, color: INK }}>Daily Value</div>
          <button onClick={() => setShowGoals(true)} style={{ background: "none", border: `2px solid ${INK}`, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} aria-label="Edit goals">
            <Settings size={16} color={INK} />
          </button>
        </div>

        <div style={{ display: "flex", marginBottom: 16, border: `2px solid ${INK}` }}>
          <button onClick={() => setTab("today")} style={{ flex: 1, padding: "10px 0", background: tab === "today" ? INK : PAPER, color: tab === "today" ? PAPER : INK, border: "none", fontWeight: 800, fontSize: 12, letterSpacing: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "'Archivo', sans-serif" }}>
            <CalendarDays size={14} /> TODAY
          </button>
          <button onClick={() => setTab("trends")} style={{ flex: 1, padding: "10px 0", background: tab === "trends" ? INK : PAPER, color: tab === "trends" ? PAPER : INK, border: "none", borderLeft: `2px solid ${INK}`, fontWeight: 800, fontSize: 12, letterSpacing: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "'Archivo', sans-serif" }}>
            <TrendingUp size={14} /> TRENDS
          </button>
          <button onClick={() => setTab("coach")} style={{ flex: 1, padding: "10px 0", background: tab === "coach" ? INK : PAPER, color: tab === "coach" ? PAPER : INK, border: "none", borderLeft: `2px solid ${INK}`, fontWeight: 800, fontSize: 12, letterSpacing: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "'Archivo', sans-serif" }}>
            COACH
          </button>
        </div>

        {tab === "today" ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: MUTED }}>
                {new Date().toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }).toUpperCase()}
              </div>
            </div>

            <div style={{ background: PAPER, border: `3px solid ${INK}`, padding: 16, marginBottom: 20 }}>
              <Rule thick />
              <div style={{ paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: MUTED }}>TOTAL TODAY</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: 48, fontWeight: 700, color: INK, lineHeight: 1 }}>{Math.round(dayTotals.calories)}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: INK }}>KCAL OF {goals.calories}</div>
                </div>
                <div style={{ textAlign: "right", fontSize: 11, color: MUTED, fontWeight: 700 }}>
                  {meals.filter((m) => m.status === "done").length} MEAL{meals.filter((m) => m.status === "done").length !== 1 ? "S" : ""} LOGGED
                </div>
              </div>
              <div style={{ height: 10, background: "#E8E4D8", width: "100%", marginTop: 10 }}>
                <div style={{ height: "100%", width: `${pct(dayTotals.calories, goals.calories)}%`, background: INK, transition: "width 0.4s ease" }} />
              </div>

              <div style={{ marginTop: 16 }}>
                <Rule />
                <div style={{ paddingTop: 12 }}>
                  <MacroBar label="Protein" grams={dayTotals.protein} maxGrams={goals.protein} color={MACRO_COLORS.protein} />
                  <MacroBar label="Carbs" grams={dayTotals.carbs} maxGrams={goals.carbs} color={MACRO_COLORS.carbs} />
                  <MacroBar label="Fat" grams={dayTotals.fat} maxGrams={goals.fat} color={MACRO_COLORS.fat} />
                  <MacroBar label="Fiber" grams={dayTotals.fiber} maxGrams={goals.fiber} color={MACRO_COLORS.fiber} />
                </div>
              </div>
            </div>

            <button
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: INK, color: PAPER, border: "none", padding: "14px 0", fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: 13, letterSpacing: 1, cursor: "pointer", marginBottom: 20 }}
            >
              <Camera size={18} /> PHOTOGRAPH A MEAL
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelected} />

            <div style={{ fontFamily: "'Archivo', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: MUTED, marginBottom: 10 }}>MEALS</div>

            {meals.length === 0 && (
              <div style={{ border: "2px dashed #C9C4B4", padding: "30px 16px", textAlign: "center", color: "#A39E8F", fontSize: 13, fontFamily: "'Archivo', sans-serif" }}>
                No meals logged yet. Snap a photo of your first plate of the day to get started.
              </div>
            )}

            {meals.map((meal) => (
              <MealCard key={meal.id} meal={meal} onDelete={handleDelete} onUpdateItemGrams={handleUpdateItemGrams} onResetItem={handleResetItem} />
            ))}

            <div style={{ fontFamily: "'Archivo', sans-serif", fontSize: 10, color: "#A39E8F", marginTop: 20, textAlign: "center", lineHeight: 1.5 }}>
              Estimates are computed from the photo alone using visual portion cues — tap any weight above to correct it. Your data is saved on this device.
            </div>
          </>
        ) : tab === "trends" ? (
          <TrendsView historySummary={historySummary} goals={goals} />
        ) : (
          <CoachView meals={meals} historySummary={historySummary} goals={goals} />
        )}
      </div>

      {showGoals && <GoalsModal goals={goals} onSave={handleSaveGoals} onClose={() => setShowGoals(false)} onResetToday={handleResetToday} />}
    </div>
  );
}
