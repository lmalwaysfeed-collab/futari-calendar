// botの記録を bot.log にも残す（画面に出ない自動起動でも、あとから見られるように）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import util from "node:util";

const dir = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(dir, "bot.log");
const PID = path.join(dir, "bot.pid");

try { if (fs.statSync(FILE).size > 1_000_000) fs.renameSync(FILE, FILE + ".old"); } catch {}

const stamp = () => {
  const d = new Date(Date.now() + 9 * 3600_000);
  return d.toISOString().replace("T", " ").slice(0, 19);
};
for (const level of ["log", "warn", "error"]) {
  const orig = console[level].bind(console);
  console[level] = (...args) => {
    orig(...args);
    try { fs.appendFileSync(FILE, `[${stamp()}] ${level === "log" ? "" : level.toUpperCase() + " "}${util.format(...args)}\n`); } catch {}
  };
}

/**
 * 同じフォルダのbotが2つ動かないようにする。
 * すでに動いているbotがいれば、あとから起動したほうがあきらめる（止めあいで何度もログインしないように）。
 * 動いているbotは30秒ごとに「生きてるよ」を書きこむので、止まったbotの記録はすぐ古くなる。
 */
export function acquireLock() {
  try {
    const raw = fs.readFileSync(PID, "utf8");
    const info = raw.trim().startsWith("{") ? JSON.parse(raw) : null;
    if (info?.pid && info.pid !== process.pid && Date.now() - (info.beat || 0) < 90_000) {
      try { process.kill(info.pid, 0); return false; } catch {}
    }
  } catch {}
  const beat = () => { try { fs.writeFileSync(PID, JSON.stringify({ pid: process.pid, beat: Date.now() })); } catch {} };
  beat();
  setInterval(beat, 30_000).unref();
  return true;
}
export function releaseLock() {
  try {
    const info = JSON.parse(fs.readFileSync(PID, "utf8"));
    if (info.pid === process.pid) fs.unlinkSync(PID);
  } catch {}
}
