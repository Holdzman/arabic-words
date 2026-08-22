"use client";

import { useState } from "react";

export function Settings({
  hasApiKey,
  onSave,
  onDelete,
}: {
  hasApiKey: boolean;
  onSave: (key: string) => void;
  onDelete: () => void;
}) {
  const [input, setInput] = useState("");

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setInput("");
  }

  return (
    <section>
      <form className="settings-form" onSubmit={handleSave}>
        <label htmlFor="api-key">Anthropic API-ключ</label>
        <input
          id="api-key"
          type="password"
          autoComplete="off"
          placeholder="sk-ant-..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <p className="help-text">
          Получите ключ на console.anthropic.com. Он хранится только в этом браузере (localStorage) и
          отправляется исключительно на api.anthropic.com через наш сервер-прокси — на других устройствах его
          придётся ввести заново.
        </p>
        <div className="settings-actions">
          <button type="submit" disabled={!input.trim()}>
            Сохранить
          </button>
          {hasApiKey && (
            <button type="button" className="pill-danger" onClick={onDelete}>
              Удалить ключ
            </button>
          )}
        </div>
      </form>
      <p className={hasApiKey ? "status status-ok" : "status"}>
        {hasApiKey ? "Ключ сохранён" : "Ключ не задан"}
      </p>
    </section>
  );
}
