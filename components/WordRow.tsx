import type { Word } from "@/lib/types";
import { languageConfig } from "@/lib/languages";
import { arabicHeadline } from "@/lib/arabicWord";
import { WordSpeaker } from "./WordSpeaker";

export function WordRow({
  word,
  onToggleLearned,
  onDelete,
}: {
  word: Word;
  onToggleLearned: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  function confirmDelete() {
    if (window.confirm(`Удалить «${word.text}» из словаря?`)) {
      onDelete(word.id);
    }
  }

  return (
    <li className="word-row">
      <div className="word-row-text">
        <div className="word-pronunciation-line">
          <span dir={languageConfig(word.language ?? "ar").dir} className="word-arabic">
            {arabicHeadline(word)}
          </span>
          <WordSpeaker text={word.text} language={word.language ?? "ar"} />
        </div>
        <span className="word-translation">{word.translation}</span>
        {word.root && <span className="help-text">корень: {word.root}</span>}
      </div>
      <div className="word-row-actions">
        <button
          type="button"
          className={word.isLearned ? "pill pill-success" : "pill"}
          onClick={() => onToggleLearned(word.id)}
        >
          {word.isLearned ? "Выучено" : "Отметить"}
        </button>
        <button type="button" className="pill pill-danger" onClick={confirmDelete}>
          Удалить
        </button>
      </div>
    </li>
  );
}
