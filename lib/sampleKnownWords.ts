import type { Word } from "./types";
import { isWellKnown } from "./srs";

export function sampleKnownWords(words: Word[], excludeId: string, limit = 6): Word[] {
  const candidates = words.filter((w) => isWellKnown(w) && w.id !== excludeId);
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit);
}
