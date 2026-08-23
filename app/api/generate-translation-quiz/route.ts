import type { GenerateTranslationQuizRequestBody, GenerationErrorResponse } from "@/lib/types";

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 500;
const TIMEOUT_MS = 25_000;

const SYSTEM_PROMPT =
  "Ты преподаватель арабского языка. У ученика есть личный словарь арабских слов с переводами на русский " +
  "(список даётся в сообщении пользователя). Напиши ОДНО естественное предложение НА РУССКОМ ЯЗЫКЕ, которое " +
  "ученик попробует самостоятельно перевести на арабский. Используй как можно больше слов из словаря по смыслу " +
  "(их арабские эквиваленты должны естественно войти в предложение при переводе), но никогда не жертвуй " +
  "естественностью ради количества слов — если использовать много слов не получается сохранить нормальное " +
  "предложение, возьми меньше слов (вплоть до одного-двух) и сделай предложение простым и естественным. " +
  "Уровень — начинающий/средний. Затем дай точный перевод этого же предложения на литературный арабский (MSA), " +
  "используя арабские формы слов из словаря там, где они использованы, плюс обычные служебные слова " +
  "(частицы, местоимения, простые глаголы), если нужно для грамматики.";

function errorResponse(status: number, code: GenerationErrorResponse["error"]["code"], message?: string) {
  const body: GenerationErrorResponse = { error: { code, message } };
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  let body: GenerateTranslationQuizRequestBody;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "bad_request", "invalid JSON body");
  }

  const apiKey = body.apiKey?.trim();
  if (!apiKey) {
    return errorResponse(400, "missing_api_key");
  }

  if (!Array.isArray(body.words) || body.words.length === 0) {
    return errorResponse(400, "bad_request", "words is required");
  }

  const wordsList = body.words.map((w) => `${w.text} (${w.translation})`).join(", ");
  const userContent = `Словарь ученика: ${wordsList}.\nНапиши предложение на русском для перевода на арабский.`;

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
            russian_sentence: { type: "string" },
            arabic_sentence: { type: "string" },
          },
          required: ["russian_sentence", "arabic_sentence"],
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
    if (typeof parsed.russian_sentence !== "string" || typeof parsed.arabic_sentence !== "string") {
      return errorResponse(502, "malformed_response");
    }
    return Response.json({
      russianSentence: parsed.russian_sentence,
      arabicSentence: parsed.arabic_sentence,
    });
  } catch {
    return errorResponse(502, "malformed_response");
  }
}
