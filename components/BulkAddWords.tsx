"use client";

import { useState } from "react";
import { disambiguateWord, GenerationError } from "@/lib/anthropicClient";
import type { DisambiguationCandidate } from "@/lib/types";

type Status = "idle" | "loading" | "picking" | "error" | "done";

interface QueueItem {
  text: string;
  hint: string;
}

function parseQueue(raw: string): QueueItem[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const sepIndex = line.indexOf(" - ");
      if (sepIndex === -1) return { text: line, hint: "" };
      return { text: line.slice(0, sepIndex).trim(), hint: line.slice(sepIndex + 3).trim() };
    });
}

export function BulkAddWords({ onAdd }: { onAdd: (text: string, translation: string) => void }) {
  const [raw, setRaw] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [addedCount, setAddedCount] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [candidates, setCandidates] = useState<DisambiguationCandidate[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);

  const current = queue[currentIndex];

  function resetAll() {
    setRaw("");
    setQueue([]);
    setCurrentIndex(0);
    setAddedCount(0);
    setStatus("idle");
    setCandidates([]);
    setErrorText(null);
  }

  async function processCurrent(item: QueueItem) {
    setStatus("loading");
    setErrorText(null);
    try {
      const result = await disambiguateWord(item.text, item.hint);
      setCandidates(result);
      setStatus("picking");
    } catch (err) {
      setErrorText(err instanceof GenerationError ? err.message : "Что-то пошло не так. Попробуйте ещё раз.");
      setStatus("error");
    }
  }

  function advance() {
    const next = currentIndex + 1;
    if (next >= queue.length) {
      setStatus("done");
      return;
    }
    setCurrentIndex(next);
    void processCurrent(queue[next]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseQueue(raw);
    if (parsed.length === 0) return;
    setQueue(parsed);
    setCurrentIndex(0);
    setAddedCount(0);
    void processCurrent(parsed[0]);
  }

  function pickCandidate(candidate: DisambiguationCandidate) {
    onAdd(candidate.arabic, candidate.translation);
    setAddedCount((n) => n + 1);
    advance();
  }

  function addAsIs() {
    if (!current) return;
    onAdd(current.text, current.hint);
    setAddedCount((n) => n + 1);
    advance();
  }

  function skip() {
    advance();
  }

  function abort() {
    setStatus("done");
  }

  return (
    <div className="add-word-form">
      {status === "idle" && (
        <form onSubmit={handleSubmit}>
          <textarea
            className="bulk-textarea"
            placeholder={"Одно слово на строку, например:\nخبز - печь\nباذنجان"}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={6}
          />
          <button type="submit" disabled={parseQueue(raw).length === 0}>
            Добавить список
          </button>
        </form>
      )}

      {(status === "loading" || status === "picking" || status === "error") && current && (
        <div className="candidate-picker">
          <div className="bulk-progress">
            <span className="help-text">
              Слово {currentIndex + 1} из {queue.length}:{" "}
              <span dir="auto">{current.text}</span>
            </span>
            <button type="button" className="pill-danger" onClick={abort}>
              Прервать
            </button>
          </div>

          {status === "loading" && <p className="help-text">Уточняю варианты…</p>}

          {status === "error" && (
            <div className="error-box">
              <p>{errorText}</p>
              <div className="candidate-actions">
                <button type="button" onClick={() => processCurrent(current)}>
                  Повторить
                </button>
                <button type="button" onClick={addAsIs}>
                  Добавить как есть
                </button>
                <button type="button" onClick={skip}>
                  Пропустить
                </button>
              </div>
            </div>
          )}

          {status === "picking" && (
            <>
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
                  Добавить как есть: {current.text}
                </button>
                <button type="button" onClick={skip}>
                  Пропустить
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {status === "done" && (
        <div className="result-card">
          <p>
            Добавлено {addedCount} из {queue.length} слов.
          </p>
          <button type="button" onClick={resetAll}>
            Готово
          </button>
        </div>
      )}
    </div>
  );
}
