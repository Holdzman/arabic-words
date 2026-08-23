"use client";

import { useState } from "react";
import type { Word } from "@/lib/types";
import { WordExamplePractice } from "./WordExamplePractice";
import { TranslationQuizPractice } from "./TranslationQuizPractice";

type Mode = "word" | "translate";

export function Practice({
  words,
  onMarkLearned,
  onOpenSettings,
}: {
  words: Word[];
  onMarkLearned: (id: string) => void;
  onOpenSettings: () => void;
}) {
  const [mode, setMode] = useState<Mode>("word");

  if (words.length === 0) {
    return <p className="empty-state">Сначала добавьте слова на вкладке «Слова».</p>;
  }

  return (
    <div>
      <div className="mode-toggle">
        <button
          type="button"
          className={mode === "word" ? "pill pill-active" : "pill"}
          onClick={() => setMode("word")}
        >
          Пример со словом
        </button>
        <button
          type="button"
          className={mode === "translate" ? "pill pill-active" : "pill"}
          onClick={() => setMode("translate")}
        >
          Перевод
        </button>
      </div>

      {mode === "word" ? (
        <WordExamplePractice words={words} onMarkLearned={onMarkLearned} onOpenSettings={onOpenSettings} />
      ) : (
        <TranslationQuizPractice words={words} onOpenSettings={onOpenSettings} />
      )}
    </div>
  );
}
