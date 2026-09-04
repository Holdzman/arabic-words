"use client";

import { useMemo, useState } from "react";
import type { Word } from "@/lib/types";
import { generateScarecrowQuestion, GenerationError } from "@/lib/anthropicClient";
import { languageConfig, type Language } from "@/lib/languages";
import { isWellKnown, type SrsRating } from "@/lib/srs";
import { isAnswerCorrect, normalizeForCompare } from "@/lib/textCompare";

const MAX_ERRORS = 6;

function randomWord(words: Word[], previousId?: string): Word {
  const candidates = words.filter((word) => word.id !== previousId);
  const pool = candidates.length > 0 ? candidates : words;
  return pool[Math.floor(Math.random() * pool.length)];
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function buildHintOptions(target: Word, words: Word[], language: Language): Word[] {
  const targetText = normalizeForCompare(target.text, language);
  const candidates = words
    .filter((candidate) => candidate.id !== target.id)
    .filter((candidate) => normalizeForCompare(candidate.text, language) !== targetText)
    .map((candidate) => {
      const samePartOfSpeech = Boolean(target.partOfSpeech && candidate.partOfSpeech === target.partOfSpeech);
      const targetWords = target.text.trim().split(/\s+/).length;
      const candidateWords = candidate.text.trim().split(/\s+/).length;
      const similarShape = targetWords === candidateWords;
      const lengthDistance = Math.abs(candidate.text.length - target.text.length);
      return { candidate, score: (samePartOfSpeech ? 4 : 0) + (similarShape ? 2 : 0) - lengthDistance * 0.05 + Math.random() };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map(({ candidate }) => candidate);

  return shuffle([target, ...candidates]);
}

function Scarecrow({ errors }: { errors: number }) {
  return (
    <svg
      className={errors >= MAX_ERRORS ? "scarecrow-picture scarecrow-picture-complete" : "scarecrow-picture"}
      viewBox="0 0 300 300"
      role="img"
      aria-label={`Пугало собрано на ${errors} из ${MAX_ERRORS}`}
    >
      <defs>
        <linearGradient id="wood" x1="0" x2="1"><stop stopColor="#6f4226" /><stop offset="0.48" stopColor="#b7793f" /><stop offset="1" stopColor="#684027" /></linearGradient>
        <linearGradient id="burlap" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f0cd83" /><stop offset="1" stopColor="#b97b35" /></linearGradient>
        <linearGradient id="shirt" x1="0" x2="1"><stop stopColor="#d8693b" /><stop offset="0.5" stopColor="#f29a55" /><stop offset="1" stopColor="#b84d31" /></linearGradient>
        <linearGradient id="denim" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#477bb5" /><stop offset="1" stopColor="#244f86" /></linearGradient>
        <filter id="soft-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="5" stdDeviation="4" floodOpacity="0.25" /></filter>
      </defs>

      <g className="scarecrow-gallows" filter="url(#soft-shadow)">
        <path d="M24 272H142" />
        <path d="M61 272V30H201" />
        <path d="M61 66L98 30" />
        <path d="M190 30V69" className="scarecrow-rope" />
        <path d="M48 272H74M48 30H74M178 30H203" className="scarecrow-wood-detail" />
      </g>

      {errors >= 1 && (
        <g className="scarecrow-body-part" filter="url(#soft-shadow)">
          <circle cx="190" cy="94" r="25" fill="url(#burlap)" />
          <path d="M158 75Q190 61 222 75L215 66Q191 49 166 66Z" className="scarecrow-hat" />
          <path d="M154 75Q190 84 226 75" className="scarecrow-hat-brim" />
          <path d="M169 112L163 119M181 116L178 123M200 116L204 123M211 112L218 119" className="scarecrow-straw" />
        </g>
      )}
      {errors >= 2 && (
        <g className="scarecrow-body-part" filter="url(#soft-shadow)">
          <path d="M169 120Q190 112 211 120L218 185Q190 199 162 185Z" fill="url(#shirt)" />
          <path d="M171 145H209L211 187Q190 195 169 187Z" fill="url(#denim)" />
          <path d="M176 126L179 153M204 126L201 153" className="scarecrow-overall-line" />
          <path d="M178 164H202V181H178Z" className="scarecrow-pocket" />
        </g>
      )}
      {errors >= 3 && (
        <g className="scarecrow-body-part" filter="url(#soft-shadow)">
          <path d="M169 127L137 145L112 169" className="scarecrow-limb scarecrow-shirt-limb" />
          <path d="M112 169L99 177M112 169L103 185M112 169L113 186" className="scarecrow-straw" />
        </g>
      )}
      {errors >= 4 && (
        <g className="scarecrow-body-part" filter="url(#soft-shadow)">
          <path d="M211 127L242 145L267 169" className="scarecrow-limb scarecrow-shirt-limb" />
          <path d="M267 169L280 177M267 169L277 185M267 169L266 186" className="scarecrow-straw" />
        </g>
      )}
      {errors >= 5 && (
        <g className="scarecrow-body-part" filter="url(#soft-shadow)">
          <path d="M180 188L174 229L156 261" className="scarecrow-limb scarecrow-denim-limb" />
          <path d="M156 261L146 271M156 261L155 276M156 261L165 274" className="scarecrow-straw" />
        </g>
      )}
      {errors >= 6 && (
        <g className="scarecrow-body-part" filter="url(#soft-shadow)">
          <path d="M201 188L207 229L225 261" className="scarecrow-limb scarecrow-denim-limb" />
          <path d="M225 261L216 274M225 261L226 276M225 261L235 271" className="scarecrow-straw" />
        </g>
      )}
    </svg>
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
  const [showHint, setShowHint] = useState(false);
  const hintOptions = useMemo(
    () => (word ? buildHintOptions(word, words, language) : []),
    [word, words, language]
  );

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
    setShowHint(false);

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

  function submitAnswer(answer = input) {
    if (!word || finished || !answer.trim()) return;
    if (isAnswerCorrect(answer, word.text, language)) {
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
          {!showHint && (
            <button
              type="button"
              className="btn-secondary"
              disabled={hintOptions.length < 4}
              onClick={() => setShowHint(true)}
            >
              Подсказка: 4 варианта
            </button>
          )}
          {showHint && (
            <div className="scarecrow-hint-grid" aria-label="Варианты ответа">
              {hintOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="btn-secondary"
                  dir={config.dir}
                  onClick={() => submitAnswer(option.text)}
                >
                  {option.text}
                </button>
              ))}
            </div>
          )}
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
