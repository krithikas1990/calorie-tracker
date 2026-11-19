import React from "react";
import { INK } from "../theme.js";

export function Rule({ thick }) {
  return <div style={{ height: thick ? 6 : 2, background: INK, width: "100%" }} />;
}

export function MacroBar({ label, grams, maxGrams, color }) {
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
