"use client";

import type { Word } from "@/lib/types";

function localDateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function calculateStreak(words: Word[], now = new Date()): number {
  const activeDays = new Set(words.flatMap((word) => word.srsHistory.map((review) => localDateKey(review.reviewedAt))));
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!activeDays.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (activeDays.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function ProgressStats({ words }: { words: Word[] }) {
  const now = new Date();
  const today = localDateKey(now);
  const reviews = words.flatMap((word) => word.srsHistory);
  const todayReviews = reviews.filter((review) => localDateKey(review.reviewedAt) === today);
  const correctToday = todayReviews.filter((review) => review.rating === "good" || review.rating === "easy").length;
  const incorrectToday = todayReviews.length - correctToday;
  const correctPercent = todayReviews.length === 0 ? 0 : Math.round((correctToday / todayReviews.length) * 100);
  const difficultWords = words
    .map((word) => {
      const difficult = word.srsHistory.filter((review) => review.rating === "again" || review.rating === "hard").length;
      return { word, difficult, attempts: word.srsHistory.length };
    })
    .filter((item) => item.difficult > 0)
    .sort((a, b) => b.difficult - a.difficult || b.attempts - a.attempts)
    .slice(0, 5);

  if (words.length === 0) {
    return <p className="empty-state">Добавьте слова, чтобы здесь появился прогресс.</p>;
  }

  return (
    <section className="progress-stats">
      <div>
        <h2>Ваш прогресс</h2>
        <p className="help-text">Статистика текущего языка обновляется после каждого ответа.</p>
      </div>

      <div className="stats-grid">
        <article className="stat-card"><strong>{words.length}</strong><span>слов в словаре</span></article>
        <article className="stat-card"><strong>{words.filter((word) => word.isLearned).length}</strong><span>отмечено выученными</span></article>
        <article className="stat-card"><strong>{todayReviews.length}</strong><span>ответов сегодня</span></article>
        <article className="stat-card"><strong>{calculateStreak(words)}</strong><span>дней подряд</span></article>
      </div>

      <div className="stats-section">
        <div className="stats-section-heading">
          <h3>Сегодня</h3>
          <span>{correctPercent}% правильных ответов</span>
        </div>
        {todayReviews.length === 0 ? (
          <p className="help-text">Сегодня ещё не было ответов.</p>
        ) : (
          <div className="rating-stats">
            {([['Верно', correctToday], ['Ошибки', incorrectToday]] as const).map(([label, count]) => (
              <div key={label} className="rating-stat-row">
                <span>{label}</span>
                <div className="rating-stat-track">
                  <span style={{ width: `${(count / todayReviews.length) * 100}%` }} />
                </div>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="stats-section">
        <h3>Трудные слова</h3>
        {difficultWords.length === 0 ? (
          <p className="help-text">Пока нет слов, отмеченных как трудные.</p>
        ) : (
          <ol className="difficult-words">
            {difficultWords.map(({ word, difficult, attempts }) => (
              <li key={word.id}>
                <span><strong dir="auto">{word.text}</strong><small>{word.translation}</small></span>
                <span>{difficult} из {attempts}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
