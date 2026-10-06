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

/** 同じフォルダのbotが2つ動かないようにする（古いほうを止める） */
export function takeOver() {
  try {
    const old = Number(fs.readFileSync(PID, "utf8"));
    if (old && old !== process.pid) {
      try { process.kill(old, 0); process.kill(old); console.warn(`前に動いていたbot（pid ${old}）を止めました`); } catch {}
    }
  } catch {}
  try { fs.writeFileSync(PID, String(process.pid)); } catch {}
}
