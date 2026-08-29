"use client";

import { useState } from "react";
import type { TranslationQuizResponse, Word } from "@/lib/types";
import { generateTranslationQuiz, GenerationError } from "@/lib/anthropicClient";
import { languageConfig, type Language } from "@/lib/languages";

export function TranslationQuizPractice({
  words,
  language,
  onOpenSettings,
}: {
  words: Word[];
  language: Language;
  onOpenSettings: () => void;
}) {
  const config = languageConfig(language);
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
      const quiz = await generateTranslationQuiz(language, words);
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
        Прочитайте предложение на русском и попробуйте мысленно перевести его на {config.locative}, затем проверьте
        себя.
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
        <div className="result-card translation-quiz-card">
          <div className="translation-quiz-prompt">
            <span>Переведите предложение</span>
            <p>{result.prompt}</p>
          </div>
          {revealed ? (
            <div className="translation-quiz-answer">
              <span>Ответ</span>
              <p dir={config.dir} className="result-arabic">
                {result.answer}
              </p>
            </div>
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
