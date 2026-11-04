// Looks up typical nutrition per 100g for a food name.
// Used when the user renames an item the AI identified wrongly.

const SYSTEM_PROMPT = `You are a nutrition reference. Given the name of a food or dish, return its typical nutrition per 100 grams as usually prepared and eaten. Names may be home-style or regional dishes (for example Indian dishes like rasam, kootu, sambar, poriyal); use typical home recipes for those.

Respond with ONLY valid JSON, no markdown, in exactly this shape:
{"name": "string", "per_100g": {"calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "fiber_g": number}, "note": "one short sentence on assumptions"}
Numbers must be plain numbers.`;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { name } = req.body || {};
  if (!name || typeof name !== "string") return res.status(400).json({ error: "No food name provided" });

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
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: `Food: ${name.slice(0, 100)}` }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: "Anthropic API error", detail: errText });
    }

    const data = await response.json();
    const textBlock = (data.content || []).find((b) => b.type === "text");
    if (!textBlock) return res.status(502).json({ error: "No response from model" });

    const cleaned = textBlock.text.replace(/`{3}(json)?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed.per_100g) return res.status(502).json({ error: "Malformed response from model" });
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
