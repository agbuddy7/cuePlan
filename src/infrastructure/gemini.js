import { fallbackBriefing } from "../application/briefing.js";
export async function coordinateWithGemini(plan, env, transport = fetch) {
  if (!env.GEMINI_API_KEY) return fallbackBriefing(plan);
  const prompt = [
    "You coordinate a community event. Use only the supplied computed facts.",
    "Never invent a cost or vendor. Explicitly call unconfirmed costs estimates.",
    "Give a concise 3-sentence next-action briefing with one trade-off.",
    JSON.stringify(plan),
  ].join("\n");
  try {
    const model = env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const response = await transport("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
      method: "POST",
      signal: AbortSignal.timeout(6000),
      headers: { "x-goog-api-key": env.GEMINI_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 260, temperature: 0.2 },
      }),
    });
    if (!response.ok) return fallbackBriefing(plan);
    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const message = parts.map((part) => typeof part.text === "string" ? part.text : "").join("\n");
    if (!message.trim()) return fallbackBriefing(plan);
    return { mode: "ai", message: message.slice(0, 1800), assumptions: ["Costs remain estimates until confirmed by vendors", "The deterministic engine owns all calculations"] };
  } catch {
    return fallbackBriefing(plan);
  }
}

