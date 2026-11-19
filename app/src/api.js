// Point this at your deployed backend (see README). During local testing
// this defaults to your local dev server.
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

// Calls YOUR backend (not Anthropic directly) so the API key never lives on the phone.
export async function analyzeMealImage(base64Data, mediaType, knownFoods = []) {
  const response = await fetch(`${BACKEND_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64Data, mediaType, knownFoods }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Analysis failed (${response.status}) ${detail}`.trim());
  }
  const parsed = await response.json();
  if (!Array.isArray(parsed.items)) throw new Error("Malformed response from server");
  return parsed;
}

export async function askCoach(question, context) {
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

export async function fetchNutrition(name) {
  const response = await fetch(`${BACKEND_URL}/api/nutrition`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error(`Nutrition lookup failed (${response.status})`);
  const parsed = await response.json();
  if (!parsed.per_100g) throw new Error("Malformed response from server");
  return parsed.per_100g;
}
