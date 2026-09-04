export type AppTab = "words" | "practice" | "stats" | "settings";

const TABS: { id: AppTab; label: string; icon: string }[] = [
  { id: "words", label: "Слова", icon: "▤" },
  { id: "practice", label: "Практика", icon: "▶" },
  { id: "stats", label: "Прогресс", icon: "↗" },
  { id: "settings", label: "Настройки", icon: "⚙" },
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
          <span className="tab-icon" aria-hidden="true">{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
