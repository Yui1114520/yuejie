const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

export function formatDateLabel(date = new Date()) {
  return `${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAYS[date.getDay()]}`;
}

export function formatClock(iso: string | number | Date) {
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function timeAgo(iso: string, now = Date.now()) {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const diff = Math.max(0, now - ms);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days === 1) return `昨天 ${formatClock(iso)}`;
  if (days < 7) return `${days} 天前`;
  const date = new Date(ms);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function sourceSummary(sources: { shortName: string }[], max = 2) {
  if (!sources.length) return "";
  const names = sources.slice(0, max).map((source) => source.shortName).join(" · ");
  return sources.length > max ? `${names} +${sources.length - max}` : names;
}
