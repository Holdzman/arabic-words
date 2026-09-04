import type { GenerateScarecrowQuestionRequestBody, GenerationErrorResponse } from "@/lib/types";
import type { Language } from "@/lib/languages";
import { authErrorResponse } from "@/lib/server/authErrorResponse";
import { resolveSessionApiKey } from "@/lib/server/resolveApiKey";

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-haiku-4-5";
const TIMEOUT_MS = 25_000;

const LANGUAGE_NAMES: Record<Language, string> = {
  ar: "литературном арабском языке (MSA)",
  it: "естественном итальянском языке",
  en: "естественном английском языке",
};

function resolveLanguage(input: unknown): Language {
  return input === "it" || input === "en" ? input : "ar";
}

function errorResponse(status: number, code: GenerationErrorResponse["error"]["code"], message?: string) {
  return Response.json({ error: { code, message } } satisfies GenerationErrorResponse, { status });
}

export async function POST(request: Request) {
  let body: GenerateScarecrowQuestionRequestBody;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "bad_request", "invalid JSON body");
  }

  const resolved = await resolveSessionApiKey();
  if (!resolved) return authErrorResponse(401, "not_authenticated");
  if (!resolved.apiKey) return errorResponse(400, "missing_api_key");

  const language = resolveLanguage(body.language);
  const text = body.targetWord?.text?.trim();
  const translation = body.targetWord?.translation?.trim();
  if (!text || !translation || text.length > 200 || translation.length > 300) {
    return errorResponse(400, "bad_request", "targetWord is required");
  }

  const system =
    `Ты преподаватель языка. Составь один короткий и однозначный вопрос на ${LANGUAGE_NAMES[language]}, ответом ` +
    "на который будет заданное словарное слово. Вопрос должен описывать значение слова через простую жизненную ситуацию, " +
    "как в примере: «Чем режут еду на кухне?» — ответ «нож». Не используй в вопросе само слово-ответ, его однокоренные " +
    "формы, перевод на русский или подсказку в скобках. Не делай вопросом просьбу перевести слово. Уровень начинающий/средний. " +
    "Если дан глагол или прилагательное, задай естественный вопрос, ответом на который может быть его словарная форма.";

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(ANTHROPIC_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": resolved.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        system,
        messages: [{
          role: "user",
          content: `Слово-ответ: ${text}\nЗначение по-русски: ${translation}\nЧасть речи: ${body.targetWord.partOfSpeech ?? "не указана"}`,
        }],
        output_config: {
          format: {
            type: "json_schema",
            schema: {
              type: "object",
              properties: { question: { type: "string" } },
              required: ["question"],
              additionalProperties: false,
            },
          },
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return errorResponse(502, "network_error");
  }

  const data = await upstreamResponse.json().catch(() => null);
  if (!upstreamResponse.ok) {
    const message = data?.error?.message as string | undefined;
    if (upstreamResponse.status === 401) return errorResponse(401, "invalid_api_key");
    if (upstreamResponse.status === 403) return errorResponse(403, "forbidden");
    if (upstreamResponse.status === 429) return errorResponse(429, "rate_limited");
    if (upstreamResponse.status === 400) return errorResponse(400, "bad_request", message);
    return errorResponse(502, upstreamResponse.status >= 500 ? "server_overloaded" : "unknown");
  }
  if (data?.stop_reason === "refusal") return errorResponse(422, "refusal");
  if (data?.stop_reason === "max_tokens") return errorResponse(422, "truncated");

  const textBlock = data?.content?.find((block: { type: string }) => block.type === "text");
  try {
    const parsed = JSON.parse(textBlock?.text ?? "");
    if (typeof parsed.question !== "string" || !parsed.question.trim()) {
      return errorResponse(502, "malformed_response");
    }
    return Response.json({ question: parsed.question.trim() });
  } catch {
    return errorResponse(502, "malformed_response");
  }
}
