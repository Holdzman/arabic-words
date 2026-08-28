"use client";

import { useState } from "react";
import type { Word } from "@/lib/types";
import { languageConfig, type Language } from "@/lib/languages";
import { isDue, reviewSrsState, SRS_RATING_LABELS, SRS_RATING_ORDER, type SrsRating } from "@/lib/srs";
import { isAnswerCorrect } from "@/lib/textCompare";

interface ActiveSession {
  queue: Word[];
  total: number;
  ratings: Record<SrsRating, number>;
  prompt: Word;
  input: string;
  submitted: boolean;
  isCorrect: boolean | null;
}

interface SessionResult {
  total: number;
  ratings: Record<SrsRating, number>;
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

export function WritingPractice({
  words,
  language,
  onAnswer,
}: {
  words: Word[];
  language: Language;
  onAnswer: (id: string, rating: SrsRating) => void;
}) {
  const config = languageConfig(language);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [lastResult, setLastResult] = useState<SessionResult | null>(null);

  function startSession(pool: Word[]) {
    const queue = shuffle(pool);
    setSession({
      queue,
      total: queue.length,
      ratings: { again: 0, hard: 0, good: 0, easy: 0 },
      prompt: queue[0],
      input: "",
      submitted: false,
      isCorrect: null,
    });
    setLastResult(null);
  }

  function submitAnswer() {
    if (!session || session.submitted || !session.input.trim()) return;
    const correct = isAnswerCorrect(session.input, session.prompt.text, language);
    setSession({ ...session, submitted: true, isCorrect: correct });
  }

  function rateAnswer(rating: SrsRating) {
    if (!session || !session.submitted) return;
    onAnswer(session.prompt.id, rating);
    const ratings = { ...session.ratings, [rating]: session.ratings[rating] + 1 };
    const nextQueue = session.queue.slice(1);
    if (nextQueue.length === 0) {
      setLastResult({ total: session.total, ratings });
      setSession(null);
      return;
    }
    setSession({
      ...session,
      ratings,
      queue: nextQueue,
      prompt: nextQueue[0],
      input: "",
      submitted: false,
      isCorrect: null,
    });
  }

  if (!session) {
    const dueWords = words.filter((w) => isDue(w));
    return (
      <section>
        <p className="help-text">Посмотрите перевод и напишите слово на {config.locative}.</p>

        {lastResult && (
          <div className="result-card">
            <p>Сессия завершена: {lastResult.total} слов.</p>
            <p className="help-text">
              Не помню {lastResult.ratings.again} · Трудно {lastResult.ratings.hard} · Помню {lastResult.ratings.good} ·
              Легко {lastResult.ratings.easy}
            </p>
          </div>
        )}

        {dueWords.length > 0 ? (
          <button type="button" onClick={() => startSession(dueWords)}>
            Начать сессию ({dueWords.length})
          </button>
        ) : words.length > 0 ? (
          <>
            <p className="help-text">На сегодня всё повторено. 🎉</p>
            <button type="button" onClick={() => startSession(words)}>
              Практиковаться всё равно
            </button>
          </>
        ) : null}
      </section>
    );
  }

  const { prompt, total, queue, submitted, isCorrect, input } = session;
  const progress = total - queue.length + 1;

  return (
    <section>
      <p className="help-text">
        Слово {progress} из {total}.
      </p>

      <div className="result-card">
        <p className="result-arabic">{prompt.translation}</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitAnswer();
        }}
      >
        <label htmlFor="writing-answer">Ваш ответ</label>
        <input
          id="writing-answer"
          type="text"
          dir={config.dir}
          placeholder={config.placeholder}
          value={input}
          disabled={submitted}
          onChange={(e) => setSession({ ...session, input: e.target.value })}
        />
        {!submitted && (
          <button type="submit" disabled={!input.trim()}>
            Проверить
          </button>
        )}
      </form>

      {submitted && (
        <>
          <div className="result-card">
            <p className={isCorrect ? "status status-ok" : "status"}>{isCorrect ? "Верно!" : "Неверно."}</p>
            <p dir={config.dir} className="result-arabic">
              {prompt.text}
            </p>
            {!isCorrect && <p className="help-text">Вы написали: {input}</p>}
          </div>

          <div className="rating-grid" aria-label="Оценка ответа">
            {SRS_RATING_ORDER.map((value) => {
              const nextInterval = reviewSrsState(prompt, value).srsInterval;
              return (
                <button
                  key={value}
                  type="button"
                  className={`rating-button rating-${value}`}
                  onClick={() => rateAnswer(value)}
                >
                  <span>{SRS_RATING_LABELS[value]}</span>
                  <small>{nextInterval} дн.</small>
                </button>
              );
            })}
          </div>

        </>
      )}
    </section>
  );
}
