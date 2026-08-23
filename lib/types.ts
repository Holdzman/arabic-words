export interface Word {
  id: string;
  text: string;
  translation: string;
  isLearned: boolean;
  dateAdded: string;
}

export interface GeneratedSentence {
  arabicSentence: string;
  russianTranslation: string;
}

export type GenerationErrorCode =
  | "missing_api_key"
  | "invalid_api_key"
  | "forbidden"
  | "rate_limited"
  | "server_overloaded"
  | "bad_request"
  | "network_error"
  | "refusal"
  | "truncated"
  | "malformed_response"
  | "unknown";

export interface GenerationErrorResponse {
  error: {
    code: GenerationErrorCode;
    message?: string;
  };
}

export interface GenerateSentenceRequestBody {
  apiKey: string;
  targetWord: { text: string; translation: string };
  knownWords: { text: string; translation: string }[];
}

export interface DisambiguationCandidate {
  arabic: string;
  translation: string;
  partOfSpeech: string;
}

export interface DisambiguateWordRequestBody {
  apiKey: string;
  text: string;
  translationHint?: string;
}

export interface DisambiguateWordResponse {
  candidates: DisambiguationCandidate[];
}
