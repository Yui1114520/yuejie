import { ChevronRightIcon } from "../../components/Icons";
import { inAppShell } from "../../lib/api";
import { ConnectionPanel } from "../shell/ConnectionPanel";

export function MePage() {
  return (
    <div className="page placeholder">
      <span className="placeholder-kicker">PROFILE</span>
      <h1>我的</h1>

      <div className="profile-card">
        <span className="profile-avatar">阅</span>
        <div>
          <b>阅界读者</b>
          <p>{inAppShell ? "数据在你自己的后端机器上" : "数据仅保存在这台设备上"}</p>
        </div>
      </div>

      <div className="stats">
        <div>
          <b>0</b>
          <span>今日阅读</span>
        </div>
        <div>
          <b>0</b>
          <span>收藏</span>
        </div>
        <div>
          <b>0</b>
          <span>连续天数</span>
        </div>
      </div>

      <div className="setting-list">
        <Row label="内容偏好" value="国际" />
        <Row label="推送设置" value="暂未开启" />
        <Row label="每日节奏" value="早报 08:00 · 晚报 20:00" />
        <Row label="关于阅界" value="v0.1.0" />
      </div>

      {inAppShell ? <ConnectionPanel /> : null}

      <div className="soon-banner">
        <span>收藏、阅读历史与个性化推荐将在后续版本上线</span>
        <span className="soon-badge">BETA</span>
      </div>
    </div>
  );
}


function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="setting-row">
      <span>{label}</span>
      <span className="setting-value">
        {value}
        <ChevronRightIcon width={14} height={14} />
      </span>
    </div>
  );
}
