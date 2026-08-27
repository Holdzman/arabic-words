import { authErrorResponse } from "@/lib/server/authErrorResponse";
import { getSessionUserId } from "@/lib/server/session";

const OPENAI_SPEECH_ENDPOINT = "https://api.openai.com/v1/audio/speech";
const ALLOWED_VOICES = new Set(["marin", "cedar", "coral", "onyx"]);
const MAX_INPUT_LENGTH = 1000;

export async function POST(request: Request) {
  if (!(await getSessionUserId())) {
    return authErrorResponse(401, "not_authenticated");
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "OPENAI_API_KEY is not configured" }, { status: 503 });
  }

  let body: { input?: unknown; voice?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const input = typeof body.input === "string" ? body.input.trim() : "";
  const voice = typeof body.voice === "string" ? body.voice : "";
  if (!input || input.length > MAX_INPUT_LENGTH || !ALLOWED_VOICES.has(voice)) {
    return Response.json({ error: "invalid speech request" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(OPENAI_SPEECH_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice,
        input,
        instructions:
          "Speak in clear, natural Modern Standard Arabic. Use a warm native accent, careful pronunciation, and a calm teaching pace. Do not translate or add words.",
        response_format: "mp3",
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return Response.json({ error: "speech service unavailable" }, { status: 502 });
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.error("OpenAI speech request failed", upstream.status, detail.slice(0, 500));
    return Response.json({ error: "speech generation failed" }, { status: 502 });
  }

  return new Response(await upstream.arrayBuffer(), {
    headers: {
      "content-type": "audio/mpeg",
      "cache-control": "private, max-age=3600",
    },
  });
}
