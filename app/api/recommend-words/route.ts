import type { RecommendWordsRequestBody, GenerationErrorResponse } from "@/lib/types";
import type { Language } from "@/lib/languages";
import { authErrorResponse } from "@/lib/server/authErrorResponse";
import { resolveSessionApiKey } from "@/lib/server/resolveApiKey";

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 2000;
const TIMEOUT_MS = 25_000;
const MAX_COUNT = 10;
const MAX_CONTEXT_WORDS = 80;

const LANGUAGE_NAMES: Record<Language, { genitive: string; locative: string }> = {
  ar: { genitive: "арабского", locative: "арабском" },
  it: { genitive: "итальянского", locative: "итальянском" },
  en: { genitive: "английского", locative: "английском" },
};

function resolveLanguage(input: unknown): Language {
  return input === "it" || input === "en" ? input : "ar";
}

function buildSystemPrompt(language: Language, count: number): string {
  const { genitive, locative } = LANGUAGE_NAMES[language];
  const arabicFields =
    language === "ar"
      ? " Для каждого слова также дай: форму множественного числа для существительного (иначе пустую строку), " +
        "корень слова (обычно 3-4 согласные буквы через пробел, иначе пустую строку), грамматический род ('m' " +
        "для мужского, 'f' для женского) для существительного и прилагательного (иначе пустую строку), форму " +
        "женского рода только для прилагательного, если она отличается от мужской (иначе пустую строку), форму " +
        "настоящего-будущего времени (المضارع) 3-го лица мужского рода единственного числа только для глагола " +
        "(иначе пустую строку). Слово дай с полными огласовками (ташкиль)."
      : "";
  return (
    `Ты преподаватель ${genitive} языка и куратор личного словаря ученика в приложении для изучения языков. ` +
    "У ученика есть список слов, которые он уже добавил и учит; список в сообщении пользователя дан в порядке " +
    "от самых недавно добавленных к самым старым. Слова в начале списка отражают текущий интерес ученика — " +
    "учитывай их сильнее при выборе новых слов; более старые слова — это дополнительный фон. Проанализируй " +
    "список, определи темы и категории слов ученика и предложи новые слова по этим темам, которые было бы " +
    `логично добавить следующими. Если список слов пуст или слишком мал, чтобы определить тематику, — вместо ` +
    `этого предложи самые частотные и полезные слова ${genitive} языка для начинающего/среднего уровня, не ` +
    "привязываясь к теме. В сообщении пользователя также может быть список слов, которые нельзя предлагать " +
    "(они уже есть в словаре ученика или уже были показаны ранее в этой сессии) — никогда не включай ни одно " +
    `из этих слов в ответ, сравнивай точно по написанию. Для каждого слова дай: слово на ${locative} языке, ` +
    `точный перевод на русский язык, короткую помету на русском (часть речи или тема).${arabicFields} Верни ` +
    `ровно ${count} слов, если это возможно, отсортированных от наиболее рекомендуемого к менее рекомендуемому.`
  );
}

function errorResponse(status: number, code: GenerationErrorResponse["error"]["code"], message?: string) {
  const body: GenerationErrorResponse = { error: { code, message } };
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  let body: RecommendWordsRequestBody;
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
  const count = Math.min(Math.max(1, Number(body.count) || MAX_COUNT), MAX_COUNT);

  const existingWords = Array.isArray(body.existingWords) ? body.existingWords.slice(0, MAX_CONTEXT_WORDS) : [];
  const excludeWords = Array.isArray(body.excludeWords) ? body.excludeWords : [];
  const excludedTexts = Array.from(
    new Set(
      [...existingWords.map((w) => w.text?.trim()), ...excludeWords.map((t) => t?.trim())].filter(
        (t): t is string => Boolean(t)
      )
    )
  );

  const wordsList = existingWords
    .filter((w) => w.text?.trim())
    .map((w) => `${w.text} (${w.translation})`)
    .join(", ");
  const excludeList = excludedTexts.join(", ");
  const userContent =
    (wordsList ? `Слова ученика от новых к старым: ${wordsList}.\n` : "У ученика пока нет слов в словаре.\n") +
    (excludeList ? `Не предлагай эти слова (уже в словаре или уже показаны): ${excludeList}.\n` : "") +
    `Предложи ${count} новых слов.`;

  const anthropicRequestBody = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: buildSystemPrompt(language, count),
    messages: [{ role: "user", content: userContent }],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  word: { type: "string" },
                  translation: { type: "string" },
                  note: { type: "string" },
                  plural: { type: "string" },
                  root: { type: "string" },
                  gender: { type: "string" },
                  feminineForm: { type: "string" },
                  presentTense: { type: "string" },
                },
                required: ["word", "translation", "note", "plural", "root", "gender", "feminineForm", "presentTense"],
                additionalProperties: false,
              },
            },
          },
          required: ["recommendations"],
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
    if (!Array.isArray(parsed.recommendations)) {
      return errorResponse(502, "malformed_response");
    }
    for (const c of parsed.recommendations) {
      if (
        typeof c.word !== "string" ||
        typeof c.translation !== "string" ||
        typeof c.note !== "string" ||
        typeof c.plural !== "string" ||
        typeof c.root !== "string" ||
        typeof c.gender !== "string" ||
        typeof c.feminineForm !== "string" ||
        typeof c.presentTense !== "string"
      ) {
        return errorResponse(502, "malformed_response");
      }
    }

    const excludedSet = new Set(excludedTexts);
    const seen = new Set<string>();
    const recommendations = parsed.recommendations
      .filter((c: { word: string }) => {
        const key = c.word.trim();
        if (!key || excludedSet.has(key) || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, count)
      .map(
        (c: {
          word: string;
          translation: string;
          note: string;
          plural: string;
          root: string;
          gender: string;
          feminineForm: string;
          presentTense: string;
        }) => ({
          text: c.word,
          translation: c.translation,
          partOfSpeech: c.note.trim() ? c.note.trim() : undefined,
          plural: language === "ar" && c.plural.trim() ? c.plural.trim() : undefined,
          root: language === "ar" && c.root.trim() ? c.root.trim() : undefined,
          gender: language === "ar" && (c.gender.trim() === "m" || c.gender.trim() === "f") ? c.gender.trim() : undefined,
          feminineForm: language === "ar" && c.feminineForm.trim() ? c.feminineForm.trim() : undefined,
          presentTense: language === "ar" && c.presentTense.trim() ? c.presentTense.trim() : undefined,
        })
      );

    return Response.json({ recommendations });
  } catch {
    return errorResponse(502, "malformed_response");
  }
}
