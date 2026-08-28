"use client";

import { useState } from "react";
import type { Language } from "@/lib/languages";

type PlaybackStatus = "idle" | "loading" | "playing" | "error";

const SPEECH_LANGUAGE: Record<Language, string> = {
  ar: "ar-SA",
  it: "it-IT",
  en: "en-US",
};

const cloudAudioCache = new Map<string, Blob>();
let activeAudio: HTMLAudioElement | null = null;
let stopActiveSystemVoice: (() => void) | null = null;

function defaultVoice(language: Language): string {
  if (language === "ar") return "cloud:marin";
  if (language === "it") return "cloud:onyx";
  return "";
}

function systemVoice(language: Language, savedVoiceId: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis
    .getVoices()
    .filter((voice) => voice.lang.toLowerCase().startsWith(language));
  return (
    voices.find((voice) => (voice.voiceURI || `${voice.name}-${voice.lang}`) === savedVoiceId) ??
    voices[0] ??
    null
  );
}

export function WordSpeaker({ text, language }: { text: string; language: Language }) {
  const [status, setStatus] = useState<PlaybackStatus>("idle");

  async function playCloud(voiceId: string) {
    const voice = voiceId.replace("cloud:", "");
    const cacheKey = `${language}:${voice}:${text}`;
    setStatus("loading");
    try {
      let blob = cloudAudioCache.get(cacheKey);
      if (!blob) {
        const response = await fetch("/api/speech", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ input: text, voice, language }),
        });
        if (!response.ok) throw new Error("speech request failed");
        blob = await response.blob();
        cloudAudioCache.set(cacheKey, blob);
      }

      activeAudio?.pause();
      stopActiveSystemVoice?.();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      let cleanedUp = false;
      const cleanUp = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        URL.revokeObjectURL(url);
        if (activeAudio === audio) activeAudio = null;
      };
      activeAudio = audio;
      audio.onplay = () => setStatus("playing");
      audio.onpause = () => {
        cleanUp();
        setStatus("idle");
      };
      audio.onended = () => {
        cleanUp();
        setStatus("idle");
      };
      audio.onerror = () => {
        cleanUp();
        setStatus("error");
      };
      try {
        await audio.play();
      } catch (error) {
        cleanUp();
        throw error;
      }
    } catch {
      setStatus("error");
    }
  }

  function playSystem(savedVoiceId: string) {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setStatus("error");
      return;
    }
    activeAudio?.pause();
    stopActiveSystemVoice?.();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = SPEECH_LANGUAGE[language];
    utterance.rate = 0.9;
    utterance.voice = systemVoice(language, savedVoiceId);
    const finish = (nextStatus: PlaybackStatus) => {
      if (stopActiveSystemVoice === stop) stopActiveSystemVoice = null;
      setStatus(nextStatus);
    };
    const stop = () => finish("idle");
    stopActiveSystemVoice = stop;
    utterance.onstart = () => setStatus("playing");
    utterance.onend = () => finish("idle");
    utterance.onerror = () => finish("error");
    window.speechSynthesis.speak(utterance);
  }

  function handlePlay() {
    const voiceId = window.localStorage.getItem(`listening-voice-${language}`) ?? defaultVoice(language);
    setStatus("idle");
    if (voiceId.startsWith("cloud:") && (language === "ar" || language === "it")) {
      void playCloud(voiceId);
      return;
    }
    playSystem(voiceId);
  }

  const label = status === "loading" ? "Готовлю произношение" : status === "playing" ? "Слово воспроизводится" : `Озвучить: ${text}`;

  return (
    <button
      type="button"
      className={`word-speaker word-speaker-${status}`}
      onClick={handlePlay}
      disabled={status === "loading"}
      aria-label={label}
      title={status === "error" ? "Не удалось озвучить. Проверьте голос в настройках аудирования." : label}
    >
      {status === "loading" ? (
        <span className="word-speaker-loader" aria-hidden="true" />
      ) : (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
          <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" />
          <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        </svg>
      )}
    </button>
  );
}
