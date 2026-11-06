// This runs on Vercel's servers, NOT on the phone. This is what keeps your
// API key private -- the app never sees it, it only talks to this endpoint.

const SYSTEM_PROMPT = `You are a nutrition estimation engine. You will be shown a photo of a meal or dish. The exact weight of the food is NOT provided, so you must visually estimate portion size using scale references in the image (plate diameter, utensils, hands, packaging, typical serving vessels).

For every distinct food item visible:
1. Identify it specifically (e.g. "grilled chicken breast", not just "meat").
2. Estimate its weight in grams from the visual portion size.
3. Using standard nutrition data per 100g for that food, calculate calories, protein (g), carbs (g), fat (g), and fiber (g) scaled to the estimated grams.

Respond with ONLY valid JSON, no markdown fences, no preamble, in exactly this shape:
{
  "items": [
    {"name": "string", "estimated_grams": number, "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "fiber_g": number}
  ],
  "note": "one short sentence on estimation confidence or ambiguity"
}
Numbers must be plain numbers (no units, no strings). If you cannot identify any food, return {"items": [], "note": "explain why"}.`;

function buildUserText(knownFoods) {
  let text = "Analyze this meal and return the JSON as instructed.";
  if (Array.isArray(knownFoods) && knownFoods.length > 0) {
    const lines = knownFoods
      .filter((f) => f && typeof f.to === "string" && typeof f.from === "string")
      .slice(0, 60)
      .map((f) => `- "${f.from.slice(0, 80)}" is called "${f.to.slice(0, 80)}" in this household`);
    if (lines.length > 0) {
      text += `\n\nThis household has corrected food names before:\n${lines.join("\n")}\nIf a dish in the photo matches one of these, use the household's name for it and give nutrition for that dish. Only use these names when the dish genuinely matches; otherwise identify foods normally.`;
    }
  }
  return text;
}

export default async function handler(req, res) {
  // Allow the Android app (and your browser during testing) to call this.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { image, mediaType, knownFoods } = req.body || {};
  if (!image) return res.status(400).json({ error: "No image provided" });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: image } },
              { type: "text", text: buildUserText(knownFoods) },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: "Anthropic API error", detail: errText });
    }

    const data = await response.json();
    const textBlock = (data.content || []).find((b) => b.type === "text");
    if (!textBlock) return res.status(502).json({ error: "No response from model" });

    const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
