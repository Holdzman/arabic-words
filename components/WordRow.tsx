import type { Word } from "@/lib/types";
import { languageConfig } from "@/lib/languages";

export function WordRow({
  word,
  onToggleLearned,
  onDelete,
}: {
  word: Word;
  onToggleLearned: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <li className="word-row">
      <div className="word-row-text">
        <span dir={languageConfig(word.language ?? "ar").dir} className="word-arabic">
          {word.text}
        </span>
        <span className="word-translation">{word.translation}</span>
      </div>
      <div className="word-row-actions">
        <button
          className={word.isLearned ? "pill pill-success" : "pill"}
          onClick={() => onToggleLearned(word.id)}
        >
          {word.isLearned ? "Выучено" : "Отметить"}
        </button>
        <button className="pill pill-danger" onClick={() => onDelete(word.id)}>
          Удалить
        </button>
      </div>
    </li>
  );
}
