"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { Word } from "@/lib/types";
import { generateScarecrowQuestion, GenerationError } from "@/lib/anthropicClient";
import { languageConfig, type Language } from "@/lib/languages";
import { isWellKnown, type SrsRating } from "@/lib/srs";
import { isAnswerCorrect } from "@/lib/textCompare";

const MAX_ERRORS = 6;

function randomWord(words: Word[], previousId?: string): Word {
  const candidates = words.filter((word) => word.id !== previousId);
  const pool = candidates.length > 0 ? candidates : words;
  return pool[Math.floor(Math.random() * pool.length)];
}

function Scarecrow({ errors }: { errors: number }) {
  return (
    <div className="scarecrow-picture" role="img" aria-label={`Пугало собрано на ${errors} из ${MAX_ERRORS}`}>
      <Image className="scarecrow-silhouette" src="/scarecrow-3d.png" alt="" fill sizes="220px" priority />
      {Array.from({ length: errors }, (_, index) => (
        <Image
          key={index}
          className={`scarecrow-layer scarecrow-layer-${index + 1}`}
          src="/scarecrow-3d.png"
          alt=""
          fill
          sizes="220px"
        />
      ))}
    </div>
  );
}

export function ScarecrowPractice({
  words,
  language,
  onAnswer,
  onOpenSettings,
}: {
  words: Word[];
  language: Language;
  onAnswer: (id: string, rating: SrsRating) => void;
  onOpenSettings: () => void;
}) {
  const config = languageConfig(language);
  const studyWords = useMemo(() => words.filter((word) => !isWellKnown(word)), [words]);
  const [word, setWord] = useState<Word | null>(null);
  const [question, setQuestion] = useState("");
  const [input, setInput] = useState("");
  const [errors, setErrors] = useState(0);
  const [finished, setFinished] = useState(false);
  const [won, setWon] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [showSettingsAction, setShowSettingsAction] = useState(false);

  async function startRound(previousId?: string) {
    if (studyWords.length === 0) return;
    const nextWord = randomWord(studyWords, previousId);
    setWord(nextWord);
    setQuestion("");
    setInput("");
    setErrors(0);
    setFinished(false);
    setWon(false);
    setLoading(true);
    setErrorText(null);
    setShowSettingsAction(false);

    try {
      const result = await generateScarecrowQuestion(language, nextWord);
      setQuestion(result.question);
    } catch (err) {
      setWord(null);
      if (err instanceof GenerationError) {
        setErrorText(err.message);
        setShowSettingsAction(err.code === "missing_api_key" || err.code === "invalid_api_key");
      } else {
        setErrorText("Что-то пошло не так. Попробуйте ещё раз.");
      }
    } finally {
      setLoading(false);
    }
  }

  function submitAnswer() {
    if (!word || finished || !input.trim()) return;
    if (isAnswerCorrect(input, word.text, language)) {
      setWon(true);
      setFinished(true);
      onAnswer(word.id, errors === 0 ? "good" : "hard");
      return;
    }

    const nextErrors = errors + 1;
    setErrors(nextErrors);
    setInput("");
    if (nextErrors >= MAX_ERRORS) {
      setFinished(true);
      setWon(false);
      onAnswer(word.id, "again");
    }
  }

  if (studyWords.length === 0) {
    return <section><p className="help-text">Все слова уже хорошо знакомы. Добавьте новые слова для игры.</p></section>;
  }

  if (!word || !question) {
    return (
      <section>
        <p className="help-text">Прочитайте вопрос и напишите ответ на {config.locative}. Шесть ошибок соберут пугало.</p>
        <Scarecrow errors={0} />
        <button type="button" onClick={() => startRound()} disabled={loading}>
          {loading ? "Готовлю вопрос…" : "Начать игру"}
        </button>
        {errorText && (
          <div className="error-box">
            <p>{errorText}</p>
            {showSettingsAction && <button type="button" onClick={onOpenSettings}>Открыть настройки</button>}
          </div>
        )}
      </section>
    );
  }

  return (
    <section>
      <div className="scarecrow-status">
        <span>Ошибки: {errors}/{MAX_ERRORS}</span>
        <span>{MAX_ERRORS - errors} попыток</span>
      </div>
      <Scarecrow errors={errors} />
      <div className="scarecrow-question" dir={config.dir}>{question}</div>

      {!finished ? (
        <form onSubmit={(event) => { event.preventDefault(); submitAnswer(); }}>
          <label htmlFor="scarecrow-answer">Ваш ответ</label>
          <input
            id="scarecrow-answer"
            type="text"
            dir={config.dir}
            value={input}
            placeholder={config.placeholder}
            autoComplete="off"
            autoCapitalize="none"
            onChange={(event) => setInput(event.target.value)}
          />
          <button type="submit" disabled={!input.trim()}>Ответить</button>
        </form>
      ) : (
        <>
          <div className={won ? "quiz-feedback quiz-feedback-correct" : "quiz-feedback quiz-feedback-incorrect"}>
            {won ? "Верно!" : "Пугало собрано"}
          </div>
          <div className="result-card">
            <p dir={config.dir} className="result-arabic">{word.text}</p>
            <p className="result-translation">{word.translation}</p>
          </div>
          <button type="button" onClick={() => startRound(word.id)} disabled={loading}>
            {loading ? "Готовлю вопрос…" : "Следующее слово"}
          </button>
        </>
      )}
    </section>
  );
}
