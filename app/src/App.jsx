import React, { useState, useRef, useMemo, useEffect } from "react";
import { Camera, Settings, TrendingUp, CalendarDays, Upload } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Camera as CapCamera, CameraResultType, CameraSource } from "@capacitor/camera";
import { storageGet, storageSet } from "./storage.js";
import { MACRO_COLORS, INK, PAPER, BG, MUTED, DEFAULT_GOALS } from "./theme.js";
import { uid, dateKey, MAX_DIMENSION, fileToBase64, normalizeItems, recomputeItem, sumDay } from "./lib/meals.js";
import { savePhoto, deletePhoto, deleteDays } from "./lib/photos.js";
import { analyzeMealImage, fetchNutrition } from "./api.js";
import { Rule, MacroBar } from "./components/ui.jsx";
import { MealCard } from "./components/MealCard.jsx";
import { GoalsModal } from "./components/GoalsModal.jsx";
import { CalendarView } from "./components/CalendarView.jsx";
import { TrendsView } from "./components/TrendsView.jsx";
import { CoachView } from "./components/CoachView.jsx";

export default function App() {
  const [meals, setMeals] = useState([]);
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [foodDictionary, setFoodDictionary] = useState([]);
  const [coachMessages, setCoachMessages] = useState(null);
  const [historySummary, setHistorySummary] = useState({});
  const [tab, setTab] = useState("today");
  const [showGoals, setShowGoals] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const fileInputRef = useRef(null);
  const [today, setToday] = useState(() => dateKey());

  // If the app stays open past midnight, switch to the new day instead of
  // saving yesterday's meals under the new date.
  useEffect(() => {
    const checkDate = async () => {
      const now = dateKey();
      if (now === today) return;
      setLoaded(false);
      let nextMeals = [];
      try {
        const d = await storageGet(`day:${now}`);
        if (d && d.value) nextMeals = JSON.parse(d.value);
      } catch (e) {}
      setToday(now);
      setMeals(nextMeals);
      setLoaded(true);
    };
    const onVisible = () => { if (document.visibilityState === "visible") checkDate(); };
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(checkDate, 60000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [today]);

  useEffect(() => {
    (async () => {
      try {
        const g = await storageGet("goals");
        if (g && g.value) setGoals(JSON.parse(g.value));
      } catch (e) {}
      try {
        const fd = await storageGet("food-dictionary");
        if (fd && fd.value) setFoodDictionary(JSON.parse(fd.value));
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
    await processFile(file);
  };

  const takePhoto = async (source) => {
    if (!Capacitor.isNativePlatform()) {
      if (fileInputRef.current) fileInputRef.current.click();
      return;
    }
    try {
      const photo = await CapCamera.getPhoto({
        source,
        resultType: CameraResultType.DataUrl,
        quality: 85,
        width: MAX_DIMENSION,
        correctOrientation: true,
      });
      const blob = await (await fetch(photo.dataUrl)).blob();
      await processFile(new File([blob], "meal.jpg", { type: blob.type || "image/jpeg" }));
    } catch (e) {
      console.log("Photo cancelled or unavailable", e);
    }
  };

  const processFile = async (file) => {

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
      const result = await analyzeMealImage(base64, "image/jpeg", foodDictionary);
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

  const handleDayChanged = (date, remainingMeals) => {
    if (date === today) {
      setMeals(remainingMeals);
      return;
    }
    const totals = sumDay(remainingMeals);
    const next = { ...historySummary, [date]: { ...totals, mealCount: remainingMeals.length } };
    setHistorySummary(next);
    storageSet("history-summary", JSON.stringify(next)).catch(() => {});
  };

  const handleDeleteDays = async (dateKeys) => {
    const next = await deleteDays(dateKeys, historySummary);
    setHistorySummary(next);
    if (dateKeys.includes(today)) setMeals([]);
  };

  const handleDeleteAllHistory = async () => {
    if (!window.confirm("Delete ALL meal history and photos? Your goals and food names will be kept. This can't be undone.")) return;
    const allDays = Object.keys(historySummary);
    if (!allDays.includes(today)) allDays.push(today);
    const next = await deleteDays(allDays, historySummary);
    setHistorySummary(next);
    setMeals([]);
    setShowGoals(false);
  };

  const saveFoodDictionary = async (next) => {
    setFoodDictionary(next);
    try {
      await storageSet("food-dictionary", JSON.stringify(next));
    } catch (e) {
      console.error("Could not save food dictionary", e);
    }
  };

  const handleRemoveFood = (fromName) => {
    saveFoodDictionary(foodDictionary.filter((f) => f.from !== fromName));
  };

  const handleConfirmItem = (mealId, itemIdx) => {
    setMeals((prev) =>
      prev.map((m) => {
        if (m.id !== mealId) return m;
        const items = m.items.map((it, idx) => (idx === itemIdx ? { ...it, needs_confirm: false } : it));
        return { ...m, items };
      })
    );
  };

  const handleRenameItem = async (mealId, itemIdx, newName) => {
    const per100 = await fetchNutrition(newName);
    const meal = meals.find((m) => m.id === mealId);
    const item = meal && meal.items[itemIdx];
    const fromName = item ? (item.ai_name || item.name).trim() : null;
    if (fromName) {
      const key = fromName.toLowerCase();
      const others = foodDictionary.filter((f) => f.from.trim().toLowerCase() !== key);
      if (key === newName.trim().toLowerCase()) {
        saveFoodDictionary(others);
      } else {
        saveFoodDictionary([{ from: fromName, to: newName.trim() }, ...others]);
      }
    }
    const perGram = {
      calories: (per100.calories || 0) / 100,
      protein: (per100.protein_g || 0) / 100,
      carbs: (per100.carbs_g || 0) / 100,
      fat: (per100.fat_g || 0) / 100,
      fiber: (per100.fiber_g || 0) / 100,
    };
    setMeals((prev) =>
      prev.map((m) => {
        if (m.id !== mealId) return m;
        const items = m.items.map((it, idx) =>
          idx === itemIdx
            ? recomputeItem({ ...it, name: newName, ai_name: it.ai_name || it.name, perGram, needs_confirm: false }, it.estimated_grams)
            : it
        );
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
    if (!window.confirm("Clear all of today's meals and photos? This can't be undone.")) return;
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
          <button onClick={() => setTab("calendar")} style={{ flex: 1, padding: "10px 0", background: tab === "calendar" ? INK : PAPER, color: tab === "calendar" ? PAPER : INK, border: "none", borderLeft: `2px solid ${INK}`, fontWeight: 800, fontSize: 12, letterSpacing: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "'Archivo', sans-serif" }}>
            CALENDAR
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

            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <button
                onClick={() => takePhoto(CameraSource.Camera)}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: INK, color: PAPER, border: "none", padding: "14px 0", fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: 13, letterSpacing: 1, cursor: "pointer" }}
              >
                <Camera size={18} /> TAKE PHOTO
              </button>
              <button
                onClick={() => takePhoto(CameraSource.Photos)}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: PAPER, color: INK, border: `2px solid ${INK}`, padding: "12px 0", fontFamily: "'Archivo', sans-serif", fontWeight: 800, fontSize: 13, letterSpacing: 1, cursor: "pointer" }}
              >
                <Upload size={18} /> FROM GALLERY
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelected} />

            <div style={{ fontFamily: "'Archivo', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: MUTED, marginBottom: 10 }}>MEALS</div>

            {meals.length === 0 && (
              <div style={{ border: "2px dashed #C9C4B4", padding: "30px 16px", textAlign: "center", color: "#A39E8F", fontSize: 13, fontFamily: "'Archivo', sans-serif" }}>
                No meals logged yet. Snap a photo of your first plate of the day to get started.
              </div>
            )}

            {meals.map((meal) => (
              <MealCard key={meal.id} meal={meal} onDelete={handleDelete} onUpdateItemGrams={handleUpdateItemGrams} onResetItem={handleResetItem} onRenameItem={handleRenameItem} onConfirmItem={handleConfirmItem} />
            ))}

            <div style={{ fontFamily: "'Archivo', sans-serif", fontSize: 10, color: "#A39E8F", marginTop: 20, textAlign: "center", lineHeight: 1.5 }}>
              Estimates are computed from the photo alone using visual portion cues — tap any weight above to correct it. Your data is saved on this device.
            </div>
          </>
        ) : tab === "trends" ? (
          <TrendsView historySummary={historySummary} goals={goals} onDayChanged={handleDayChanged} onDeleteDays={handleDeleteDays} />
        ) : tab === "calendar" ? (
          <CalendarView historySummary={historySummary} onDayChanged={handleDayChanged} />
        ) : (
          <CoachView meals={meals} historySummary={historySummary} goals={goals} savedMessages={coachMessages} onMessagesChange={setCoachMessages} />
        )}
      </div>

      {showGoals && <GoalsModal goals={goals} onSave={handleSaveGoals} onClose={() => setShowGoals(false)} onResetToday={handleResetToday} foodDictionary={foodDictionary} onRemoveFood={handleRemoveFood} onDeleteAll={handleDeleteAllHistory} />}
    </div>
  );
}
