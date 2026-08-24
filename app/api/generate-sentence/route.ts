import type { GenerateSentenceRequestBody, GenerationErrorResponse } from "@/lib/types";
import { authErrorResponse } from "@/lib/server/authErrorResponse";
import { resolveSessionApiKey } from "@/lib/server/resolveApiKey";

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 400;
const TIMEOUT_MS = 25_000;

const SYSTEM_PROMPT =
  "Ты преподаватель арабского языка. Дано одно целевое арабское слово и список слов, которые ученик уже знает. " +
  "Напиши ОДНО естественное, грамматически верное предложение на литературном арабском (MSA), используя целевое слово " +
  "и, где это уместно, некоторые из уже известных слов. Уровень — начинающий/средний, одно короткое предложение. " +
  "Затем дай точный перевод этого предложения на русский язык. Не используй арабскую лексику за пределами целевого " +
  "слова и списка известных слов, кроме базовых служебных слов (частицы, местоимения, глагол 'быть'), необходимых для грамматики.";

function errorResponse(status: number, code: GenerationErrorResponse["error"]["code"], message?: string) {
  const body: GenerationErrorResponse = { error: { code, message } };
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  let body: GenerateSentenceRequestBody;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "bad_request", "invalid JSON body");
  }

  const resolved = await resolveSessionApiKey();
  if (!resolved) {
    return authErrorResponse(401, "not_authenticated");
  }
  if (!resolved.apiKey) {
    return errorResponse(400, "missing_api_key");
  }
  const apiKey = resolved.apiKey;

  const knownWordsList = body.knownWords
    .map((w) => `${w.text} (${w.translation})`)
    .join(", ");

  const userContent = knownWordsList
    ? `Целевое слово: ${body.targetWord.text} (${body.targetWord.translation}).\nУже известные слова (используй некоторые, если это уместно): ${knownWordsList}.\nНапиши одно пример-предложение с целевым словом.`
    : `Целевое слово: ${body.targetWord.text} (${body.targetWord.translation}).\nИзвестных слов пока нет.\nНапиши одно пример-предложение с этим словом.`;

  const anthropicRequestBody = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            arabic_sentence: { type: "string" },
            russian_translation: { type: "string" },
          },
          required: ["arabic_sentence", "russian_translation"],
          additionalProperties: false,
        },
      },
    },
  };

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(ANTHROPIC_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(anthropicRequestBody),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return errorResponse(502, "network_error");
  }

  const data = await upstreamResponse.json().catch(() => null);

  if (!upstreamResponse.ok) {
    const upstreamMessage = data?.error?.message as string | undefined;
    switch (upstreamResponse.status) {
      case 401:
        return errorResponse(401, "invalid_api_key");
      case 403:
        return errorResponse(403, "forbidden");
      case 429:
        return errorResponse(429, "rate_limited");
      case 400:
        return errorResponse(400, "bad_request", upstreamMessage);
      default:
        if (upstreamResponse.status >= 500) {
          return errorResponse(502, "server_overloaded");
        }
        return errorResponse(502, "unknown");
    }
  }

  if (data?.stop_reason === "refusal") {
    return errorResponse(422, "refusal");
  }
  if (data?.stop_reason === "max_tokens") {
    return errorResponse(422, "truncated");
  }

  const textBlock = data?.content?.find((block: { type: string }) => block.type === "text");
  if (!textBlock?.text) {
    return errorResponse(502, "malformed_response");
  }

  try {
    const parsed = JSON.parse(textBlock.text);
    if (typeof parsed.arabic_sentence !== "string" || typeof parsed.russian_translation !== "string") {
      return errorResponse(502, "malformed_response");
    }
    return Response.json({
      arabicSentence: parsed.arabic_sentence,
      russianTranslation: parsed.russian_translation,
    });
  } catch {
    return errorResponse(502, "malformed_response");
  }
}
