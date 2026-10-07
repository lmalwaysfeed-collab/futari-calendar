// GitHub から新しいバージョンを取ってきて入れかえる
// .env の UPDATE_REPO=ユーザー名/futari-calendar を使う（公開リポジトリ）
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BRANCH = () => process.env.UPDATE_BRANCH || "main";
const DEFAULT_REPO = "lmalwaysfeed-collab/futari-calendar";
const REPO = () => {
  const v = (process.env.UPDATE_REPO || "").trim().replace(/^["']|["']$/g, "").replace(/^https?:\/\/(www\.)?github\.com\//, "").replace(/\.git$/, "").replace(/\/+$/, "");
  return /^[\w.-]+\/[\w.-]+$/.test(v) ? v : DEFAULT_REPO;
};
// 上書きしないもの（あなたの設定・予定・記録）
const KEEP = new Set(["gallery", "backups", "bot.starts", ".env", "data.json", "data.json.tmp", "bot.log", "bot.log.old", "bot.pid", "node_modules", ".git"]);

export const configured = () => true;
export const repoName = () => REPO();

export function localVersion() {
  try { return JSON.parse(fs.readFileSync(path.join(DIR, "package.json"), "utf8")).version; } catch { return "?"; }
}

/** GitHub にある最新のバージョン番号 */
export async function remoteVersion() {
  const r = await fetch(`https://raw.githubusercontent.com/${REPO()}/${BRANCH()}/package.json?t=${Date.now()}`, { cache: "no-store" });
  if (r.status === 404 && REPO() !== DEFAULT_REPO) {
    // .env の UPDATE_REPO がまちがっていそうなときは、いつものリポジトリでもう一度ためす
    const r2 = await fetch(`https://raw.githubusercontent.com/${DEFAULT_REPO}/${BRANCH()}/package.json?t=${Date.now()}`, { cache: "no-store" });
    if (r2.ok) { process.env.UPDATE_REPO = DEFAULT_REPO; return (await r2.json()).version; }
  }
  if (!r.ok) throw new Error(`GitHub の「${REPO()}」から読めませんでした（${r.status}）。.env の UPDATE_REPO を確認してね`);
  return (await r.json()).version;
}

export function isNewer(a, b) {
  const pa = String(a).split(".").map(Number), pb = String(b).split(".").map(Number);
  for (let k = 0; k < Math.max(pa.length, pb.length); k++) {
    if ((pa[k] || 0) !== (pb[k] || 0)) return (pa[k] || 0) > (pb[k] || 0);
  }
  return false;
}

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, shell: process.platform === "win32", windowsHide: true });
    let out = "";
    p.stdout?.on("data", (d) => (out += d));
    p.stderr?.on("data", (d) => (out += d));
    p.on("exit", (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} が失敗しました: ${out.slice(-400)}`))));
    p.on("error", reject);
  });
}

function copyOver(src, dst, changed) {
  for (const name of fs.readdirSync(src)) {
    if (KEEP.has(name)) continue;
    const s = path.join(src, name), d = path.join(dst, name);
    // 動いている start-bot.bat を途中で書きかえると、Windowsがおかしな行を実行することがあるので、
    // start-bot.bat.new として置いておき、stop-all.bat / service-on*.bat を使ったときに入れかえる
    if (/^start-bot\.bat$/i.test(name) && fs.existsSync(d)) {
      const after = fs.readFileSync(s);
      if (!fs.readFileSync(d).equals(after)) { fs.writeFileSync(d + ".new", after); changed.push(path.relative(DIR, d) + "（stop-all.bat か service-on のときに入れかえ）"); }
      continue;
    }
    if (fs.statSync(s).isDirectory()) {
      fs.mkdirSync(d, { recursive: true });
      copyOver(s, d, changed);
    } else {
      const before = fs.existsSync(d) ? fs.readFileSync(d) : null;
      const after = fs.readFileSync(s);
      if (!before || !before.equals(after)) { fs.writeFileSync(d, after); changed.push(path.relative(DIR, d)); }
    }
  }
}

/** 新しいファイルを取ってきて上書きする。戻り値: { changed: [...], installed: bool } */
export async function update() {
  const pkgBefore = fs.readFileSync(path.join(DIR, "package.json"), "utf8");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "futari-update-"));
  try {
    const zip = path.join(tmp, "src.zip");
    const r = await fetch(`https://codeload.github.com/${REPO()}/zip/refs/heads/${BRANCH()}`);
    if (!r.ok) throw new Error(`ダウンロードできませんでした（${r.status}）`);
    fs.writeFileSync(zip, Buffer.from(await r.arrayBuffer()));
    await run("tar", ["-xf", zip, "-C", tmp], tmp); // Windows 10 以降に入っている tar で zip を展開
    const top = fs.readdirSync(tmp).find((n) => fs.statSync(path.join(tmp, n)).isDirectory());
    if (!top) throw new Error("ダウンロードしたファイルが空でした");
    const changed = [];
    copyOver(path.join(tmp, top), DIR, changed);
    let installed = false;
    const pkgAfter = fs.readFileSync(path.join(DIR, "package.json"), "utf8");
    const deps = (s) => JSON.stringify(JSON.parse(s).dependencies || {});
    if (deps(pkgBefore) !== deps(pkgAfter) || !fs.existsSync(path.join(DIR, "node_modules"))) {
      await run(process.platform === "win32" ? "npm.cmd" : "npm", ["install", "--no-audit", "--no-fund"], DIR);
      installed = true;
    }
    return { changed, installed };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
