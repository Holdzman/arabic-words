import type { Word } from "./types";

export function sampleKnownWords(words: Word[], excludeId: string, limit = 6): Word[] {
  const candidates = words.filter((w) => w.isLearned && w.id !== excludeId);
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit);
}
