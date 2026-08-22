import type { Word } from "./types";

const WORDS_KEY = "arabicwords.words.v1";
const API_KEY_KEY = "arabicwords.apiKey.v1";

export function getWords(): Word[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(WORDS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Word[];
  } catch {
    return [];
  }
}

function saveWords(words: Word[]): Word[] {
  window.localStorage.setItem(WORDS_KEY, JSON.stringify(words));
  return words;
}

export function addWord(text: string, translation: string): Word[] {
  const word: Word = {
    id: crypto.randomUUID(),
    text,
    translation,
    isLearned: false,
    dateAdded: new Date().toISOString(),
  };
  return saveWords([word, ...getWords()]);
}

export function toggleLearned(id: string): Word[] {
  const words = getWords().map((w) =>
    w.id === id ? { ...w, isLearned: !w.isLearned } : w
  );
  return saveWords(words);
}

export function deleteWord(id: string): Word[] {
  return saveWords(getWords().filter((w) => w.id !== id));
}

export function getApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(API_KEY_KEY);
}

export function saveApiKey(key: string): void {
  window.localStorage.setItem(API_KEY_KEY, key);
}

export function deleteApiKey(): void {
  window.localStorage.removeItem(API_KEY_KEY);
}
