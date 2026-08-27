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

const CLOUD_VOICES = [
  { id: "cloud:marin", name: "Marin — естественный" },
  { id: "cloud:cedar", name: "Cedar — естественный" },
  { id: "cloud:coral", name: "Coral — мягкий" },
  { id: "cloud:onyx", name: "Onyx — низкий" },
];

const CLOUD_TTS_LANGUAGES = new Set<Language>(["ar", "it"]);

function defaultCloudVoice(language: Language): string {
  return language === "ar" ? "cloud:marin" : language === "it" ? "cloud:onyx" : "";
}

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
  const [selectedVoiceId, setSelectedVoiceId] = useState(defaultCloudVoice(language));
  const [cloudAudio, setCloudAudio] = useState<{ key: string; url: string } | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cloudAudioRef = useRef<{ key: string; url: string } | null>(null);
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
      const savedCloudVoice = CLOUD_TTS_LANGUAGES.has(language) && CLOUD_VOICES.some((voice) => voice.id === saved) ? saved : null;
      const preferred = matching.find((voice) => voiceId(voice) === saved) ?? matching[0];
      setSelectedVoiceId(savedCloudVoice ?? (preferred ? voiceId(preferred) : defaultCloudVoice(language)));
    }

    const initialLoad = window.setTimeout(loadVoices, 0);
    window.speechSynthesis?.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.clearTimeout(initialLoad);
      window.speechSynthesis?.removeEventListener("voiceschanged", loadVoices);
      if (replayTimerRef.current !== null) window.clearTimeout(replayTimerRef.current);
      window.speechSynthesis?.cancel();
      audioRef.current?.pause();
      if (cloudAudioRef.current) URL.revokeObjectURL(cloudAudioRef.current.url);
      utteranceRef.current = null;
    };
  }, [language]);

  function selectVoice(id: string) {
    setSelectedVoiceId(id);
    window.localStorage.setItem(`listening-voice-${language}`, id);
    if (result && id.startsWith("cloud:")) void loadCloudAudio(result.answer, id);
  }

  async function loadCloudAudio(text: string, voiceIdValue: string) {
    const key = `${voiceIdValue}:${text}`;
    if (cloudAudio?.key === key) return;
    setIsAudioLoading(true);
    setErrorText(null);
    try {
      const response = await fetch("/api/speech", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: text, voice: voiceIdValue.replace("cloud:", ""), language }),
      });
      if (!response.ok) throw new Error("speech request failed");
      const url = URL.createObjectURL(await response.blob());
      setCloudAudio((previous) => {
        if (previous) URL.revokeObjectURL(previous.url);
        const next = { key, url };
        cloudAudioRef.current = next;
        return next;
      });
    } catch {
      setErrorText("Не удалось создать облачную озвучку. Можно выбрать системный голос и попробовать снова.");
    } finally {
      setIsAudioLoading(false);
    }
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
      const quiz = await generateTranslationQuiz(language, words);
      setResult(quiz);
      const voice = selectedVoiceId || defaultCloudVoice(language);
      if (voice.startsWith("cloud:")) await loadCloudAudio(quiz.answer, voice);
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
    if (!result) return;
    if (selectedVoiceId.startsWith("cloud:")) {
      const key = `${selectedVoiceId}:${result.answer}`;
      if (cloudAudio?.key !== key) {
        void loadCloudAudio(result.answer, selectedVoiceId);
        return;
      }
      audioRef.current?.pause();
      const audio = new Audio(cloudAudio.url);
      audio.playbackRate = rate;
      audio.onplay = () => {
        setHasPlayed(true);
        setIsSpeaking(true);
      };
      audio.onended = () => setIsSpeaking(false);
      audio.onerror = () => setIsSpeaking(false);
      audioRef.current = audio;
      void audio.play();
      return;
    }
    if (!speechSupported) return;
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
          {speechSupported || CLOUD_TTS_LANGUAGES.has(language) ? (
            <>
              <button type="button" className="listen-button" onClick={speak} disabled={isAudioLoading}>
                {isAudioLoading ? "Готовлю голос…" : isSpeaking ? "↻ Начать сначала" : hasPlayed ? "↻ Прослушать ещё раз" : "▶ Прослушать"}
              </button>
              {(voices.length > 0 || CLOUD_TTS_LANGUAGES.has(language)) && (
                <div>
                  <label htmlFor="listening-voice">Рассказчик</label>
                  <select
                    id="listening-voice"
                    value={selectedVoiceId}
                    onChange={(event) => selectVoice(event.target.value)}
                  >
                    {CLOUD_TTS_LANGUAGES.has(language) && (
                      <optgroup label="Облачные голоса — OpenAI">
                        {CLOUD_VOICES.map((voice) => (
                          <option key={voice.id} value={voice.id}>{voice.name}</option>
                        ))}
                      </optgroup>
                    )}
                    {voices.length > 0 && <optgroup label="Системные голоса">
                    {voices.map((voice) => (
                      <option key={voiceId(voice)} value={voiceId(voice)}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))}
                    </optgroup>}
                  </select>
                  {selectedVoiceId.startsWith("cloud:") && (
                    <p className="help-text">Голос создан искусственным интеллектом OpenAI.</p>
                  )}
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
