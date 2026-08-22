import type { Word } from "@/lib/types";

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
        <span dir="rtl" className="word-arabic">
          {word.text}
        </span>
        <span className="word-translation">{word.translation}</span>
      </div>
      <div className="word-row-actions">
        <button
          className={word.isLearned ? "pill pill-active" : "pill"}
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
