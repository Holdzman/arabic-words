"use client";

import { useEffect, useState } from "react";
import type { Word } from "@/lib/types";
import { languageConfig, type Language } from "@/lib/languages";
import { isDue, isWellKnown, type SrsRating } from "@/lib/srs";

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
}

interface SessionResult {
  total: number;
  correct: number;
  incorrect: number;
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

function textShape(value: string) {
  const normalized = normalizeForSimilarity(value);
  const tokens = normalized ? normalized.split(" ") : [];
  return {
    tokenCount: tokens.length,
    lastLetter: normalized.at(-1) ?? "",
    lastTwoLetters: normalized.slice(-2),
    isQuestion: /\?/.test(value),
    isExclamation: /!/.test(value),
    hasSlash: /\//.test(value),
  };
}

function shapeSimilarity(left: string, right: string): number {
  const leftShape = textShape(left);
  const rightShape = textShape(right);

  // A question, greeting, or multi-word phrase should not become an easy
  // throwaway option for a single noun when closer alternatives exist.
  if (leftShape.isQuestion !== rightShape.isQuestion) return -1;
  if (leftShape.isExclamation !== rightShape.isExclamation) return -0.65;
  if ((leftShape.tokenCount === 1) !== (rightShape.tokenCount === 1)) return -0.55;

  let score = 0;
  if (leftShape.tokenCount === rightShape.tokenCount) score += 0.3;
  else if (Math.abs(leftShape.tokenCount - rightShape.tokenCount) === 1) score += 0.1;
  if (leftShape.lastLetter && leftShape.lastLetter === rightShape.lastLetter) score += 0.35;
  if (leftShape.lastTwoLetters.length === 2 && leftShape.lastTwoLetters === rightShape.lastTwoLetters) score += 0.2;
  if (leftShape.hasSlash === rightShape.hasSlash) score += 0.15;
  return score;
}

function distractorScore(prompt: Word, candidate: Word, direction: Direction): number {
  const primaryScore = textSimilarity(answerText(prompt, direction), answerText(candidate, direction));
  const promptSource = answerText(prompt, direction === "toTranslation" ? "toWord" : "toTranslation");
  const candidateSource = answerText(candidate, direction === "toTranslation" ? "toWord" : "toTranslation");
  const secondaryScore = textSimilarity(promptSource, candidateSource);
  const answerShapeScore = shapeSimilarity(answerText(prompt, direction), answerText(candidate, direction));
  const sourceShapeScore = shapeSimilarity(promptSource, candidateSource);

  return primaryScore * 0.45 + secondaryScore * 0.25 + answerShapeScore * 0.15 + sourceShapeScore * 0.15;
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
  const studyWords = words.filter((word) => !isWellKnown(word));
  const [direction, setDirection] = useState<Direction>("toTranslation");
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [lastResult, setLastResult] = useState<SessionResult | null>(null);
  const [feedback, setFeedback] = useState<{ type: "correct" | "incorrect"; nonce: number } | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 1100);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  function startSession(pool: Word[]) {
    const queue = shuffle(pool);
    setSession({
      queue,
      total: queue.length,
      correct: 0,
      incorrect: 0,
      question: buildQuestion(queue[0], words, direction),
    });
    setLastResult(null);
  }

  function pickOption(word: Word) {
    if (!session) return;
    const isCorrect = word.id === session.question.prompt.id;
    setFeedback((previous) => ({
      type: isCorrect ? "correct" : "incorrect",
      nonce: (previous?.nonce ?? 0) + 1,
    }));
    const rating: SrsRating = isCorrect ? "good" : "again";
    onAnswer(session.question.prompt.id, rating);
    const correct = session.correct + (isCorrect ? 1 : 0);
    const incorrect = session.incorrect + (isCorrect ? 0 : 1);
    const nextQueue = session.queue.slice(1);
    if (nextQueue.length === 0) {
      setLastResult({ total: session.total, correct, incorrect });
      setSession(null);
      return;
    }
    setSession({
      ...session,
      correct,
      incorrect,
      queue: nextQueue,
      question: buildQuestion(nextQueue[0], words, direction),
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
    const dueWords = studyWords.filter((w) => isDue(w));
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
              Верно {lastResult.correct} · Ошибок {lastResult.incorrect}
            </p>
          </div>
        )}

        {studyWords.length === 0 ? (
          <p className="help-text">Все слова уже хорошо знакомы. Они останутся контекстом для других упражнений.</p>
        ) : dueWords.length > 0 ? (
          <button type="button" onClick={() => startSession(dueWords)}>
            Начать сессию ({dueWords.length})
          </button>
        ) : (
          <>
            <p className="help-text">На сегодня всё повторено. 🎉</p>
            <button type="button" onClick={() => startSession(studyWords)}>
              Практиковаться всё равно
            </button>
          </>
        )}

        <ReviewHistory words={words} />
      </section>
    );
  }

  const { question, queue, total } = session;
  const promptText = direction === "toTranslation" ? question.prompt.text : question.prompt.translation;
  const promptDir = direction === "toTranslation" ? config.dir : "auto";
  const progress = total - queue.length + 1;

  return (
    <section>
      <p className="help-text quiz-progress-line">
        <span>
          Слово {progress} из {total}.
        </span>
        {feedback && (
          <span
            key={feedback.nonce}
            className={`quiz-feedback quiz-feedback-${feedback.type}`}
            role="status"
            aria-live="polite"
          >
            {feedback.type === "correct" ? "Правильно!" : "Неправильно"}
          </span>
        )}
      </p>

      <div className="result-card">
        <p dir={promptDir} className="result-arabic">
          {promptText}
        </p>
      </div>

      <ul className="word-list">
        {question.options.map((option) => {
          const optionText = direction === "toTranslation" ? option.translation : option.text;
          const optionDir = direction === "toTranslation" ? "auto" : config.dir;

          return (
            <li key={option.id} className="word-row">
              <button type="button" className="candidate-option" onClick={() => pickOption(option)}>
                <span dir={optionDir} className="word-arabic">
                  {optionText}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

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
            <span>{review.rating === "good" || review.rating === "easy" ? "Верно" : "Ошибка"} · {review.nextInterval} дн.</span>
            <time dateTime={review.reviewedAt}>
              {new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(review.reviewedAt))}
            </time>
          </li>
        ))}
      </ul>
    </details>
  );
}
