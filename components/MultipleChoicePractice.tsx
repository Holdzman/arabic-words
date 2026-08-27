"use client";

import { useState } from "react";
import type { Word } from "@/lib/types";
import { languageConfig, type Language } from "@/lib/languages";
import { isDue } from "@/lib/srs";

type Direction = "toTranslation" | "toWord";

interface Question {
  prompt: Word;
  options: Word[];
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function buildQuestion(words: Word[], now: Date): Question | null {
  if (words.length < 4) return null;
  const due = words.filter((w) => isDue(w, now));
  const promptPool = due.length > 0 ? due : words;
  const prompt = promptPool[Math.floor(Math.random() * promptPool.length)];
  const distractors = shuffle(words.filter((w) => w.id !== prompt.id)).slice(0, 3);
  const options = shuffle([prompt, ...distractors]);
  return { prompt, options };
}

export function MultipleChoicePractice({
  words,
  language,
  onAnswer,
}: {
  words: Word[];
  language: Language;
  onAnswer: (id: string, correct: boolean) => void;
}) {
  const config = languageConfig(language);
  const [direction, setDirection] = useState<Direction>("toTranslation");
  const [question, setQuestion] = useState<Question | null>(() => buildQuestion(words, new Date()));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function nextQuestion() {
    setQuestion(buildQuestion(words, new Date()));
    setSelectedId(null);
  }

  function changeDirection(next: Direction) {
    setDirection(next);
    setQuestion(buildQuestion(words, new Date()));
    setSelectedId(null);
  }

  function pickOption(word: Word) {
    if (selectedId !== null || !question) return;
    setSelectedId(word.id);
    onAnswer(question.prompt.id, word.id === question.prompt.id);
  }

  if (words.length < 4) {
    return (
      <section>
        <p className="help-text">
          Нужно хотя бы 4 слова на этом языке, чтобы собрать варианты ответа. Сейчас {words.length}.
        </p>
      </section>
    );
  }

  const dueCount = words.filter((w) => isDue(w)).length;
  const promptText = question && (direction === "toTranslation" ? question.prompt.text : question.prompt.translation);
  const promptDir = direction === "toTranslation" ? config.dir : "auto";

  return (
    <section>
      <div className="mode-toggle">
        <button
          type="button"
          className={direction === "toTranslation" ? "pill pill-active" : "pill"}
          onClick={() => changeDirection("toTranslation")}
        >
          Слово → перевод
        </button>
        <button
          type="button"
          className={direction === "toWord" ? "pill pill-active" : "pill"}
          onClick={() => changeDirection("toWord")}
        >
          Перевод → слово
        </button>
      </div>

      <p className="help-text">
        К повторению сегодня: {dueCount} из {words.length}.
      </p>

      {question && (
        <>
          <div className="result-card">
            <p dir={promptDir} className="result-arabic">
              {promptText}
            </p>
          </div>

          <ul className="word-list">
            {question.options.map((option) => {
              const isCorrect = option.id === question.prompt.id;
              const isSelected = option.id === selectedId;
              const answered = selectedId !== null;
              let optionClass = "candidate-option";
              if (answered && isCorrect) optionClass += " quiz-option-correct";
              else if (answered && isSelected) optionClass += " quiz-option-incorrect";

              const optionText = direction === "toTranslation" ? option.translation : option.text;
              const optionDir = direction === "toTranslation" ? "auto" : config.dir;

              return (
                <li key={option.id} className="word-row">
                  <button
                    type="button"
                    className={optionClass}
                    disabled={answered}
                    onClick={() => pickOption(option)}
                  >
                    <span dir={optionDir} className="word-arabic">
                      {optionText}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {selectedId !== null && (
            <button type="button" onClick={nextQuestion}>
              Следующее слово
            </button>
          )}
        </>
      )}
    </section>
  );
}
