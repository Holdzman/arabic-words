"use client";

import { useState } from "react";

export function Settings({
  username,
  hasApiKey,
  onSaveKey,
  onDeleteKey,
  onLogout,
}: {
  username: string;
  hasApiKey: boolean;
  onSaveKey: (key: string) => void;
  onDeleteKey: () => void;
  onLogout: () => void;
}) {
  const [input, setInput] = useState("");

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    onSaveKey(trimmed);
    setInput("");
  }

  return (
    <section>
      <div className="settings-account">
        <p className="status status-ok">Вы вошли как {username}</p>
        <button type="button" className="pill-danger" onClick={onLogout}>
          Выйти
        </button>
      </div>

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
          Получите ключ на console.anthropic.com. Он хранится в зашифрованном виде на сервере и синхронизируется
          на все ваши устройства после входа.
        </p>
        <div className="settings-actions">
          <button type="submit" disabled={!input.trim()}>
            Сохранить
          </button>
          {hasApiKey && (
            <button type="button" className="pill-danger" onClick={onDeleteKey}>
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
