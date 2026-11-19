import React, { useState, useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { INK, PAPER, MUTED } from "../theme.js";
import { dateKey } from "../lib/meals.js";
import { askCoach } from "../api.js";

export function CoachView({ meals, historySummary, goals, savedMessages, onMessagesChange }) {
  const [messages, setMessages] = useState(savedMessages || [
    { role: "assistant", text: "Ask me anything about your logged meals — like \"how was my protein this week?\" or \"what should I eat more of?\"" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (onMessagesChange) onMessagesChange(messages);
  }, [messages]);

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
