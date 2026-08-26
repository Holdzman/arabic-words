export type Language = "ar" | "it" | "en";

export interface LanguageConfig {
  id: Language;
  label: string;
  dir: "rtl" | "ltr";
  placeholder: string;
  supportsDisambiguation: boolean;
  genitive: string;
  locative: string;
}

export const LANGUAGES: LanguageConfig[] = [
  {
    id: "ar",
    label: "Арабский",
    dir: "rtl",
    placeholder: "Арабское слово",
    supportsDisambiguation: true,
    genitive: "арабского",
    locative: "арабском",
  },
  {
    id: "it",
    label: "Итальянский",
    dir: "ltr",
    placeholder: "Итальянское слово",
    supportsDisambiguation: false,
    genitive: "итальянского",
    locative: "итальянском",
  },
  {
    id: "en",
    label: "Английский",
    dir: "ltr",
    placeholder: "Английское слово",
    supportsDisambiguation: false,
    genitive: "английского",
    locative: "английском",
  },
];

export function languageConfig(id: Language): LanguageConfig {
  return LANGUAGES.find((l) => l.id === id) ?? LANGUAGES[0];
}
