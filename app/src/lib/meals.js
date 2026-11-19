export function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function shortLabel(dStr) {
  const d = new Date(dStr + "T00:00:00");
  return d.toLocaleDateString([], { weekday: "short" }).slice(0, 3) + " " + d.getDate();
}

// Downscales + re-encodes as JPEG so phone camera photos (often 5-15MB) stay
// well under Vercel's serverless function payload limit (4.5MB).
export const MAX_DIMENSION = 1280;
export const JPEG_QUALITY = 0.8;

export function fileToBase64(file) {
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

export function normalizeItems(rawItems) {
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
      needs_confirm: it.confident === false,
    };
  });
}

export function recomputeItem(item, newGrams) {
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

export function sumMeal(items) {
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

export function sumDay(meals) {
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
