"use client";

import { useState } from "react";
import type { Word } from "@/lib/types";
import { languageConfig, type Language } from "@/lib/languages";
import { isDue, reviewSrsState, type SrsRating } from "@/lib/srs";

type Direction = "toTranslation" | "toWord";

interface Question {
  prompt: Word;
  options: Word[];
}

interface ActiveSession {
  queue: Word[];
  total: number;
  ratings: Record<SrsRating, number>;
  question: Question;
  selectedId: string | null;
  rating: SrsRating | null;
}

interface SessionResult {
  total: number;
  ratings: Record<SrsRating, number>;
}

const RATING_LABELS: Record<SrsRating, string> = {
  again: "Again",
  hard: "Hard",
  good: "Good",
  easy: "Easy",
};

const RATING_ORDER: SrsRating[] = ["again", "hard", "good", "easy"];

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
  onAnswer: (id: string, rating: SrsRating) => void;
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
      ratings: { again: 0, hard: 0, good: 0, easy: 0 },
      question: buildQuestion(queue[0], words),
      selectedId: null,
      rating: null,
    });
    setLastResult(null);
  }

  function pickOption(word: Word) {
    if (!session || session.selectedId !== null) return;
    setSession({
      ...session,
      selectedId: word.id,
    });
  }

  function rateAnswer(rating: SrsRating) {
    if (!session || session.selectedId === null || session.rating !== null) return;
    onAnswer(session.question.prompt.id, rating);
    setSession({
      ...session,
      rating,
      ratings: { ...session.ratings, [rating]: session.ratings[rating] + 1 },
    });
  }

  function advance() {
    if (!session) return;
    const nextQueue = session.queue.slice(1);
    if (nextQueue.length === 0) {
      setLastResult({ total: session.total, ratings: session.ratings });
      setSession(null);
      return;
    }
    setSession({
      ...session,
      queue: nextQueue,
      question: buildQuestion(nextQueue[0], words),
      selectedId: null,
      rating: null,
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
          <div className="result-card">
            <p>Сессия завершена: {lastResult.total} слов.</p>
            <p className="help-text">
              Again {lastResult.ratings.again} · Hard {lastResult.ratings.hard} · Good {lastResult.ratings.good} · Easy {lastResult.ratings.easy}
            </p>
          </div>
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

        <ReviewHistory words={words} />
      </section>
    );
  }

  const { question, selectedId, rating, queue, total } = session;
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
        <>
          <div className="rating-grid" aria-label="Оценка ответа">
            {RATING_ORDER.map((value) => {
              const nextInterval = reviewSrsState(question.prompt, value).srsInterval;
              return (
                <button
                  key={value}
                  type="button"
                  className={`rating-button rating-${value}${rating === value ? " rating-selected" : ""}`}
                  disabled={rating !== null}
                  onClick={() => rateAnswer(value)}
                >
                  <span>{RATING_LABELS[value]}</span>
                  <small>{nextInterval} дн.</small>
                </button>
              );
            })}
          </div>
          {rating !== null && (
            <button type="button" onClick={advance}>
              Следующее слово
            </button>
          )}
        </>
      )}
    </section>
  );
}

function ReviewHistory({ words }: { words: Word[] }) {
  const recent = words
    .flatMap((word) => word.srsHistory.map((review) => ({ word, review })))
    .sort((a, b) => b.review.reviewedAt.localeCompare(a.review.reviewedAt))
    .slice(0, 10);

  if (recent.length === 0) return null;

  return (
    <details className="review-history">
      <summary>История повторений</summary>
      <ul>
        {recent.map(({ word, review }) => (
          <li key={`${word.id}-${review.reviewedAt}`}>
            <span dir="auto">{word.text}</span>
            <span>{RATING_LABELS[review.rating]} · {review.nextInterval} дн.</span>
            <time dateTime={review.reviewedAt}>
              {new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(review.reviewedAt))}
            </time>
          </li>
        ))}
      </ul>
    </details>
  );
}
