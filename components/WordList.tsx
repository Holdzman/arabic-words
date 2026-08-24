"use client";

import { useState } from "react";
import type { Word } from "@/lib/types";
import { AddWordForm } from "./AddWordForm";
import { BulkAddWords } from "./BulkAddWords";
import { WordRow } from "./WordRow";

type Mode = "single" | "bulk";

export function WordList({
  words,
  onAdd,
  onToggleLearned,
  onDelete,
}: {
  words: Word[];
  onAdd: (text: string, translation: string) => void;
  onToggleLearned: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("single");

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

      {mode === "single" ? <AddWordForm onAdd={onAdd} /> : <BulkAddWords onAdd={onAdd} />}

      {words.length === 0 ? (
        <p className="empty-state">Пока нет слов. Добавьте первое арабское слово, которое хотите выучить.</p>
      ) : (
        <ul className="word-list">
          {words.map((word) => (
            <WordRow key={word.id} word={word} onToggleLearned={onToggleLearned} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </section>
  );
}
