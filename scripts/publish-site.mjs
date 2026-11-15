// 无人值守发布：确保后端在跑 → 重新导出快照 → 推到 Cloudflare Pages。
// 手动用法：node scripts/publish-site.mjs；定时任务也用这一个入口。
import { spawn, spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// CI 上只导出，发布交给 workflow 里的 wrangler 步骤（runner 上没有本机的全局 wrangler）
const exportOnly = process.argv.includes("--export-only");
const PORT = process.env.PORT ?? 8787;
const HEALTH = `http://127.0.0.1:${PORT}/api/health`;
const WRANGLER = "D:/npm-global/node_modules/wrangler/bin/wrangler.js";

function log(line) {
  const stamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`[${stamp}] ${line}`);
}

// 定时任务的环境里没有 npm 脚本注入的变量，自己读 .env（不存在也不报错）
try {
  if (existsSync(path.join(ROOT, ".env"))) process.loadEnvFile(path.join(ROOT, ".env"));
} catch {
  /* 没有 .env 就按默认配置跑 */
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function healthy() {
  try {
    const res = await fetch(HEALTH, { signal: AbortSignal.timeout(4000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureBackend() {
  if (await healthy()) {
    log("后端已在运行");
    return true;
  }
  log("后端未启动，拉起一个");
  const child = spawn(process.execPath, ["--env-file-if-exists=.env", "server/index.mjs"], {
    cwd: ROOT,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  for (let i = 0; i < 40; i += 1) {
    await sleep(3000);
    if (await healthy()) {
      log(`后端就绪（等待 ${(i + 1) * 3}s）`);
      return true;
    }
  }
  log("后端 120 秒内没起来，放弃");
  return false;
}

function run(command, args, label, { shell = false } = {}) {
  log(`开始：${label}`);
  const result = spawnSync(command, args, { cwd: ROOT, stdio: "inherit", shell });
  if (result.status !== 0) {
    log(`${label} 失败，退出码 ${result.status ?? result.signal}`);
    return false;
  }
  log(`${label} 完成`);
  return true;
}

function snapshotAge() {
  const meta = path.join(ROOT, "site", "data", "meta.json");
  if (!existsSync(meta)) return null;
  return statSync(meta).mtime;
}

if (!exportOnly && !existsSync(WRANGLER)) {
  log(`找不到 wrangler：${WRANGLER}`);
  process.exit(2);
}

if (!(await ensureBackend())) process.exit(3);

// 走和手动 npm run site 完全一样的构建，避免定时任务和手动发布产生两种产物
if (!run("npm", ["run", "site"], "构建静态快照", { shell: true })) process.exit(4);

const age = snapshotAge();
if (age) log(`快照文件时间：${age.toISOString()}`);

if (exportOnly) {
  log("按 --export-only 跳过发布");
  process.exit(0);
}

if (!run(process.execPath, [WRANGLER, "pages", "deploy", "site", "--project-name", "yuejie-site", "--branch", "main"], "发布到 Pages")) {
  process.exit(5);
}

log("全部完成");
