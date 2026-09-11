// This runs on Vercel's servers, NOT on the phone — same pattern as analyze.js.
// Takes a question plus a summary of the user's recent logged data, and asks
// Claude to answer as a grounded nutrition coach (not a generic chatbot).

const SYSTEM_PROMPT = `You are a friendly, knowledgeable nutrition coach helping someone understand their own food log.

You will be given:
1. The user's daily nutrition goals
2. A summary of their last 14 days of logged totals (calories, protein, carbs, fat, fiber)
3. Today's individual meals in detail
4. Their question

Answer using ONLY the data provided — do not invent numbers or assume days/meals that aren't in the data. If the data doesn't cover what they're asking (e.g. they ask about a day with no log), say so honestly rather than guessing.

Be warm and encouraging, but honest — if their data shows a real gap (e.g. consistently low protein or fiber), say so plainly and suggest a concrete, practical adjustment. Keep answers concise (3-6 sentences unless they ask for detail). You are not a doctor — for anything medical, suggest they consult one.`;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { question, context } = req.body || {};
  if (!question) return res.status(400).json({ error: "No question provided" });
  if (!context) return res.status(400).json({ error: "No context provided" });

  const userMessage = `Goals: ${JSON.stringify(context.goals)}

Last 14 days summary: ${JSON.stringify(context.last14Days)}

Today's meals: ${JSON.stringify(context.todayMeals)}

Question: ${question}`;

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
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: "Anthropic API error", detail: errText });
    }

    const data = await response.json();
    const textBlock = (data.content || []).find((b) => b.type === "text");
    if (!textBlock) return res.status(502).json({ error: "No response from model" });

    return res.status(200).json({ answer: textBlock.text });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
