"use client";

import { useEffect, useRef, useState } from "react";
import type { TranslationQuizResponse, Word } from "@/lib/types";
import { generateTranslationQuiz, GenerationError } from "@/lib/anthropicClient";
import { languageConfig, type Language } from "@/lib/languages";

const SPEECH_LANGUAGE: Record<Language, string> = {
  ar: "ar-SA",
  it: "it-IT",
  en: "en-US",
};

function voiceId(voice: SpeechSynthesisVoice): string {
  return voice.voiceURI || `${voice.name}-${voice.lang}`;
}

function voiceQualityScore(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  if (/premium|enhanced|neural|natural|siri/.test(name)) return 3;
  if (!voice.localService) return 2;
  return 1;
}

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
  const [hasPlayed, setHasPlayed] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState("");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const replayTimerRef = useRef<number | null>(null);
  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  const [errorText, setErrorText] = useState<string | null>(null);
  const [showSettingsAction, setShowSettingsAction] = useState(false);

  useEffect(() => {
    function loadVoices() {
      const matching = window.speechSynthesis
        .getVoices()
        .filter((voice) => voice.lang.toLowerCase().startsWith(language))
        .sort((a, b) => voiceQualityScore(b) - voiceQualityScore(a) || a.name.localeCompare(b.name));
      setVoices(matching);
      const saved = window.localStorage.getItem(`listening-voice-${language}`);
      const preferred = matching.find((voice) => voiceId(voice) === saved) ?? matching[0];
      setSelectedVoiceId(preferred ? voiceId(preferred) : "");
    }

    const initialLoad = window.setTimeout(loadVoices, 0);
    window.speechSynthesis?.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.clearTimeout(initialLoad);
      window.speechSynthesis?.removeEventListener("voiceschanged", loadVoices);
      if (replayTimerRef.current !== null) window.clearTimeout(replayTimerRef.current);
      window.speechSynthesis?.cancel();
      utteranceRef.current = null;
    };
  }, [language]);

  function selectVoice(id: string) {
    setSelectedVoiceId(id);
    window.localStorage.setItem(`listening-voice-${language}`, id);
  }

  async function handleGenerate() {
    window.speechSynthesis?.cancel();
    setIsGenerating(true);
    setErrorText(null);
    setShowSettingsAction(false);
    setResult(null);
    setUserAnswer("");
    setRevealed(false);
    setHasPlayed(false);
    setIsSpeaking(false);

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
    if (replayTimerRef.current !== null) window.clearTimeout(replayTimerRef.current);
    window.speechSynthesis.cancel();
    setIsSpeaking(false);

    // Mobile Safari can truncate a replay when cancel() and speak() run in
    // the same tick. Keeping the utterance alive and allowing the cancelled
    // queue to settle makes repeated playback reliable.
    replayTimerRef.current = window.setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(result.answer);
      utterance.lang = SPEECH_LANGUAGE[language];
      utterance.rate = rate;
      const matchingVoice = voices.find((voice) => voiceId(voice) === selectedVoiceId) ?? voices[0];
      if (matchingVoice) utterance.voice = matchingVoice;
      utterance.onstart = () => {
        setHasPlayed(true);
        setIsSpeaking(true);
      };
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      utteranceRef.current = utterance;
      replayTimerRef.current = null;
      window.speechSynthesis.speak(utterance);
    }, 150);
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
                {isSpeaking ? "↻ Начать сначала" : hasPlayed ? "↻ Прослушать ещё раз" : "▶ Прослушать"}
              </button>
              {voices.length > 0 && (
                <div>
                  <label htmlFor="listening-voice">Рассказчик</label>
                  <select
                    id="listening-voice"
                    value={selectedVoiceId}
                    onChange={(event) => selectVoice(event.target.value)}
                  >
                    {voices.map((voice) => (
                      <option key={voiceId(voice)} value={voiceId(voice)}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
