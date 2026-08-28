export type AppTab = "words" | "practice" | "stats" | "settings";

const TABS: { id: AppTab; label: string }[] = [
  { id: "words", label: "Слова" },
  { id: "practice", label: "Практика" },
  { id: "stats", label: "Прогресс" },
  { id: "settings", label: "Настройки" },
];

export function TabBar({
  active,
  onChange,
}: {
  active: AppTab;
  onChange: (tab: AppTab) => void;
}) {
  return (
    <nav className="tab-bar">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={tab.id === active ? "tab-button tab-button-active" : "tab-button"}
          onClick={() => onChange(tab.id)}
          aria-current={tab.id === active ? "page" : undefined}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
