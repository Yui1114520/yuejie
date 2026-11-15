import { useState } from "react";
import { apiBase, probeApi, setApiBase } from "../../lib/api";

interface Props {
  variant?: "gate" | "inline";
  onSkip?: () => void;
}

export function ConnectionPanel({ variant = "inline", onSkip }: Props) {
  const [value, setValue] = useState(apiBase());
  const [status, setStatus] = useState<{ ok: boolean; detail: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function check() {
    setBusy(true);
    setStatus(await probeApi(value));
    setBusy(false);
  }

  async function save() {
    setBusy(true);
    const result = await probeApi(value);
    setBusy(false);
    setStatus(result);
    if (!result.ok) return;
    setApiBase(value);
    // 各页的数据都是挂载时拉的，换完地址必须整页重载才会重新请求
    window.location.reload();
  }

  return (
    <div className={`conn-card ${variant === "gate" ? "is-gate" : ""}`}>
      <span className="conn-kicker">SERVER</span>
      <h2>连接后端</h2>
      <p className="conn-lead">
        抓源、聚类、翻译、报刊入库都在后端那台机器上跑，App 只负责显示。填对它的地址就能用。
      </p>
      {variant === "gate" ? (
        <ol className="conn-steps">
          <li>
            电脑上运行 <code>npm run dev</code>，终端会打印一行「手机访问」地址。
          </li>
          <li>手机连同一个 WiFi，把那个地址抄进来。</li>
          <li>
            以后要更新 App：手机浏览器打开 <code>http://电脑IP:8787/yuejie.apk</code> 直接下载安装。
          </li>
        </ol>
      ) : null}
      <div className="conn-form">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="http://192.168.1.8:8787"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <button className="conn-save" onClick={save} disabled={busy}>
          {busy ? "连接中" : "保存"}
        </button>
      </div>
      <div className="conn-actions">
        <button className="conn-test" onClick={check} disabled={busy}>
          测试连接
        </button>
        {variant === "gate" && onSkip ? (
          <button className="conn-skip" onClick={onSkip}>
            先跳过
          </button>
        ) : null}
      </div>
      {status ? (
        <p className={`conn-status ${status.ok ? "is-ok" : "is-warn"}`}>{status.detail}</p>
      ) : null}
    </div>
  );
}
