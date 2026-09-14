import { env } from "./env";

/**
 * Gemini via the REST API — replaces the `google.golang.org/genai` Go SDK
 * (services/gemini.go, services/ai.go, services/coach.go, ...). Plain `fetch`,
 * which is all Workers supports; no SDK needed.
 *
 * If GEMINI_API_KEY is unset the Go backend "runs but AI features are disabled".
 * Same here: callers should treat `GeminiDisabledError` as a soft failure.
 */
export class GeminiDisabledError extends Error {
  constructor() {
    super("Gemini API key not configured");
  }
}

const MODEL = "gemini-2.0-flash";
const BASE = "https://generativelanguage.googleapis.com/v1beta";

export async function geminiGenerate(
  prompt: string,
  opts: { system?: string; json?: boolean; temperature?: number } = {},
): Promise<string> {
  const key = env().GEMINI_API_KEY;
  if (!key) throw new GeminiDisabledError();

  const res = await fetch(`${BASE}/models/${MODEL}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      ...(opts.system
        ? { systemInstruction: { parts: [{ text: opts.system }] } }
        : {}),
      generationConfig: {
        temperature: opts.temperature ?? 0.7,
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}
