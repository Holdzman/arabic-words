"use client";

import { useEffect, useState } from "react";
import type { Word } from "@/lib/types";
import * as storage from "@/lib/storage";
import { TabBar, type AppTab } from "./TabBar";
import { WordList } from "./WordList";
import { Practice } from "./Practice";
import { Settings } from "./Settings";

export function AppShell() {
  const [activeTab, setActiveTab] = useState<AppTab>("words");
  const [words, setWords] = useState<Word[]>([]);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setWords(storage.getWords());
    setApiKey(storage.getApiKey());
    setIsLoaded(true);
  }, []);

  function handleAdd(text: string, translation: string) {
    setWords(storage.addWord(text, translation));
  }

  function handleToggleLearned(id: string) {
    setWords(storage.toggleLearned(id));
  }

  function handleDelete(id: string) {
    setWords(storage.deleteWord(id));
  }

  function handleSaveKey(key: string) {
    storage.saveApiKey(key);
    setApiKey(key);
  }

  function handleDeleteKey() {
    storage.deleteApiKey();
    setApiKey(null);
  }

  if (!isLoaded) {
    return null;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Арабские слова</h1>
      </header>

      <main className="app-main">
        {activeTab === "words" && (
          <WordList
            words={words}
            onAdd={handleAdd}
            onToggleLearned={handleToggleLearned}
            onDelete={handleDelete}
          />
        )}
        {activeTab === "practice" && (
          <Practice
            words={words}
            onMarkLearned={handleToggleLearned}
            onOpenSettings={() => setActiveTab("settings")}
          />
        )}
        {activeTab === "settings" && (
          <Settings hasApiKey={!!apiKey} onSave={handleSaveKey} onDelete={handleDeleteKey} />
        )}
      </main>

      <TabBar active={activeTab} onChange={setActiveTab} />
    </div>
  );
}
