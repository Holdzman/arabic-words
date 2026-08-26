"use client";

import { useState } from "react";
import * as account from "@/lib/account";
import { readLegacyWords, clearLegacyLocalData } from "@/lib/legacyLocalWords";
import type { Word } from "@/lib/types";

type Mode = "login" | "signup";
type Step = "form" | "confirm-import";

export function AuthGate({
  onAuthenticated,
}: {
  onAuthenticated: (username: string, importedWords: Word[] | null) => void;
}) {
  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<Step>("form");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [signupCode, setSignupCode] = useState("");
  const [legacyWords, setLegacyWords] = useState<Word[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setStep("form");
    setErrorText(null);
  }

  async function finishSignup(importedWords: Word[] | null) {
    setIsSubmitting(true);
    setErrorText(null);
    try {
      const res = await account.signup(username.trim(), password, signupCode.trim(), importedWords ?? undefined);
      clearLegacyLocalData();
      onAuthenticated(res.username, importedWords);
    } catch (err) {
      setErrorText(err instanceof account.AuthError ? err.message : "Что-то пошло не так. Попробуйте ещё раз.");
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;

    if (mode === "login") {
      setIsSubmitting(true);
      setErrorText(null);
      try {
        const res = await account.login(username.trim(), password);
        onAuthenticated(res.username, null);
      } catch (err) {
        setErrorText(err instanceof account.AuthError ? err.message : "Что-то пошло не так. Попробуйте ещё раз.");
        setIsSubmitting(false);
      }
      return;
    }

    // Signup: check for legacy local words before hitting the network.
    const found = readLegacyWords();
    if (found.length > 0) {
      setLegacyWords(found);
      setStep("confirm-import");
      return;
    }
    await finishSignup(null);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Арабские слова</h1>
      </header>
      <main className="app-main">
        <section>
          <div className="mode-toggle">
            <button
              type="button"
              className={mode === "login" ? "pill pill-active" : "pill"}
              onClick={() => switchMode("login")}
            >
              Вход
            </button>
            <button
              type="button"
              className={mode === "signup" ? "pill pill-active" : "pill"}
              onClick={() => switchMode("signup")}
            >
              Регистрация
            </button>
          </div>

          {step === "form" && (
            <form className="settings-form" onSubmit={handleSubmit}>
              <label htmlFor="username">Имя пользователя</label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />

              <label htmlFor="password">Пароль</label>
              <input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {mode === "signup" && (
                <>
                  <label htmlFor="signup-code">Код приглашения</label>
                  <input
                    id="signup-code"
                    type="text"
                    value={signupCode}
                    onChange={(e) => setSignupCode(e.target.value)}
                  />
                </>
              )}

              {errorText && (
                <div className="error-box">
                  <p>{errorText}</p>
                </div>
              )}

              <div className="settings-actions">
                <button type="submit" disabled={isSubmitting || !username.trim() || !password}>
                  {isSubmitting ? "Подождите…" : mode === "login" ? "Войти" : "Зарегистрироваться"}
                </button>
              </div>
            </form>
          )}

          {step === "confirm-import" && (
            <div className="candidate-picker">
              <p className="help-text">
                Нашли {legacyWords.length} {legacyWords.length === 1 ? "слово" : "слов"} на этом устройстве —
                импортировать их в новый аккаунт?
              </p>
              {errorText && (
                <div className="error-box">
                  <p>{errorText}</p>
                </div>
              )}
              <div className="candidate-actions">
                <button type="button" disabled={isSubmitting} onClick={() => finishSignup(legacyWords)}>
                  Импортировать
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={isSubmitting}
                  onClick={() => finishSignup(null)}
                >
                  Пропустить
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
