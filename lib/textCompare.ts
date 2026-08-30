import type { Language } from "./languages";
import { stripLeadingArticle } from "./articles";

// Arabic combining diacritics (harakat, tanween, shadda, sukun, quranic marks),
// superscript alef, and tatweel. None of these are realistic to type on a
// standard keyboard, so they're ignored when checking a typed answer.
const ARABIC_TASHKIL_RE = /[ً-ٰٟـ]/g;

export function normalizeForCompare(text: string, language: Language): string {
  // The dictionary word may carry a specific article ("il conto") while the
  // learner types the same core word with a different one ("un conto") —
  // that's still the right vocabulary item, so ignore the article here too.
  let value = stripLeadingArticle(text, language).toLowerCase().replace(/\s+/g, " ").trim();
  if (language === "ar") {
    value = value.replace(ARABIC_TASHKIL_RE, "");
  }
  return value;
}

export function isAnswerCorrect(input: string, target: string, language: Language): boolean {
  return normalizeForCompare(input, language) === normalizeForCompare(target, language);
}
