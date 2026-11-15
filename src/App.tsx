import { useEffect, useState } from "react";
import { TabBar } from "./components/TabBar";
import { NewsPage } from "./features/news/NewsPage";
import { PressPage } from "./features/press/PressPage";
import { LearnPage } from "./features/learn/LearnPage";
import { MePage } from "./features/placeholders/PlaceholderPages";
import { ConnectionPanel } from "./features/shell/ConnectionPanel";
import { apiBase, inAppShell, probeApi } from "./lib/api";
import type { TabId } from "./types";

export default function App() {
  const [tab, setTab] = useState<TabId>("news");
  const [needsSetup, setNeedsSetup] = useState(() => inAppShell && !apiBase());

  useEffect(() => {
    // 打包时预填的地址可能已经变了（换网络、DHCP 重新分配），连不上就回到连接页
    if (!inAppShell || needsSetup) return;
    let alive = true;
    probeApi(apiBase()).then((result) => {
      if (alive && !result.ok) setNeedsSetup(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (needsSetup) {
    return (
      <div className="app-shell">
        <main className="screens">
          <section className="screen is-active">
            <ConnectionPanel variant="gate" onSkip={() => setNeedsSetup(false)} />
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <main className="screens">
        <section className={`screen ${tab === "news" ? "is-active" : ""}`} aria-hidden={tab !== "news"}>
          <NewsPage />
        </section>
        <section className={`screen ${tab === "papers" ? "is-active" : ""}`} aria-hidden={tab !== "papers"}>
          <PressPage />
        </section>
        <section className={`screen ${tab === "learn" ? "is-active" : ""}`} aria-hidden={tab !== "learn"}>
          <LearnPage />
        </section>
        <section className={`screen ${tab === "me" ? "is-active" : ""}`} aria-hidden={tab !== "me"}>
          <MePage />
        </section>
      </main>
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
