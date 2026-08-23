"use client";

import { useState } from "react";
import type { TranslationQuizResponse, Word } from "@/lib/types";
import { generateTranslationQuiz, GenerationError } from "@/lib/anthropicClient";

export function TranslationQuizPractice({
  words,
  onOpenSettings,
}: {
  words: Word[];
  onOpenSettings: () => void;
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<TranslationQuizResponse | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [showSettingsAction, setShowSettingsAction] = useState(false);

  async function handleGenerate() {
    setIsGenerating(true);
    setErrorText(null);
    setShowSettingsAction(false);
    setResult(null);
    setRevealed(false);

    try {
      const quiz = await generateTranslationQuiz(words);
      setResult(quiz);
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

  return (
    <section>
      <p className="help-text">
        Прочитайте предложение на русском и попробуйте мысленно перевести его на арабский, затем проверьте себя.
      </p>

      <button onClick={handleGenerate} disabled={isGenerating}>
        {isGenerating ? "Генерирую…" : result ? "Сгенерировать другое" : "Сгенерировать предложение"}
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
          <p className="result-translation">{result.russianSentence}</p>
          {revealed ? (
            <p dir="rtl" className="result-arabic">
              {result.arabicSentence}
            </p>
          ) : (
            <button type="button" onClick={() => setRevealed(true)}>
              Показать ответ
            </button>
          )}
        </div>
      )}
    </section>
  );
}
