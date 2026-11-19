import React, { useState, useEffect } from "react";
import { Camera } from "lucide-react";
import { INK, MUTED } from "../theme.js";
import { loadPhoto } from "../lib/photos.js";

export function MealPhoto({ meal }) {
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
