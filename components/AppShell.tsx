"use client";

import { startTransition, useEffect, useState, ViewTransition } from "react";
import dynamic from "next/dynamic";
import type { NewWordData, Word } from "@/lib/types";
import { LANGUAGES, type Language } from "@/lib/languages";
import { createSrsReview, initialSrsState, reviewSrsState, type SrsRating } from "@/lib/srs";
import * as account from "@/lib/account";
import * as wordsApi from "@/lib/wordsApi";
import { TabBar, type AppTab } from "./TabBar";
import { AuthGate } from "./AuthGate";

function SectionLoading() {
  return <p className="empty-state" role="status" aria-live="polite">Загрузка…</p>;
}

const WordList = dynamic(() => import("./WordList").then((module) => module.WordList), { loading: SectionLoading });
const Practice = dynamic(() => import("./Practice").then((module) => module.Practice), { loading: SectionLoading });
const ProgressStats = dynamic(() => import("./ProgressStats").then((module) => module.ProgressStats), { loading: SectionLoading });
const Settings = dynamic(() => import("./Settings").then((module) => module.Settings), { loading: SectionLoading });

type AuthStatus = "loading" | "anon" | "authed";

function normalizeWords(words: Word[]): Word[] {
  return words.map((w) => ({
    ...w,
    language: w.language ?? "ar",
    srsInterval: w.srsInterval ?? 0,
    srsEase: w.srsEase ?? 2.5,
    srsReps: w.srsReps ?? 0,
    srsDue: w.srsDue ?? w.dateAdded,
    srsHistory: Array.isArray(w.srsHistory) ? w.srsHistory : [],
  }));
}

export function AppShell() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [username, setUsername] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>("words");
  const [activeLanguage, setActiveLanguage] = useState<Language>("ar");
  const [words, setWords] = useState<Word[]>([]);
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await account.getSession();
      if (cancelled) return;
      if (!session.authenticated) {
        setAuthStatus("anon");
        return;
      }
      const [w, key] = await Promise.all([wordsApi.getWords(), account.getApiKeyStatus()]);
      if (cancelled) return;
      setUsername(session.username ?? null);
      setWords(normalizeWords(w));
      setHasApiKey(key.hasApiKey);
      setAuthStatus("authed");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onExpired() {
      setAuthStatus("anon");
      setUsername(null);
      setWords([]);
      setHasApiKey(false);
    }
    window.addEventListener("arabicwords:auth-expired", onExpired);
    return () => window.removeEventListener("arabicwords:auth-expired", onExpired);
  }, []);

  async function handleAuthenticated(newUsername: string, importedWords: Word[] | null) {
    setUsername(newUsername);
    setWords(normalizeWords(importedWords ?? (await wordsApi.getWords())));
    setHasApiKey((await account.getApiKeyStatus()).hasApiKey);
    setAuthStatus("authed");
  }

  async function handleLogout() {
    await account.logout();
    setAuthStatus("anon");
    setUsername(null);
    setWords([]);
    setHasApiKey(false);
  }

  async function persist(next: Word[]) {
    const prev = words;
    setWords(next);
    try {
      await wordsApi.saveWords(next);
    } catch {
      setWords(prev);
    }
  }

  function handleAdd(word: NewWordData) {
    if (words.some((w) => w.language === activeLanguage && w.text.trim() === word.text.trim())) return;
    persist([
      {
        id: crypto.randomUUID(),
        ...word,
        isLearned: false,
        dateAdded: new Date().toISOString(),
        language: activeLanguage,
        ...initialSrsState(),
        srsHistory: [],
      },
      ...words,
    ]);
  }

  function handleAddMany(items: NewWordData[]): number {
    const seen = new Set(
      words.filter((w) => w.language === activeLanguage).map((w) => w.text.trim())
    );
    const toAdd: Word[] = [];
    for (const item of items) {
      const key = item.text.trim();
      if (seen.has(key)) continue;
      seen.add(key);
      toAdd.push({
        id: crypto.randomUUID(),
        ...item,
        isLearned: false,
        dateAdded: new Date().toISOString(),
        language: activeLanguage,
        ...initialSrsState(),
        srsHistory: [],
      });
    }
    if (toAdd.length > 0) {
      void persist([...toAdd, ...words]);
    }
    return toAdd.length;
  }

  function handleToggleLearned(id: string) {
    persist(words.map((w) => (w.id === id ? { ...w, isLearned: !w.isLearned } : w)));
  }

  function handleSrsAnswer(id: string, rating: SrsRating) {
    const now = new Date();
    persist(words.map((w) => {
      if (w.id !== id) return w;
      const next = reviewSrsState(w, rating, now);
      return {
        ...w,
        ...next,
        srsHistory: [...w.srsHistory, createSrsReview(w, next, rating, now)],
      };
    }));
  }

  function handleDelete(id: string) {
    persist(words.filter((w) => w.id !== id));
  }

  async function handleSaveKey(key: string) {
    await account.saveApiKey(key);
    setHasApiKey(true);
  }

  async function handleDeleteKey() {
    await account.deleteApiKey();
    setHasApiKey(false);
  }

  function changeLanguage(language: Language) {
    startTransition(() => setActiveLanguage(language));
  }

  function changeTab(tab: AppTab) {
    startTransition(() => setActiveTab(tab));
  }

  if (authStatus === "loading") {
    return null;
  }

  if (authStatus === "anon") {
    return <AuthGate onAuthenticated={handleAuthenticated} />;
  }

  const languageWords = words.filter((w) => w.language === activeLanguage);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">К содержимому</a>
      <header className="app-header">
        <h1>Иностранные слова</h1>
        <div className="mode-toggle">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.id}
              type="button"
              className={lang.id === activeLanguage ? "pill pill-active" : "pill"}
              onClick={() => changeLanguage(lang.id)}
              aria-pressed={lang.id === activeLanguage}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </header>

      <ViewTransition key={`${activeLanguage}-${activeTab}`} enter="app-content-in" exit="app-content-out" default="none">
      <main id="main-content" className="app-main">
        {activeTab === "words" && (
          <WordList
            words={languageWords}
            language={activeLanguage}
            onAdd={handleAdd}
            onAddMany={handleAddMany}
            onToggleLearned={handleToggleLearned}
            onDelete={handleDelete}
            onOpenSettings={() => changeTab("settings")}
          />
        )}
        {activeTab === "practice" && (
          <Practice
            words={languageWords}
            language={activeLanguage}
            onMarkLearned={handleToggleLearned}
            onAnswer={handleSrsAnswer}
            onOpenSettings={() => changeTab("settings")}
          />
        )}
        {activeTab === "stats" && <ProgressStats words={languageWords} />}
        {activeTab === "settings" && (
          <Settings
            username={username ?? ""}
            hasApiKey={hasApiKey}
            onSaveKey={handleSaveKey}
            onDeleteKey={handleDeleteKey}
            onLogout={handleLogout}
          />
        )}
      </main>
      </ViewTransition>

      <TabBar active={activeTab} onChange={changeTab} />
    </div>
  );
}
