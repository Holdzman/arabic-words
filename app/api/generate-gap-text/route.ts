import type { GenerateGapTextRequestBody, GenerationErrorResponse } from "@/lib/types";
import type { Language } from "@/lib/languages";
import { authErrorResponse } from "@/lib/server/authErrorResponse";
import { resolveSessionApiKey } from "@/lib/server/resolveApiKey";

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-haiku-4-5";
const TIMEOUT_MS = 25_000;

const LANGUAGE_NAMES: Record<Language, string> = {
  ar: "арабском литературном языке (MSA)",
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
  let body: GenerateGapTextRequestBody;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "bad_request", "invalid JSON body");
  }

  const resolved = await resolveSessionApiKey();
  if (!resolved) return authErrorResponse(401, "not_authenticated");
  if (!resolved.apiKey) return errorResponse(400, "missing_api_key");
  if (!Array.isArray(body.words) || body.words.length < 3) {
    return errorResponse(400, "bad_request", "at least three words are required");
  }

  const language = resolveLanguage(body.language);
  const wordsList = body.words
    .map((word) => {
      const forms = [word.text, word.plural, word.feminineForm, word.presentTense].filter(Boolean).join(" / ");
      return `${forms} (${word.translation}${word.partOfSpeech ? `; ${word.partOfSpeech}` : ""})`;
    })
    .join(", ");

  const system =
    `Ты преподаватель иностранного языка. Создай короткий связный текст из 3–4 простых предложений на ${LANGUAGE_NAMES[language]} ` +
    "для ученика начального/среднего уровня. Выбери ровно 3 разных содержательных слова из словаря ученика и преврати их в пропуски. " +
    "Слова должны быть употреблены естественно и при необходимости изменены по лицу, числу, роду или времени. " +
    "Особенно полезны спряжённые глаголы и формы существительных/прилагательных. Не делай пропусками артикли, предлоги и частицы. " +
    "Раздели текст на три фрагмента before: каждый заканчивается прямо перед очередным пропуском. Поле answer содержит только пропущенную " +
    "грамматическую форму без пунктуации, dictionary_form — исходную словарную форму, translation — короткую русскую подсказку. " +
    "Поле ending содержит остаток текста после третьего пропуска. Russian_translation — полный естественный перевод всего текста на русский.";

  const anthropicRequestBody = {
    model: MODEL,
    max_tokens: 1200,
    system,
    messages: [{ role: "user", content: `Словарь ученика: ${wordsList}.` }],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            blanks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  before: { type: "string" },
                  answer: { type: "string" },
                  dictionary_form: { type: "string" },
                  translation: { type: "string" },
                },
                required: ["before", "answer", "dictionary_form", "translation"],
                additionalProperties: false,
              },
            },
            ending: { type: "string" },
            russian_translation: { type: "string" },
          },
          required: ["blanks", "ending", "russian_translation"],
          additionalProperties: false,
        },
      },
    },
  };

  let upstream: Response;
  try {
    upstream = await fetch(ANTHROPIC_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": resolved.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(anthropicRequestBody),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return errorResponse(502, "network_error");
  }

  const data = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    const upstreamMessage = data?.error?.message as string | undefined;
    if (upstream.status === 401) return errorResponse(401, "invalid_api_key");
    if (upstream.status === 403) return errorResponse(403, "forbidden");
    if (upstream.status === 429) return errorResponse(429, "rate_limited");
    if (upstream.status === 400) return errorResponse(400, "bad_request", upstreamMessage);
    return errorResponse(502, upstream.status >= 500 ? "server_overloaded" : "unknown");
  }
  if (data?.stop_reason === "refusal") return errorResponse(422, "refusal");
  if (data?.stop_reason === "max_tokens") return errorResponse(422, "truncated");

  const text = data?.content?.find((block: { type: string }) => block.type === "text")?.text;
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.blanks) || parsed.blanks.length !== 3 || typeof parsed.ending !== "string") {
      return errorResponse(502, "malformed_response");
    }
    return Response.json({
      blanks: parsed.blanks.map((blank: Record<string, unknown>) => ({
        before: String(blank.before ?? ""),
        answer: String(blank.answer ?? ""),
        dictionaryForm: String(blank.dictionary_form ?? ""),
        translation: String(blank.translation ?? ""),
      })),
      ending: parsed.ending,
      translation: String(parsed.russian_translation ?? ""),
    });
  } catch {
    return errorResponse(502, "malformed_response");
  }
}
