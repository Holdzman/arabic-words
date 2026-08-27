import type { Language } from "./languages";
import type { SrsReview } from "./srs";

export interface Word {
  id: string;
  text: string;
  translation: string;
  isLearned: boolean;
  dateAdded: string;
  language: Language;
  srsInterval: number;
  srsEase: number;
  srsDue: string;
  srsReps: number;
  srsHistory: SrsReview[];
}

export interface GeneratedSentence {
  sentence: string;
  translation: string;
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
  language: Language;
  targetWord: { text: string; translation: string };
  knownWords: { text: string; translation: string }[];
}

export interface DisambiguationCandidate {
  text: string;
  translation: string;
  partOfSpeech: string;
}

export interface DisambiguateWordRequestBody {
  language: Language;
  text: string;
  translationHint?: string;
}

export interface DisambiguateWordResponse {
  candidates: DisambiguationCandidate[];
}

export interface TranslationQuizResponse {
  prompt: string;
  answer: string;
}

export interface GenerateTranslationQuizRequestBody {
  language: Language;
  words: { text: string; translation: string }[];
}

// --- Accounts ---

export type AuthErrorCode =
  | "not_authenticated"
  | "invalid_credentials"
  | "username_taken"
  | "weak_password"
  | "invalid_username"
  | "invalid_signup_code"
  | "bad_request"
  | "unknown";

export interface AuthErrorResponse {
  error: {
    code: AuthErrorCode;
    message?: string;
  };
}

export interface SignupRequestBody {
  username: string;
  password: string;
  signupCode: string;
  importWords?: Word[];
}

export interface SignupResponse {
  username: string;
}

export interface LoginRequestBody {
  username: string;
  password: string;
}

export interface LoginResponse {
  username: string;
}

export interface SessionResponse {
  authenticated: boolean;
  username?: string;
}

export interface WordsResponse {
  words: Word[];
}

export interface SaveWordsRequestBody {
  words: Word[];
}

export interface ApiKeyStatusResponse {
  hasApiKey: boolean;
}

export interface SaveApiKeyRequestBody {
  apiKey: string;
}
