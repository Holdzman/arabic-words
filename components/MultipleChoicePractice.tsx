"use client";

import { useState } from "react";
import type { Word } from "@/lib/types";
import { languageConfig, type Language } from "@/lib/languages";
import { isDue, reviewSrsState, SRS_RATING_LABELS, SRS_RATING_ORDER, type SrsRating } from "@/lib/srs";

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
}

interface SessionResult {
  total: number;
  ratings: Record<SrsRating, number>;
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function normalizeForSimilarity(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("ru-RU")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bigrams(value: string): Set<string> {
  const compact = normalizeForSimilarity(value).replace(/\s/g, "");
  if (compact.length < 2) return new Set(compact ? [compact] : []);
  return new Set(Array.from({ length: compact.length - 1 }, (_, index) => compact.slice(index, index + 2)));
}

function textSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizeForSimilarity(left);
  const normalizedRight = normalizeForSimilarity(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;

  const leftBigrams = bigrams(normalizedLeft);
  const rightBigrams = bigrams(normalizedRight);
  const sharedBigrams = [...leftBigrams].filter((item) => rightBigrams.has(item)).length;
  const unionSize = new Set([...leftBigrams, ...rightBigrams]).size || 1;
  const bigramScore = sharedBigrams / unionSize;

  const leftTokens = new Set(normalizedLeft.split(" "));
  const rightTokens = new Set(normalizedRight.split(" "));
  const sharedTokens = [...leftTokens].filter((item) => rightTokens.has(item)).length;
  const tokenScore = sharedTokens / (new Set([...leftTokens, ...rightTokens]).size || 1);
  const lengthScore = Math.min(normalizedLeft.length, normalizedRight.length) / Math.max(normalizedLeft.length, normalizedRight.length);
  const prefixScore = normalizedLeft[0] === normalizedRight[0] ? 1 : 0;

  return bigramScore * 0.5 + tokenScore * 0.25 + lengthScore * 0.15 + prefixScore * 0.1;
}

function answerText(word: Word, direction: Direction): string {
  return direction === "toTranslation" ? word.translation : word.text;
}

function distractorScore(prompt: Word, candidate: Word, direction: Direction): number {
  const primaryScore = textSimilarity(answerText(prompt, direction), answerText(candidate, direction));
  const secondaryScore = textSimilarity(
    answerText(prompt, direction === "toTranslation" ? "toWord" : "toTranslation"),
    answerText(candidate, direction === "toTranslation" ? "toWord" : "toTranslation"),
  );
  return primaryScore * 0.8 + secondaryScore * 0.2;
}

function buildQuestion(prompt: Word, allWords: Word[], direction: Direction): Question {
  const promptAnswer = normalizeForSimilarity(answerText(prompt, direction));
  const candidates = allWords
    .filter((word) => word.id !== prompt.id)
    .map((word) => ({ word, score: distractorScore(prompt, word, direction) + Math.random() * 0.08 }))
    .sort((left, right) => right.score - left.score);

  const distinctAnswers = new Set([promptAnswer]);
  const distractors: Word[] = [];
  for (const { word } of candidates) {
    const normalizedAnswer = normalizeForSimilarity(answerText(word, direction));
    if (!normalizedAnswer || distinctAnswers.has(normalizedAnswer)) continue;
    distinctAnswers.add(normalizedAnswer);
    distractors.push(word);
    if (distractors.length === 3) break;
  }

  // Preserve the existing four-option behavior for small dictionaries that
  // contain duplicate visible answers, while preferring unambiguous options.
  if (distractors.length < 3) {
    for (const { word } of candidates) {
      if (distractors.some((item) => item.id === word.id)) continue;
      distractors.push(word);
      if (distractors.length === 3) break;
    }
  }

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
      question: buildQuestion(queue[0], words, direction),
      selectedId: null,
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
    if (!session || session.selectedId === null) return;
    onAnswer(session.question.prompt.id, rating);
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
      question: buildQuestion(nextQueue[0], words, direction),
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
          <div className="result-card">
            <p>Сессия завершена: {lastResult.total} слов.</p>
            <p className="help-text">
              Не помню {lastResult.ratings.again} · Трудно {lastResult.ratings.hard} · Помню {lastResult.ratings.good} · Легко {lastResult.ratings.easy}
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
        <>
          <div className="rating-grid" aria-label="Оценка ответа">
            {SRS_RATING_ORDER.map((value) => {
              const nextInterval = reviewSrsState(question.prompt, value).srsInterval;
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
            <span>{SRS_RATING_LABELS[review.rating]} · {review.nextInterval} дн.</span>
            <time dateTime={review.reviewedAt}>
              {new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(review.reviewedAt))}
            </time>
          </li>
        ))}
      </ul>
    </details>
  );
}
