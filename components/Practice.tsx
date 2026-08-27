"use client";

import { useState } from "react";
import type { Word } from "@/lib/types";
import type { Language } from "@/lib/languages";
import { WordExamplePractice } from "./WordExamplePractice";
import { TranslationQuizPractice } from "./TranslationQuizPractice";
import { MultipleChoicePractice } from "./MultipleChoicePractice";

type Mode = "word" | "translate" | "quiz";

export function Practice({
  words,
  language,
  onMarkLearned,
  onAnswer,
  onOpenSettings,
}: {
  words: Word[];
  language: Language;
  onMarkLearned: (id: string) => void;
  onAnswer: (id: string, correct: boolean) => void;
  onOpenSettings: () => void;
}) {
  const [mode, setMode] = useState<Mode>("word");

  if (words.length === 0) {
    return <p className="empty-state">Сначала добавьте слова на вкладке «Слова».</p>;
  }

  return (
    <section>
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
        <button
          type="button"
          className={mode === "quiz" ? "pill pill-active" : "pill"}
          onClick={() => setMode("quiz")}
        >
          Сегодня
        </button>
      </div>

      {mode === "word" && (
        <WordExamplePractice
          key={language}
          words={words}
          language={language}
          onMarkLearned={onMarkLearned}
          onOpenSettings={onOpenSettings}
        />
      )}
      {mode === "translate" && (
        <TranslationQuizPractice key={language} words={words} language={language} onOpenSettings={onOpenSettings} />
      )}
      {mode === "quiz" && (
        <MultipleChoicePractice key={language} words={words} language={language} onAnswer={onAnswer} />
      )}
    </section>
  );
}
