"use client";

import { useMemo, useState } from "react";
import type { NewWordData, Word } from "@/lib/types";
import type { Language } from "@/lib/languages";
import { AddWordForm } from "./AddWordForm";
import { BulkAddWords } from "./BulkAddWords";
import { WordRow } from "./WordRow";

type Mode = "single" | "bulk";
type SortOrder = "date" | "alpha";

export function WordList({
  words,
  language,
  onAddMany,
  onToggleLearned,
  onDelete,
}: {
  words: Word[];
  language: Language;
  onAddMany: (items: NewWordData[]) => number;
  onToggleLearned: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("single");
  const [sortOrder, setSortOrder] = useState<SortOrder>("date");

  const displayWords = useMemo(() => {
    if (sortOrder === "date") return words;
    return [...words].sort((a, b) => a.text.localeCompare(b.text));
  }, [words, sortOrder]);

  return (
    <section>
      <div className="mode-toggle">
        <button
          type="button"
          className={mode === "single" ? "pill pill-active" : "pill"}
          onClick={() => setMode("single")}
        >
          Одно слово
        </button>
        <button
          type="button"
          className={mode === "bulk" ? "pill pill-active" : "pill"}
          onClick={() => setMode("bulk")}
        >
          Список
        </button>
      </div>

      {mode === "single" ? (
        <AddWordForm key={language} onAddMany={onAddMany} language={language} />
      ) : (
        <BulkAddWords key={language} onAddMany={onAddMany} language={language} />
      )}

      {words.length === 0 ? (
        <p className="empty-state">Пока нет слов на этом языке. Добавьте первое слово, которое хотите выучить.</p>
      ) : (
        <>
          <div className="mode-toggle">
            <button
              type="button"
              className={sortOrder === "date" ? "pill pill-active" : "pill"}
              onClick={() => setSortOrder("date")}
            >
              Дата
            </button>
            <button
              type="button"
              className={sortOrder === "alpha" ? "pill pill-active" : "pill"}
              onClick={() => setSortOrder("alpha")}
            >
              А-Я
            </button>
          </div>

          <ul className="word-list">
            {displayWords.map((word) => (
              <WordRow key={word.id} word={word} onToggleLearned={onToggleLearned} onDelete={onDelete} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
