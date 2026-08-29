"use client";

import { useState } from "react";
import { generateGapText, GenerationError } from "@/lib/anthropicClient";
import { isAnswerCorrect } from "@/lib/textCompare";
import { languageConfig, type Language } from "@/lib/languages";
import type { GapTextResponse, Word } from "@/lib/types";
import { isWellKnown } from "@/lib/srs";

export function GapTextPractice({
  words,
  language,
  onOpenSettings,
}: {
  words: Word[];
  language: Language;
  onOpenSettings: () => void;
}) {
  const config = languageConfig(language);
  const studyWords = words.filter((word) => !isWellKnown(word));
  const [result, setResult] = useState<GapTextResponse | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [showSettingsAction, setShowSettingsAction] = useState(false);

  async function handleGenerate() {
    setIsGenerating(true);
    setErrorText(null);
    setShowSettingsAction(false);
    setResult(null);
    setChecked(false);
    setShowHints(false);
    try {
      const next = await generateGapText(language, words, studyWords);
      setResult(next);
      setAnswers(next.blanks.map(() => ""));
    } catch (error) {
      if (error instanceof GenerationError) {
        setErrorText(error.message);
        setShowSettingsAction(error.code === "missing_api_key" || error.code === "invalid_api_key");
      } else {
        setErrorText("Что-то пошло не так. Попробуйте ещё раз.");
      }
    } finally {
      setIsGenerating(false);
    }
  }

  const correctCount = result
    ? result.blanks.filter((blank, index) => isAnswerCorrect(answers[index] ?? "", blank.answer, language)).length
    : 0;

  return (
    <section>
      <p className="help-text">
        Заполните пропуски, изменяя слова по контексту. Для арабского харакаты вводить не обязательно.
      </p>
      <button type="button" onClick={handleGenerate} disabled={isGenerating || studyWords.length < 3}>
        {isGenerating ? "Создаю текст…" : result ? "Создать другой текст" : "Создать текст"}
      </button>
      {studyWords.length < 3 && <p className="help-text">Для этого упражнения нужно хотя бы три изучаемых слова.</p>}

      {errorText && (
        <div className="error-box">
          <p>{errorText}</p>
          {showSettingsAction && <button onClick={onOpenSettings}>Открыть настройки</button>}
        </div>
      )}

      {result && (
        <div className="result-card gap-text-card">
          <div className="gap-text" dir={config.dir}>
            {result.blanks.map((blank, index) => {
              const correct = isAnswerCorrect(answers[index] ?? "", blank.answer, language);
              const inputClass = checked ? (correct ? "gap-input gap-input-correct" : "gap-input gap-input-wrong") : "gap-input";
              return (
                <span key={`${blank.answer}-${index}`}>
                  {blank.before}
                  <span className="gap-field">
                    <input
                      dir={config.dir}
                      className={inputClass}
                      value={answers[index] ?? ""}
                      onChange={(event) => {
                        const next = [...answers];
                        next[index] = event.target.value;
                        setAnswers(next);
                        setChecked(false);
                      }}
                      aria-label={`Пропуск ${index + 1}`}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    {checked && !correct && <small className="gap-correction">Правильно: {blank.answer}</small>}
                  </span>
                </span>
              );
            })}
            {result.ending}
          </div>

          <div className="gap-actions">
            <button type="button" onClick={() => setChecked(true)} disabled={answers.some((answer) => !answer.trim())}>
              Проверить
            </button>
            <button type="button" onClick={() => setShowHints((visible) => !visible)}>
              {showHints ? "Скрыть подсказку" : "Подсказка"}
            </button>
            {checked && <strong>{correctCount} из {result.blanks.length} правильно</strong>}
          </div>
          {showHints && (
            <div className="gap-hints">
              <strong>Используйте эти слова:</strong>
              <ul>
                {result.blanks.map((blank, index) => (
                  <li key={`${blank.dictionaryForm}-${index}`}>
                    <span dir={config.dir}>{blank.dictionaryForm}</span> — {blank.translation}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {checked && <p className="gap-translation">Перевод: {result.translation}</p>}
        </div>
      )}
    </section>
  );
}
