"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { Word } from "@/lib/types";
import type { Language } from "@/lib/languages";
import type { SrsRating } from "@/lib/srs";

function PracticeLoading() {
  return <p className="empty-state" role="status" aria-live="polite">Открываю упражнение…</p>;
}

const WordExamplePractice = dynamic(() => import("./WordExamplePractice").then((module) => module.WordExamplePractice), { loading: PracticeLoading });
const TranslationQuizPractice = dynamic(() => import("./TranslationQuizPractice").then((module) => module.TranslationQuizPractice), { loading: PracticeLoading });
const MultipleChoicePractice = dynamic(() => import("./MultipleChoicePractice").then((module) => module.MultipleChoicePractice), { loading: PracticeLoading });
const ListeningPractice = dynamic(() => import("./ListeningPractice").then((module) => module.ListeningPractice), { loading: PracticeLoading });
const WritingPractice = dynamic(() => import("./WritingPractice").then((module) => module.WritingPractice), { loading: PracticeLoading });
const GapTextPractice = dynamic(() => import("./GapTextPractice").then((module) => module.GapTextPractice), { loading: PracticeLoading });
const ScarecrowPractice = dynamic(() => import("./ScarecrowPractice").then((module) => module.ScarecrowPractice), { loading: PracticeLoading });

type Mode = "word" | "translate" | "gaps" | "listen" | "quiz" | "write" | "scarecrow";

const MODES: { id: Mode; label: string; icon: string; description: string }[] = [
  { id: "word", label: "Пример", icon: "Aa", description: "Посмотрите, как знакомое слово звучит в живом предложении." },
  { id: "translate", label: "Перевод", icon: "⇄", description: "Переведите целое предложение, составленное из слов вашего словаря." },
  { id: "gaps", label: "Пропуски", icon: "•••", description: "Впишите слова в правильной форме по смыслу связного текста." },
  { id: "listen", label: "Аудирование", icon: "◖))", description: "Прослушайте фразу, запишите её смысл и оцените свой ответ." },
  { id: "quiz", label: "Сегодня", icon: "✓", description: "Повторите слова, которые запланированы на сегодня." },
  { id: "write", label: "Письмо", icon: "✎", description: "Вспомните слово по переводу и напишите его без подсказок." },
  { id: "scarecrow", label: "Пугало", icon: "✦", description: "Ответьте на вопрос на изучаемом языке, пока не собралось пугало." },
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
              <span className="practice-mode-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
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
      {mode === "gaps" && (
        <GapTextPractice key={language} words={words} language={language} onOpenSettings={onOpenSettings} />
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
      {mode === "scarecrow" && (
        <ScarecrowPractice
          key={language}
          words={words}
          language={language}
          onAnswer={onAnswer}
          onOpenSettings={onOpenSettings}
        />
      )}
      </div>
    </section>
  );
}
