import type { Word } from "./types";

const LEGACY_WORDS_KEY = "arabicwords.words.v1";
const LEGACY_API_KEY_KEY = "arabicwords.apiKey.v1";

export function readLegacyWords(): Word[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(LEGACY_WORDS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearLegacyLocalData(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LEGACY_WORDS_KEY);
  window.localStorage.removeItem(LEGACY_API_KEY_KEY);
}
