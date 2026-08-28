export interface ArabicWordFields {
  text: string;
  plural?: string;
  gender?: "m" | "f";
  feminineForm?: string;
  presentTense?: string;
}

const GENDER_LABEL: Record<"m" | "f", string> = { m: "м", f: "ж" };

export function arabicHeadline(word: ArabicWordFields): string {
  const genderSuffix = word.gender ? ` (${GENDER_LABEL[word.gender]})` : "";
  const inflection = word.plural || word.feminineForm || word.presentTense;
  return `${word.text}${genderSuffix}${inflection ? ` / ${inflection}` : ""}`;
}
