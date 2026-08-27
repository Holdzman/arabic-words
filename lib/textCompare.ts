import type { Language } from "./languages";

// Arabic combining diacritics (harakat, tanween, shadda, sukun, quranic marks),
// superscript alef, and tatweel. None of these are realistic to type on a
// standard keyboard, so they're ignored when checking a typed answer.
const ARABIC_TASHKIL_RE = /[ً-ٰٟـ]/g;

export function normalizeForCompare(text: string, language: Language): string {
  let value = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (language === "ar") {
    value = value.replace(ARABIC_TASHKIL_RE, "");
  }
  return value;
}

export function isAnswerCorrect(input: string, target: string, language: Language): boolean {
  return normalizeForCompare(input, language) === normalizeForCompare(target, language);
}
