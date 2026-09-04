"use client";

import { useRef, useState } from "react";
import { disambiguateWord, GenerationError } from "@/lib/anthropicClient";
import type { DisambiguationCandidate, NewWordData } from "@/lib/types";
import { languageConfig, type Language } from "@/lib/languages";
import { arabicHeadline } from "@/lib/arabicWord";

type Status = "idle" | "processing" | "reviewing" | "error" | "done";

interface QueueItem {
  text: string;
  hint: string;
}

interface ReviewRow {
  candidate: DisambiguationCandidate;
  checked: boolean;
}

const AUTO_RETRY_CODES = new Set([
  "malformed_response",
  "truncated",
  "network_error",
  "server_overloaded",
  "rate_limited",
]);

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function parseQueue(raw: string): QueueItem[] {
  const hasExplicitSeparator = /[\n,]/.test(raw);
  const groups = raw
    .split(hasExplicitSeparator ? /[\n,]/ : /\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const items: QueueItem[] = [];
  for (const group of groups) {
    const sepIndex = group.indexOf(" - ");
    if (sepIndex !== -1) {
      items.push({ text: group.slice(0, sepIndex).trim(), hint: group.slice(sepIndex + 3).trim() });
      continue;
    }
    items.push({ text: group, hint: "" });
  }
  return items;
}

export function BulkAddWords({
  onAddMany,
  language,
}: {
  onAddMany: (items: NewWordData[]) => number;
  language: Language;
}) {
  const config = languageConfig(language);
  const [raw, setRaw] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [processedIndex, setProcessedIndex] = useState(0);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const cancelledRef = useRef(false);

  function resetAll() {
    setRaw("");
    setQueue([]);
    setProcessedIndex(0);
    setRows([]);
    setStatus("idle");
    setErrorText(null);
    setAddedCount(0);
  }

  async function runProcessing(items: QueueItem[], startIndex: number, collected: ReviewRow[]) {
    cancelledRef.current = false;
    setStatus("processing");
    setErrorText(null);

    for (let i = startIndex; i < items.length; i++) {
      setProcessedIndex(i);
      if (cancelledRef.current) return;

      try {
        let candidates: DisambiguationCandidate[] | null = null;
        let lastError: unknown;

        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            candidates = await disambiguateWord(language, items[i].text, items[i].hint);
            break;
          } catch (err) {
            lastError = err;
            const canRetry = err instanceof GenerationError && AUTO_RETRY_CODES.has(err.code);
            if (!canRetry || attempt === 2) throw err;
            await wait(700 * (attempt + 1));
            if (cancelledRef.current) return;
          }
        }

        if (!candidates?.[0]) throw lastError ?? new Error("No candidates returned");
        if (cancelledRef.current) return;
        collected.push({ candidate: candidates[0], checked: true });
      } catch (err) {
        if (cancelledRef.current) return;
        setProcessedIndex(i);
        setRows(collected);
        setErrorText(err instanceof GenerationError ? err.message : "Что-то пошло не так. Попробуйте ещё раз.");
        setStatus("error");
        return;
      }
    }

    setRows(collected);
    setStatus("reviewing");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseQueue(raw);
    const seen = new Set<string>();
    const deduped = parsed.filter((item) => {
      if (seen.has(item.text)) return false;
      seen.add(item.text);
      return true;
    });
    if (deduped.length === 0) return;

    setQueue(deduped);
    void runProcessing(deduped, 0, []);
  }

  function retryFromError() {
    void runProcessing(queue, processedIndex, rows.slice());
  }

  function skipFailedWord() {
    void runProcessing(queue, processedIndex + 1, rows.slice());
  }

  function cancelProcessing() {
    cancelledRef.current = true;
    resetAll();
  }

  function toggleRow(index: number) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, checked: !r.checked } : r)));
  }

  function addSelected() {
    const items = rows
      .filter((r) => r.checked)
      .map((r) => ({
        text: r.candidate.text,
        translation: r.candidate.translation,
        plural: r.candidate.plural,
        partOfSpeech: r.candidate.partOfSpeech,
        root: r.candidate.root,
        gender: r.candidate.gender,
        feminineForm: r.candidate.feminineForm,
        presentTense: r.candidate.presentTense,
      }));
    setAddedCount(onAddMany(items));
    setStatus("done");
  }

  const checkedCount = rows.filter((r) => r.checked).length;

  return (
    <div className="add-word-form">
      {status === "idle" && (
        <form onSubmit={handleSubmit}>
          <textarea
            className="bulk-textarea"
            name="words"
            autoComplete="off"
            placeholder={
              config.supportsDisambiguation
                ? "Слова и фразы через запятую или по одной на строку:\nخبز - печь, باذنجان, طباخ"
                : `Слова и фразы на ${config.locative} (или по-русски) через запятую или по одному на строку:\ngatto, Come stai?, un caffè americano`
            }
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={6}
          />
          <button type="submit" disabled={parseQueue(raw).length === 0}>
            Добавить список
          </button>
        </form>
      )}

      {status === "processing" && (
        <div className="candidate-picker">
          <div className="bulk-progress">
            <span className="help-text">
              Обрабатываю {Math.min(processedIndex + 1, queue.length)} из {queue.length}…
            </span>
            <button type="button" className="pill-danger" onClick={cancelProcessing}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="error-box" role="alert">
          <p>{errorText}</p>
          <p className="help-text">
            Не удалось обработать: <strong dir="auto">{queue[processedIndex]?.text}</strong>
          </p>
          <div className="candidate-actions">
            <button type="button" className="btn-secondary" onClick={retryFromError}>
              Повторить
            </button>
            <button type="button" className="btn-secondary" onClick={skipFailedWord}>
              Пропустить слово
            </button>
            <button type="button" className="pill-danger" onClick={resetAll}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {status === "reviewing" && (
        <div className="candidate-picker">
          <p className="help-text">Проверьте варианты и снимите галочку с ненужных слов.</p>
          <ul className="word-list">
            {rows.map((row, i) => (
              <li key={i} className="word-row">
                <label className="bulk-review-row">
                  <input type="checkbox" checked={row.checked} onChange={() => toggleRow(i)} />
                  <span className="word-row-text">
                    <span dir={config.dir} className="word-arabic">
                      {arabicHeadline(row.candidate)}
                    </span>
                    <span className="word-translation">
                      {row.candidate.translation}
                      {row.candidate.partOfSpeech ? ` (${row.candidate.partOfSpeech})` : ""}
                    </span>
                    {row.candidate.root && <span className="help-text">корень: {row.candidate.root}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="candidate-actions">
            <button type="button" onClick={addSelected} disabled={checkedCount === 0}>
              Добавить выбранные ({checkedCount})
            </button>
            <button type="button" className="pill-danger" onClick={resetAll}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {status === "done" && (
        <div className="result-card">
          <p>Добавлено {addedCount} слов.</p>
          <button type="button" onClick={resetAll}>
            Готово
          </button>
        </div>
      )}
    </div>
  );
}
