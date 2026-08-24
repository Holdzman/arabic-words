import { postJson, ApiError, AuthRequiredError } from "./api";
import { hasApiKeyCached } from "./account";
import { errorMessage } from "./errorMessages";
import type {
  DisambiguationCandidate,
  DisambiguateWordResponse,
  GeneratedSentence,
  GenerationErrorResponse,
  TranslationQuizResponse,
  Word,
} from "./types";

const TRANSLATION_QUIZ_WORD_CAP = 30;

export class GenerationError extends Error {
  constructor(public code: GenerationErrorResponse["error"]["code"], message: string) {
    super(message);
    this.name = "GenerationError";
  }
}

function raiseGenerationError(err: unknown): never {
  if (err instanceof AuthRequiredError) throw err;
  const data = err instanceof ApiError ? (err.data as GenerationErrorResponse) : null;
  const code = data?.error?.code ?? "unknown";
  throw new GenerationError(code, errorMessage(code, data?.error?.message));
}

export async function generateSentence(targetWord: Word, knownWords: Word[]): Promise<GeneratedSentence> {
  if (!hasApiKeyCached()) {
    throw new GenerationError("missing_api_key", errorMessage("missing_api_key"));
  }

  try {
    return await postJson<GeneratedSentence>("/api/generate-sentence", {
      targetWord: { text: targetWord.text, translation: targetWord.translation },
      knownWords: knownWords.map((w) => ({ text: w.text, translation: w.translation })),
    });
  } catch (err) {
    raiseGenerationError(err);
  }
}

export async function disambiguateWord(text: string, translationHint: string): Promise<DisambiguationCandidate[]> {
  if (!hasApiKeyCached()) {
    throw new GenerationError("missing_api_key", errorMessage("missing_api_key"));
  }

  try {
    const res = await postJson<DisambiguateWordResponse>("/api/disambiguate-word", {
      text,
      translationHint: translationHint || undefined,
    });
    return res.candidates;
  } catch (err) {
    raiseGenerationError(err);
  }
}

export async function generateTranslationQuiz(words: Word[]): Promise<TranslationQuizResponse> {
  if (!hasApiKeyCached()) {
    throw new GenerationError("missing_api_key", errorMessage("missing_api_key"));
  }

  try {
    return await postJson<TranslationQuizResponse>("/api/generate-translation-quiz", {
      words: words.slice(0, TRANSLATION_QUIZ_WORD_CAP).map((w) => ({ text: w.text, translation: w.translation })),
    });
  } catch (err) {
    raiseGenerationError(err);
  }
}
