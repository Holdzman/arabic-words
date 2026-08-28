import type { DisambiguateWordRequestBody, GenerationErrorResponse } from "@/lib/types";
import type { Language } from "@/lib/languages";
import { authErrorResponse } from "@/lib/server/authErrorResponse";
import { resolveSessionApiKey } from "@/lib/server/resolveApiKey";

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 900;
const TIMEOUT_MS = 25_000;

const LANGUAGE_NAMES: Record<Language, { genitive: string; locative: string }> = {
  ar: { genitive: "арабского", locative: "арабском" },
  it: { genitive: "итальянского", locative: "итальянском" },
  en: { genitive: "английского", locative: "английском" },
};

function resolveLanguage(input: unknown): Language {
  return input === "it" || input === "en" ? input : "ar";
}

const ARABIC_SYSTEM_PROMPT =
  "Ты преподаватель арабского языка. Пользователь хочет добавить слово в личный словарь и может ввести его " +
  "двумя способами. Если ввод на арабском (часто без огласовок — ташкиль): одна и та же цепочка согласных без " +
  "огласовок может иметь несколько разных прочтений с разными огласовками и разными значениями — например " +
  "'خبز' может быть 'خُبز' (хлеб, существительное) или 'خَبَزَ' (он пёк/испёк, глагол прошедшего времени). " +
  "Определи все правдоподобные прочтения. Если ввод по-русски: найди слово или слова на арабском языке, " +
  "которыми переводится введённое русское слово, и верни их с полными огласовками (ташкиль), так же, как и в " +
  "первом случае. Если пользователь указал подсказку с предполагаемым переводом (актуально только при вводе " +
  "на арабском), используй её, чтобы понять, какое значение он скорее всего имел в виду, и поставь этот вариант " +
  "первым, но всё равно верни другие правдоподобные варианты, если они существуют. Для каждого варианта дай: " +
  "слово на арабском с полными огласовками (ташкиль), точный перевод на русский язык, часть речи (например " +
  "'существительное', 'глагол', 'прилагательное') и форму множественного числа. Для существительного укажи " +
  "его наиболее употребительное множественное число на арабском с полными огласовками; для остальных частей " +
  "речи верни пустую строку. Дополнительно для каждого варианта укажи: корень слова (обычно 3-4 согласные буквы " +
  "через пробел, например 'ك ت ب'; если у слова нет ясного корня — частица, заимствование и т.п. — верни пустую " +
  "строку); для существительного и прилагательного — грамматический род ('m' для мужского, 'f' для женского, " +
  "иначе пустую строку); дополнительно только для прилагательного — форму женского рода на арабском с полными " +
  "огласовками, если она отличается от формы мужского рода (иначе пустую строку); только для глагола — форму " +
  "настоящего-будущего времени (المضارع) 3-го лица мужского рода единственного числа с полными огласовками, " +
  "например 'يَكْتُبُ' для 'كَتَبَ' (иначе пустую строку). Если разумный вариант только один, верни ровно один. " +
  "Максимум 4 варианта, отсортированных от наиболее вероятного к наименее вероятному.";

function buildLookupSystemPrompt(language: Language): string {
  const { genitive, locative } = LANGUAGE_NAMES[language];
  return (
    `Ты преподаватель ${genitive} языка и переводчик между ${locative} языком и русским. Пользователь ввёл ` +
    `одно слово или короткую фразу — она может быть написана либо на ${locative} языке, либо по-русски. ` +
    "Определи, на каком языке введён текст, и найди его точный перевод на другой язык (если введено на " +
    `${locative} — переведи на русский; если по-русски — переведи на ${locative}). Если у слова есть несколько ` +
    "распространённых значений с разными переводами, верни до 2 наиболее вероятных вариантов, отсортированных " +
    "от наиболее вероятного к менее вероятному, для каждого дай короткую уточняющую помету на русском (например " +
    "тема или контекст, поясняющий разницу в значении). Если разумное значение только одно — верни ровно один " +
    "вариант."
  );
}

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

  const resolved = await resolveSessionApiKey();
  if (!resolved) {
    return authErrorResponse(401, "not_authenticated");
  }
  if (!resolved.apiKey) {
    return errorResponse(400, "missing_api_key");
  }
  const apiKey = resolved.apiKey;
  const language = resolveLanguage(body.language);

  const text = body.text?.trim();
  if (!text) {
    return errorResponse(400, "bad_request", "text is required");
  }

  const hint = body.translationHint?.trim();
  const userContent = hint
    ? `Ввод пользователя: ${text}.\nПодсказка (предполагаемый перевод, актуально только при вводе на арабском): ${hint}.`
    : `Ввод пользователя: ${text}.`;

  const anthropicRequestBody = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: language === "ar" ? ARABIC_SYSTEM_PROMPT : buildLookupSystemPrompt(language),
    messages: [{ role: "user", content: userContent }],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            candidates: {
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
    const cap = language === "ar" ? 4 : 2;
    return Response.json({
      candidates: parsed.candidates.slice(0, cap).map(
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
          partOfSpeech: c.note,
          plural: language === "ar" && c.plural.trim() ? c.plural.trim() : undefined,
          root: language === "ar" && c.root.trim() ? c.root.trim() : undefined,
          gender: language === "ar" && (c.gender.trim() === "m" || c.gender.trim() === "f") ? c.gender.trim() : undefined,
          feminineForm: language === "ar" && c.feminineForm.trim() ? c.feminineForm.trim() : undefined,
          presentTense: language === "ar" && c.presentTense.trim() ? c.presentTense.trim() : undefined,
        })
      ),
    });
  } catch {
    return errorResponse(502, "malformed_response");
  }
}
