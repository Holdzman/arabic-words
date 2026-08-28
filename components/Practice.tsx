"use client";

import { useState } from "react";
import type { Word } from "@/lib/types";
import type { Language } from "@/lib/languages";
import type { SrsRating } from "@/lib/srs";
import { WordExamplePractice } from "./WordExamplePractice";
import { TranslationQuizPractice } from "./TranslationQuizPractice";
import { MultipleChoicePractice } from "./MultipleChoicePractice";
import { ListeningPractice } from "./ListeningPractice";
import { WritingPractice } from "./WritingPractice";

type Mode = "word" | "translate" | "listen" | "quiz" | "write";

const MODES: { id: Mode; label: string; description: string }[] = [
  { id: "word", label: "Пример", description: "Посмотрите, как знакомое слово звучит в живом предложении." },
  { id: "translate", label: "Перевод", description: "Переведите целое предложение, составленное из слов вашего словаря." },
  { id: "listen", label: "Аудирование", description: "Прослушайте фразу, запишите её смысл и оцените свой ответ." },
  { id: "quiz", label: "Сегодня", description: "Повторите слова, которые запланированы на сегодня." },
  { id: "write", label: "Письмо", description: "Вспомните слово по переводу и напишите его без подсказок." },
];

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
  onAnswer: (id: string, rating: SrsRating) => void;
  onOpenSettings: () => void;
}) {
  const [mode, setMode] = useState<Mode>("word");
  const activeMode = MODES.find((item) => item.id === mode) ?? MODES[0];

  if (words.length === 0) {
    return <p className="empty-state">Сначала добавьте слова на вкладке «Слова».</p>;
  }

  return (
    <section className="practice-workspace">
      <header className="practice-heading">
        <div>
          <span className="practice-eyebrow">Тренировка</span>
          <h2>{activeMode.label}</h2>
          <p>{activeMode.description}</p>
        </div>
        <span className="practice-word-count">{words.length} слов</span>
      </header>

      <div className="practice-mode-scroll">
        <div className="practice-mode-toggle" role="tablist" aria-label="Режим упражнения">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={mode === item.id}
              className={mode === item.id ? "practice-mode-button practice-mode-active" : "practice-mode-button"}
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="practice-content">
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
      {mode === "listen" && (
        <ListeningPractice
          key={language}
          words={words}
          language={language}
          onAnswer={onAnswer}
          onOpenSettings={onOpenSettings}
        />
      )}
      {mode === "quiz" && (
        <MultipleChoicePractice key={language} words={words} language={language} onAnswer={onAnswer} />
      )}
      {mode === "write" && (
        <WritingPractice key={language} words={words} language={language} onAnswer={onAnswer} />
      )}
      </div>
    </section>
  );
}
