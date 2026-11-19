// Simple in-memory rate limiter for the serverless functions.
// Each warm Vercel instance keeps its own counts, and they reset when the
// instance restarts, so this blocks bursts and runaway loops rather than
// being a hard guarantee. The prepaid Anthropic balance is the final cap.

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const GLOBAL_LIMIT = 300; // all callers together, per instance per hour
const hits = new Map(); // key -> { count, resetAt }

function bump(key, now) {
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

// Returns true if the request may go ahead; otherwise sends a 429 and returns false.
export function allowRequest(req, res, endpoint, perIpLimit) {
  const now = Date.now();
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }
  const ip = String(req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
  const ipCount = bump(`${endpoint}:${ip}`, now);
  const globalCount = bump("global", now);
  if (ipCount > perIpLimit || globalCount > GLOBAL_LIMIT) {
    res.setHeader("Retry-After", "600");
    res.status(429).json({ error: "Too many requests. Please wait a few minutes and try again." });
    return false;
  }
  return true;
}
