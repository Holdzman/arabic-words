import type { Language } from "./languages";

const LEADING_ARTICLE_RE: Partial<Record<Language, RegExp>> = {
  it: /^(l['’]\s*|gli\s+|le\s+|lo\s+|la\s+|il\s+|i\s+|un['’]\s*|una\s+|uno\s+|un\s+)/i,
  en: /^(the\s+|an?\s+)/i,
  ar: /^ال/,
};

// Different dictionary entries (or a learner's typed answer) can be the same
// underlying word with a different article — "un conto" vs "il conto",
// "a cat" vs "the cat", "كتاب" vs "الكتاب". Comparing the word with its
// leading article stripped treats these as the same core vocabulary item.
export function stripLeadingArticle(text: string, language: Language): string {
  const article = LEADING_ARTICLE_RE[language];
  return article ? text.trim().replace(article, "").trim() : text.trim();
}
