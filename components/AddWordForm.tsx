"use client";

import { useState } from "react";

export function AddWordForm({ onAdd }: { onAdd: (text: string, translation: string) => void }) {
  const [text, setText] = useState("");
  const [translation, setTranslation] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedText = text.trim();
    if (!trimmedText) return;
    onAdd(trimmedText, translation.trim());
    setText("");
    setTranslation("");
  }

  return (
    <form className="add-word-form" onSubmit={handleSubmit}>
      <input
        type="text"
        dir="auto"
        placeholder="Арабское слово"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <input
        type="text"
        placeholder="Перевод на русский"
        value={translation}
        onChange={(e) => setTranslation(e.target.value)}
      />
      <button type="submit" disabled={!text.trim()}>
        Добавить
      </button>
    </form>
  );
}
