"use client";

import { useMemo, useState } from "react";
import type { GeneratedSentence, Word } from "@/lib/types";
import { generateSentence, GenerationError } from "@/lib/anthropicClient";
import { sampleKnownWords } from "@/lib/sampleKnownWords";

export function Practice({
  words,
  onMarkLearned,
  onOpenSettings,
}: {
  words: Word[];
  onMarkLearned: (id: string) => void;
  onOpenSettings: () => void;
}) {
  const defaultWordId = useMemo(() => {
    const firstUnlearned = words.find((w) => !w.isLearned);
    return (firstUnlearned ?? words[0])?.id ?? null;
  }, [words]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GeneratedSentence | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [showSettingsAction, setShowSettingsAction] = useState(false);

  const activeId = selectedId ?? defaultWordId;
  const selectedWord = words.find((w) => w.id === activeId) ?? null;

  async function handleGenerate() {
    if (!selectedWord) return;
    setIsGenerating(true);
    setErrorText(null);
    setShowSettingsAction(false);
    setResult(null);

    const knownWords = sampleKnownWords(words, selectedWord.id);

    try {
      const sentence = await generateSentence(selectedWord, knownWords);
      setResult(sentence);
    } catch (err) {
      if (err instanceof GenerationError) {
        setErrorText(err.message);
        setShowSettingsAction(err.code === "missing_api_key" || err.code === "invalid_api_key");
      } else {
        setErrorText("Что-то пошло не так. Попробуйте ещё раз.");
      }
    } finally {
      setIsGenerating(false);
    }
  }

  if (words.length === 0) {
    return <p className="empty-state">Сначала добавьте слова на вкладке «Слова».</p>;
  }

  return (
    <section>
      <label htmlFor="word-select">Слово</label>
      <select
        id="word-select"
        value={activeId ?? ""}
        onChange={(e) => {
          setSelectedId(e.target.value);
          setResult(null);
          setErrorText(null);
        }}
      >
        {words.map((word) => (
          <option key={word.id} value={word.id}>
            {word.text} — {word.translation}
          </option>
        ))}
      </select>

      <button onClick={handleGenerate} disabled={isGenerating || !selectedWord}>
        {isGenerating ? "Генерирую…" : "Сгенерировать предложение"}
      </button>

      {errorText && (
        <div className="error-box">
          <p>{errorText}</p>
          {showSettingsAction && (
            <button type="button" onClick={onOpenSettings}>
              Открыть настройки
            </button>
          )}
        </div>
      )}

      {result && (
        <div className="result-card">
          <p dir="rtl" className="result-arabic">
            {result.arabicSentence}
          </p>
          <p className="result-translation">{result.russianTranslation}</p>
          {selectedWord && !selectedWord.isLearned && (
            <button type="button" onClick={() => onMarkLearned(selectedWord.id)}>
              Отметить как выученное
            </button>
          )}
        </div>
      )}
    </section>
  );
}
