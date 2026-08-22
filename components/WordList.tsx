import type { Word } from "@/lib/types";
import { AddWordForm } from "./AddWordForm";
import { WordRow } from "./WordRow";

export function WordList({
  words,
  onAdd,
  onToggleLearned,
  onDelete,
}: {
  words: Word[];
  onAdd: (text: string, translation: string) => void;
  onToggleLearned: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section>
      <AddWordForm onAdd={onAdd} />
      {words.length === 0 ? (
        <p className="empty-state">Пока нет слов. Добавьте первое арабское слово, которое хотите выучить.</p>
      ) : (
        <ul className="word-list">
          {words.map((word) => (
            <WordRow key={word.id} word={word} onToggleLearned={onToggleLearned} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </section>
  );
}
