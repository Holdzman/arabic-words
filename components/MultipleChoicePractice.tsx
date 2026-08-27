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

interface ActiveSession {
  queue: Word[];
  total: number;
  correct: number;
  incorrect: number;
  question: Question;
  selectedId: string | null;
}

interface SessionResult {
  correct: number;
  total: number;
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function buildQuestion(prompt: Word, allWords: Word[]): Question {
  const distractors = shuffle(allWords.filter((w) => w.id !== prompt.id)).slice(0, 3);
  return { prompt, options: shuffle([prompt, ...distractors]) };
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
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [lastResult, setLastResult] = useState<SessionResult | null>(null);

  function startSession(pool: Word[]) {
    const queue = shuffle(pool);
    setSession({
      queue,
      total: queue.length,
      correct: 0,
      incorrect: 0,
      question: buildQuestion(queue[0], words),
      selectedId: null,
    });
    setLastResult(null);
  }

  function pickOption(word: Word) {
    if (!session || session.selectedId !== null) return;
    const isCorrect = word.id === session.question.prompt.id;
    onAnswer(session.question.prompt.id, isCorrect);
    setSession({
      ...session,
      selectedId: word.id,
      correct: session.correct + (isCorrect ? 1 : 0),
      incorrect: session.incorrect + (isCorrect ? 0 : 1),
    });
  }

  function advance() {
    if (!session) return;
    const nextQueue = session.queue.slice(1);
    if (nextQueue.length === 0) {
      setLastResult({ correct: session.correct, total: session.total });
      setSession(null);
      return;
    }
    setSession({
      ...session,
      queue: nextQueue,
      question: buildQuestion(nextQueue[0], words),
      selectedId: null,
    });
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

  if (!session) {
    const dueWords = words.filter((w) => isDue(w));
    return (
      <section>
        <div className="mode-toggle">
          <button
            type="button"
            className={direction === "toTranslation" ? "pill pill-active" : "pill"}
            onClick={() => setDirection("toTranslation")}
          >
            Слово → перевод
          </button>
          <button
            type="button"
            className={direction === "toWord" ? "pill pill-active" : "pill"}
            onClick={() => setDirection("toWord")}
          >
            Перевод → слово
          </button>
        </div>

        {lastResult && (
          <p className="help-text">
            Сессия завершена: {lastResult.correct} из {lastResult.total} правильно.
          </p>
        )}

        {dueWords.length > 0 ? (
          <button type="button" onClick={() => startSession(dueWords)}>
            Начать сессию ({dueWords.length})
          </button>
        ) : (
          <>
            <p className="help-text">На сегодня всё повторено. 🎉</p>
            <button type="button" onClick={() => startSession(words)}>
              Практиковаться всё равно
            </button>
          </>
        )}
      </section>
    );
  }

  const { question, selectedId, queue, total } = session;
  const promptText = direction === "toTranslation" ? question.prompt.text : question.prompt.translation;
  const promptDir = direction === "toTranslation" ? config.dir : "auto";
  const progress = total - queue.length + 1;

  return (
    <section>
      <p className="help-text">
        Слово {progress} из {total}.
      </p>

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
              <button type="button" className={optionClass} disabled={answered} onClick={() => pickOption(option)}>
                <span dir={optionDir} className="word-arabic">
                  {optionText}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {selectedId !== null && (
        <button type="button" onClick={advance}>
          Следующее слово
        </button>
      )}
    </section>
  );
}
