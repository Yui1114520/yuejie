import { LearnIcon, MeIcon, NewsIcon, PapersIcon } from "./Icons";
import type { TabId } from "../types";

const TABS: { id: TabId; label: string; icon: typeof NewsIcon }[] = [
  { id: "news", label: "新闻", icon: NewsIcon },
  { id: "papers", label: "报刊", icon: PapersIcon },
  { id: "learn", label: "学习", icon: LearnIcon },
  { id: "me", label: "我的", icon: MeIcon },
];

interface TabBarProps {
  active: TabId;
  onChange: (tab: TabId) => void;
}

export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav className="tabbar" aria-label="主导航">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={`tabbar-item ${active === id ? "is-active" : ""}`}
          onClick={() => onChange(id)}
          aria-current={active === id ? "page" : undefined}
        >
          <span className="tabbar-icon">
            <Icon width={22} height={22} />
          </span>
          <span className="tabbar-label">{label}</span>
        </button>
      ))}
    </nav>
  );
}
