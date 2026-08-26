"use client";

import { useState } from "react";
import type { Word } from "@/lib/types";
import { languageConfig, type Language } from "@/lib/languages";

type Direction = "toTranslation" | "toWord";

interface Question {
  prompt: Word;
  options: Word[];
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function buildQuestion(words: Word[]): Question | null {
  if (words.length < 4) return null;
  const shuffled = shuffle(words);
  const prompt = shuffled[0];
  const options = shuffle(shuffled.slice(0, 4));
  return { prompt, options };
}

export function MultipleChoicePractice({ words, language }: { words: Word[]; language: Language }) {
  const config = languageConfig(language);
  const [direction, setDirection] = useState<Direction>("toTranslation");
  const [question, setQuestion] = useState<Question | null>(() => buildQuestion(words));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function nextQuestion() {
    setQuestion(buildQuestion(words));
    setSelectedId(null);
  }

  function changeDirection(next: Direction) {
    setDirection(next);
    setQuestion(buildQuestion(words));
    setSelectedId(null);
  }

  function pickOption(word: Word) {
    if (selectedId !== null) return;
    setSelectedId(word.id);
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
