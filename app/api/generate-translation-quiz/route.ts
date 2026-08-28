import type { GenerateTranslationQuizRequestBody, GenerationErrorResponse } from "@/lib/types";
import type { Language } from "@/lib/languages";
import { authErrorResponse } from "@/lib/server/authErrorResponse";
import { resolveSessionApiKey } from "@/lib/server/resolveApiKey";

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 500;
const TIMEOUT_MS = 25_000;

const LANGUAGE_NAMES: Record<Language, { genitive: string; locative: string }> = {
  ar: { genitive: "арабского", locative: "арабском" },
  it: { genitive: "итальянского", locative: "итальянском" },
  en: { genitive: "английского", locative: "английском" },
};

function resolveLanguage(input: unknown): Language {
  return input === "it" || input === "en" ? input : "ar";
}

function buildSystemPrompt(language: Language): string {
  const { genitive, locative } = LANGUAGE_NAMES[language];
  const styleClause = language === "ar" ? `литературный ${locative} (MSA)` : `естественный ${locative}`;
  return (
    `Ты преподаватель ${genitive} языка. У ученика есть личный словарь слов ${genitive} языка с переводами на ` +
    "русский (список даётся в сообщении пользователя). Напиши ОДНО естественное предложение НА РУССКОМ ЯЗЫКЕ, " +
    `которое ученик попробует самостоятельно перевести на ${locative}. Используй как можно больше слов из ` +
    "словаря по смыслу (их эквиваленты должны естественно войти в предложение при переводе), но никогда не " +
    "жертвуй естественностью ради количества слов — если использовать много слов не получается сохранить " +
    "нормальное предложение, возьми меньше слов (вплоть до одного-двух) и сделай предложение простым и " +
    `естественным. Уровень — начинающий/средний. Затем дай точный перевод этого же предложения на ${styleClause}. ` +
    "Не копируй словарную форму механически: глаголы можно и нужно естественно спрягать по лицу, числу, роду и " +
    "времени в соответствии со смыслом предложения; существительные можно использовать в единственном или " +
    "множественном числе, если множественная форма указана в словаре. Используй также обычные служебные слова (частицы, " +
    "местоимения, простые глаголы), если нужно для грамматики."
  );
}

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

  const resolved = await resolveSessionApiKey();
  if (!resolved) {
    return authErrorResponse(401, "not_authenticated");
  }
  if (!resolved.apiKey) {
    return errorResponse(400, "missing_api_key");
  }
  const apiKey = resolved.apiKey;
  const language = resolveLanguage(body.language);

  if (!Array.isArray(body.words) || body.words.length === 0) {
    return errorResponse(400, "bad_request", "words is required");
  }

  const wordsList = body.words
    .map((w) => {
      const forms = w.plural ? `${w.text}; мн. ч. ${w.plural}` : w.text;
      const partOfSpeech = w.partOfSpeech ? `; ${w.partOfSpeech}` : "";
      return `${forms} (${w.translation}${partOfSpeech})`;
    })
    .join(", ");
  const focusInstruction = body.focusWord
    ? ` Предложение обязательно должно естественно использовать слово «${body.focusWord.text}» (${body.focusWord.translation}) или его грамматическую форму.`
    : "";
  const userContent = `Словарь ученика: ${wordsList}.${focusInstruction}\nНапиши предложение на русском для перевода на ${LANGUAGE_NAMES[language].locative}.`;

  const anthropicRequestBody = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: buildSystemPrompt(language),
    messages: [{ role: "user", content: userContent }],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            russian_sentence: { type: "string" },
            target_sentence: { type: "string" },
          },
          required: ["russian_sentence", "target_sentence"],
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
    if (typeof parsed.russian_sentence !== "string" || typeof parsed.target_sentence !== "string") {
      return errorResponse(502, "malformed_response");
    }
    return Response.json({
      prompt: parsed.russian_sentence,
      answer: parsed.target_sentence,
    });
  } catch {
    return errorResponse(502, "malformed_response");
  }
}
