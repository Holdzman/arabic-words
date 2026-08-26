"use client";

import { useState } from "react";
import { disambiguateWord, GenerationError } from "@/lib/anthropicClient";
import type { DisambiguationCandidate } from "@/lib/types";
import { languageConfig, type Language } from "@/lib/languages";

type Status = "idle" | "loading" | "picking" | "error";

function SimpleAddWordForm({
  onAdd,
  language,
}: {
  onAdd: (text: string, translation: string) => void;
  language: Language;
}) {
  const config = languageConfig(language);
  const [text, setText] = useState("");
  const [translation, setTranslation] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedText = text.trim();
    const trimmedTranslation = translation.trim();
    if (!trimmedText || !trimmedTranslation) return;
    onAdd(trimmedText, trimmedTranslation);
    setText("");
    setTranslation("");
  }

  return (
    <div className="add-word-form">
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          dir={config.dir}
          placeholder={config.placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <input
          type="text"
          placeholder="Перевод на русский"
          value={translation}
          onChange={(e) => setTranslation(e.target.value)}
        />
        <button type="submit" disabled={!text.trim() || !translation.trim()}>
          Добавить
        </button>
      </form>
    </div>
  );
}

export function AddWordForm({
  onAdd,
  language,
}: {
  onAdd: (text: string, translation: string) => void;
  language: Language;
}) {
  const config = languageConfig(language);
  if (!config.supportsDisambiguation) {
    return <SimpleAddWordForm onAdd={onAdd} language={language} />;
  }

  return <ArabicAddWordForm onAdd={onAdd} />;
}

function ArabicAddWordForm({ onAdd }: { onAdd: (text: string, translation: string) => void }) {
  const [text, setText] = useState("");
  const [translationHint, setTranslationHint] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [candidates, setCandidates] = useState<DisambiguationCandidate[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);

  function reset() {
    setText("");
    setTranslationHint("");
    setStatus("idle");
    setCandidates([]);
    setErrorText(null);
  }

  async function fetchCandidates() {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    setStatus("loading");
    setErrorText(null);

    try {
      const result = await disambiguateWord(trimmedText, translationHint.trim());
      setCandidates(result);
      setStatus("picking");
    } catch (err) {
      setErrorText(err instanceof GenerationError ? err.message : "Что-то пошло не так. Попробуйте ещё раз.");
      setStatus("error");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void fetchCandidates();
  }

  function pickCandidate(candidate: DisambiguationCandidate) {
    onAdd(candidate.arabic, candidate.translation);
    reset();
  }

  function addAsIs() {
    const trimmedText = text.trim();
    if (!trimmedText) return;
    onAdd(trimmedText, translationHint.trim());
    reset();
  }

  return (
    <div className="add-word-form">
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          dir="auto"
          placeholder="Арабское слово"
          value={text}
          disabled={status === "loading"}
          onChange={(e) => setText(e.target.value)}
        />
        <input
          type="text"
          placeholder="Перевод на русский (подсказка, необязательно)"
          value={translationHint}
          disabled={status === "loading"}
          onChange={(e) => setTranslationHint(e.target.value)}
        />
        <button type="submit" disabled={!text.trim() || status === "loading"}>
          {status === "loading" ? "Уточняю варианты…" : "Добавить"}
        </button>
      </form>

      {status === "error" && (
        <div className="error-box">
          <p>{errorText}</p>
          <div className="candidate-actions">
            <button type="button" onClick={fetchCandidates}>
              Повторить
            </button>
            <button type="button" onClick={addAsIs}>
              Добавить как есть
            </button>
            <button type="button" className="pill-danger" onClick={reset}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {status === "picking" && (
        <div className="candidate-picker">
          <p className="help-text">Какое слово вы имели в виду?</p>
          <ul className="word-list">
            {candidates.map((candidate, i) => (
              <li key={i} className="word-row">
                <button type="button" className="candidate-option" onClick={() => pickCandidate(candidate)}>
                  <span dir="rtl" className="word-arabic">
                    {candidate.arabic}
                  </span>
                  <span className="word-translation">
                    {candidate.translation} ({candidate.partOfSpeech})
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="candidate-actions">
            <button type="button" onClick={addAsIs}>
              Добавить как есть: {text}
            </button>
            <button type="button" className="pill-danger" onClick={reset}>
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
