import { postJson, ApiError, AuthRequiredError } from "./api";
import { hasApiKeyCached } from "./account";
import { errorMessage } from "./errorMessages";
import type {
  DisambiguationCandidate,
  DisambiguateWordResponse,
  GeneratedSentence,
  GenerationErrorResponse,
  GapTextResponse,
  TranslationQuizResponse,
  Word,
} from "./types";
import type { Language } from "./languages";

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

export async function generateSentence(
  language: Language,
  targetWord: Word,
  knownWords: Word[]
): Promise<GeneratedSentence> {
  if (!hasApiKeyCached()) {
    throw new GenerationError("missing_api_key", errorMessage("missing_api_key"));
  }

  try {
    return await postJson<GeneratedSentence>("/api/generate-sentence", {
      language,
      targetWord: { text: targetWord.text, translation: targetWord.translation },
      knownWords: knownWords.map((w) => ({ text: w.text, translation: w.translation })),
    });
  } catch (err) {
    raiseGenerationError(err);
  }
}

export async function disambiguateWord(
  language: Language,
  text: string,
  translationHint: string
): Promise<DisambiguationCandidate[]> {
  if (!hasApiKeyCached()) {
    throw new GenerationError("missing_api_key", errorMessage("missing_api_key"));
  }

  try {
    const res = await postJson<DisambiguateWordResponse>("/api/disambiguate-word", {
      language,
      text,
      translationHint: translationHint || undefined,
    });
    return res.candidates;
  } catch (err) {
    raiseGenerationError(err);
  }
}

export async function generateTranslationQuiz(
  language: Language,
  words: Word[],
  focusWord?: Word
): Promise<TranslationQuizResponse> {
  if (!hasApiKeyCached()) {
    throw new GenerationError("missing_api_key", errorMessage("missing_api_key"));
  }

  try {
    const orderedWords = focusWord
      ? [focusWord, ...words.filter((word) => word.id !== focusWord.id)]
      : words;
    return await postJson<TranslationQuizResponse>("/api/generate-translation-quiz", {
      language,
      words: orderedWords.slice(0, TRANSLATION_QUIZ_WORD_CAP).map((w) => ({
        text: w.text,
        translation: w.translation,
        plural: w.plural,
        partOfSpeech: w.partOfSpeech,
      })),
      focusWord: focusWord
        ? {
            text: focusWord.text,
            translation: focusWord.translation,
            plural: focusWord.plural,
            partOfSpeech: focusWord.partOfSpeech,
          }
        : undefined,
    });
  } catch (err) {
    raiseGenerationError(err);
  }
}

export async function generateGapText(language: Language, words: Word[]): Promise<GapTextResponse> {
  if (!hasApiKeyCached()) {
    throw new GenerationError("missing_api_key", errorMessage("missing_api_key"));
  }

  try {
    return await postJson<GapTextResponse>("/api/generate-gap-text", {
      language,
      words: words.slice(0, TRANSLATION_QUIZ_WORD_CAP).map((word) => ({
        text: word.text,
        translation: word.translation,
        plural: word.plural,
        partOfSpeech: word.partOfSpeech,
        feminineForm: word.feminineForm,
        presentTense: word.presentTense,
      })),
    });
  } catch (err) {
    raiseGenerationError(err);
  }
}
