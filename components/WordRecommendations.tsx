"use client";

import { useEffect, useState } from "react";
import type { NewWordData, Word, WordRecommendation } from "@/lib/types";
import { languageConfig, type Language } from "@/lib/languages";
import { arabicHeadline } from "@/lib/arabicWord";
import { recommendWords, GenerationError } from "@/lib/anthropicClient";
import { WordSpeaker } from "./WordSpeaker";

const BATCH_SIZE = 8;

type Status = "loading" | "ready" | "error";

function dedupeAgainstExcluded(list: WordRecommendation[], excludedTexts: Set<string>): WordRecommendation[] {
  const seen = new Set<string>();
  return list.filter((r) => {
    const key = r.text.trim();
    if (!key || excludedTexts.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function WordRecommendations({
  words,
  language,
  onAddMany,
  onOpenSettings,
}: {
  words: Word[];
  language: Language;
  onAddMany: (items: NewWordData[]) => number;
  onOpenSettings: () => void;
}) {
  const config = languageConfig(language);
  const [status, setStatus] = useState<Status>("loading");
  const [recommendations, setRecommendations] = useState<WordRecommendation[]>([]);
  const [shown, setShown] = useState<Set<string>>(new Set());
  const [addingText, setAddingText] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [showSettingsAction, setShowSettingsAction] = useState(false);

  useEffect(() => {
    void loadBatch(new Set());
    // Intentionally only re-runs when the language changes, not on every word
    // add/delete — otherwise adding a word elsewhere would refetch this section.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  async function loadBatch(excludeSet: Set<string>) {
    setStatus("loading");
    setErrorText(null);
    const dictExcluded = new Set([...words.map((w) => w.text.trim()), ...excludeSet]);
    try {
      const result = await recommendWords(language, words, Array.from(excludeSet), BATCH_SIZE);
      const deduped = dedupeAgainstExcluded(result, dictExcluded);
      setRecommendations(deduped);
      setShown(new Set([...excludeSet, ...deduped.map((r) => r.text.trim())]));
      setStatus("ready");
    } catch (err) {
      if (err instanceof GenerationError) {
        setErrorText(err.message);
        setShowSettingsAction(err.code === "missing_api_key" || err.code === "invalid_api_key");
      } else {
        setErrorText("Что-то пошло не так. Попробуйте ещё раз.");
      }
      setStatus("error");
    }
  }

  async function handleAdd(rec: WordRecommendation) {
    setAddingText(rec.text);
    onAddMany([
      {
        text: rec.text,
        translation: rec.translation,
        partOfSpeech: rec.partOfSpeech,
        plural: rec.plural,
        root: rec.root,
        gender: rec.gender,
        feminineForm: rec.feminineForm,
        presentTense: rec.presentTense,
      },
    ]);
    setRecommendations((prev) => prev.filter((r) => r.text !== rec.text));

    const nextShown = new Set([...shown, rec.text.trim()]);
    setShown(nextShown);
    const dictExcluded = new Set([...words.map((w) => w.text.trim()), ...nextShown]);
    try {
      const replacement = await recommendWords(language, words, Array.from(nextShown), 1);
      const [next] = dedupeAgainstExcluded(replacement, dictExcluded);
      if (next) {
        setRecommendations((prev) => (prev.some((r) => r.text === next.text) ? prev : [...prev, next]));
        setShown((prev) => new Set([...prev, next.text.trim()]));
      }
    } catch {
      // Best-effort backfill: if it fails, the list is just one item shorter
      // until the user presses "Показать ещё".
    } finally {
      setAddingText(null);
    }
  }

  return (
    <div className="stats-section">
      <h3>Рекомендуем добавить</h3>

      {status === "loading" && recommendations.length === 0 && (
        <p className="help-text">Подбираем рекомендации…</p>
      )}

      {status === "error" && (
        <div className="error-box">
          <p>{errorText}</p>
          {showSettingsAction ? (
            <button type="button" onClick={onOpenSettings}>
              Открыть настройки
            </button>
          ) : (
            <button type="button" className="btn-secondary" onClick={() => void loadBatch(shown)}>
              Повторить
            </button>
          )}
        </div>
      )}

      {status === "ready" && (
        <>
          {recommendations.length > 0 ? (
            <ul className="word-list">
              {recommendations.map((rec) => (
                <li key={rec.text} className="word-row">
                  <div className="word-row-text">
                    <div className="word-pronunciation-line">
                      <span dir={config.dir} className="word-arabic">
                        {arabicHeadline(rec)}
                      </span>
                      <WordSpeaker text={rec.text} language={language} />
                    </div>
                    <span className="word-translation">
                      {rec.translation}
                      {rec.partOfSpeech ? ` (${rec.partOfSpeech})` : ""}
                    </span>
                    {rec.root && <span className="help-text">корень: {rec.root}</span>}
                  </div>
                  <div className="word-row-actions">
                    <button
                      type="button"
                      className="pill"
                      disabled={addingText === rec.text}
                      onClick={() => void handleAdd(rec)}
                    >
                      {addingText === rec.text ? "Добавляю…" : "Добавить"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="help-text">Пока нет новых рекомендаций.</p>
          )}
          <button type="button" className="btn-secondary" onClick={() => void loadBatch(shown)}>
            Показать ещё
          </button>
        </>
      )}
    </div>
  );
}
