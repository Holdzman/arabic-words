import type { Word } from "@/lib/types";
import { languageConfig } from "@/lib/languages";
import { arabicHeadline } from "@/lib/arabicWord";

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
          {arabicHeadline(word)}
        </span>
        <span className="word-translation">{word.translation}</span>
        {word.root && <span className="help-text">корень: {word.root}</span>}
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
