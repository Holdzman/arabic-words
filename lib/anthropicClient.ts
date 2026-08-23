import { getApiKey } from "./storage";
import { errorMessage } from "./errorMessages";
import type {
  DisambiguationCandidate,
  DisambiguateWordResponse,
  GeneratedSentence,
  GenerationErrorResponse,
  Word,
} from "./types";

export class GenerationError extends Error {
  constructor(public code: GenerationErrorResponse["error"]["code"], message: string) {
    super(message);
    this.name = "GenerationError";
  }
}

export async function generateSentence(
  targetWord: Word,
  knownWords: Word[]
): Promise<GeneratedSentence> {
  const apiKey = getApiKey();
  if (!apiKey || !apiKey.trim()) {
    throw new GenerationError("missing_api_key", errorMessage("missing_api_key"));
  }

  const response = await fetch("/api/generate-sentence", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      apiKey,
      targetWord: { text: targetWord.text, translation: targetWord.translation },
      knownWords: knownWords.map((w) => ({ text: w.text, translation: w.translation })),
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as GenerationErrorResponse;
    const code = errorData.error?.code ?? "unknown";
    throw new GenerationError(code, errorMessage(code, errorData.error?.message));
  }

  return data as GeneratedSentence;
}

export async function disambiguateWord(
  text: string,
  translationHint: string
): Promise<DisambiguationCandidate[]> {
  const apiKey = getApiKey();
  if (!apiKey || !apiKey.trim()) {
    throw new GenerationError("missing_api_key", errorMessage("missing_api_key"));
  }

  const response = await fetch("/api/disambiguate-word", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      apiKey,
      text,
      translationHint: translationHint || undefined,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as GenerationErrorResponse;
    const code = errorData.error?.code ?? "unknown";
    throw new GenerationError(code, errorMessage(code, errorData.error?.message));
  }

  return (data as DisambiguateWordResponse).candidates;
}
