import type { DisambiguateWordRequestBody, GenerationErrorResponse } from "@/lib/types";

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 500;
const TIMEOUT_MS = 25_000;

const SYSTEM_PROMPT =
  "Ты преподаватель арабского языка. Пользователь вводит арабское слово (часто без огласовок — ташкиль), " +
  "которое хочет добавить в свой личный словарь для заучивания. Одна и та же цепочка согласных без огласовок " +
  "может иметь несколько разных прочтений с разными огласовками и разными значениями — например 'خبز' может быть " +
  "'خُبز' (хлеб, существительное) или 'خَبَزَ' (он пёк/испёк, глагол прошедшего времени). " +
  "Определи все правдоподобные прочтения введённого слова. Если пользователь указал подсказку с предполагаемым " +
  "переводом, используй её, чтобы понять, какое значение он скорее всего имел в виду, и поставь этот вариант первым, " +
  "но всё равно верни другие правдоподобные прочтения, если они существуют. Для каждого варианта дай: слово с " +
  "полными огласовками (ташкиль), точный перевод на русский язык, часть речи (например 'существительное', " +
  "'глагол', 'прилагательное'). Если у слова есть только одно разумное прочтение, верни ровно один вариант. " +
  "Максимум 4 варианта, отсортированных от наиболее вероятного к наименее вероятному.";

function errorResponse(status: number, code: GenerationErrorResponse["error"]["code"], message?: string) {
  const body: GenerationErrorResponse = { error: { code, message } };
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  let body: DisambiguateWordRequestBody;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "bad_request", "invalid JSON body");
  }

  const apiKey = body.apiKey?.trim();
  if (!apiKey) {
    return errorResponse(400, "missing_api_key");
  }

  const text = body.text?.trim();
  if (!text) {
    return errorResponse(400, "bad_request", "text is required");
  }

  const hint = body.translationHint?.trim();
  const userContent = hint
    ? `Слово: ${text}.\nПодсказка от пользователя (предполагаемый перевод): ${hint}.`
    : `Слово: ${text}.\nПодсказки нет — определи все правдоподобные прочтения.`;

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
            candidates: {
              type: "array",
              minItems: 1,
              maxItems: 4,
              items: {
                type: "object",
                properties: {
                  arabic: { type: "string" },
                  translation: { type: "string" },
                  part_of_speech: { type: "string" },
                },
                required: ["arabic", "translation", "part_of_speech"],
                additionalProperties: false,
              },
            },
          },
          required: ["candidates"],
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
    if (!Array.isArray(parsed.candidates) || parsed.candidates.length === 0) {
      return errorResponse(502, "malformed_response");
    }
    for (const c of parsed.candidates) {
      if (
        typeof c.arabic !== "string" ||
        typeof c.translation !== "string" ||
        typeof c.part_of_speech !== "string"
      ) {
        return errorResponse(502, "malformed_response");
      }
    }
    return Response.json({
      candidates: parsed.candidates.map((c: { arabic: string; translation: string; part_of_speech: string }) => ({
        arabic: c.arabic,
        translation: c.translation,
        partOfSpeech: c.part_of_speech,
      })),
    });
  } catch {
    return errorResponse(502, "malformed_response");
  }
}
