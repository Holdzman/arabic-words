"use client";

import { useEffect, useState } from "react";
import type { TranslationQuizResponse, Word } from "@/lib/types";
import { generateTranslationQuiz, GenerationError } from "@/lib/anthropicClient";
import { languageConfig, type Language } from "@/lib/languages";

const SPEECH_LANGUAGE: Record<Language, string> = {
  ar: "ar-SA",
  it: "it-IT",
  en: "en-US",
};

export function ListeningPractice({
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
  const [userAnswer, setUserAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [rate, setRate] = useState(1);
  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  const [errorText, setErrorText] = useState<string | null>(null);
  const [showSettingsAction, setShowSettingsAction] = useState(false);

  useEffect(() => {
    return () => window.speechSynthesis?.cancel();
  }, []);

  async function handleGenerate() {
    window.speechSynthesis?.cancel();
    setIsGenerating(true);
    setErrorText(null);
    setShowSettingsAction(false);
    setResult(null);
    setUserAnswer("");
    setRevealed(false);

    try {
      setResult(await generateTranslationQuiz(language, words));
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

  function speak() {
    if (!result || !speechSupported) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(result.answer);
    utterance.lang = SPEECH_LANGUAGE[language];
    utterance.rate = rate;
    const matchingVoice = window.speechSynthesis
      .getVoices()
      .find((voice) => voice.lang.toLowerCase().startsWith(language));
    if (matchingVoice) utterance.voice = matchingVoice;
    window.speechSynthesis.speak(utterance);
  }

  return (
    <section>
      <p className="help-text">
        Прослушайте предложение на {config.locative} и напишите его смысл по-русски. Фраза использует слова из
        вашего словаря.
      </p>

      <button type="button" onClick={handleGenerate} disabled={isGenerating}>
        {isGenerating ? "Генерирую…" : result ? "Другое предложение" : "Создать аудирование"}
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
        <div className="listening-card">
          {speechSupported ? (
            <>
              <button type="button" className="listen-button" onClick={speak}>
                ▶ Прослушать
              </button>
              <div className="mode-toggle" aria-label="Скорость воспроизведения">
                <button
                  type="button"
                  className={rate === 0.75 ? "pill pill-active" : "pill"}
                  onClick={() => setRate(0.75)}
                >
                  Медленно
                </button>
                <button
                  type="button"
                  className={rate === 1 ? "pill pill-active" : "pill"}
                  onClick={() => setRate(1)}
                >
                  Обычно
                </button>
              </div>
            </>
          ) : (
            <p className="error-box">Этот браузер не поддерживает системное озвучивание.</p>
          )}

          <div>
            <label htmlFor="listening-answer">Ваш перевод</label>
            <textarea
              id="listening-answer"
              rows={3}
              value={userAnswer}
              onChange={(event) => setUserAnswer(event.target.value)}
              placeholder="Напишите по-русски, что вы услышали"
              disabled={revealed}
            />
          </div>

          {!revealed ? (
            <button type="button" onClick={() => setRevealed(true)} disabled={!userAnswer.trim()}>
              Проверить себя
            </button>
          ) : (
            <div className="result-card">
              <p dir={config.dir} className="result-arabic">
                {result.answer}
              </p>
              <p className="result-translation">Эталон: {result.prompt}</p>
              <p className="help-text">Ваш ответ: {userAnswer}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
