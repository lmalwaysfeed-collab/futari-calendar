// 予定と設定の保存（bot と同じフォルダの data.json に書きます）
// ・書きこみは「一時ファイルに書いてから入れかえ」で、途中で電源が落ちても壊れにくくする
// ・毎日1つ backups/ にコピーを残し（14日分）、data.json が壊れていたら一番新しいコピーから戻す
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FILE = process.env.DATA_FILE || path.join(DIR, "data.json");
const BACKUP_DIR = path.join(path.dirname(FILE), "backups");
const KEEP_DAYS = 14;

function tryRead(file) {
  try {
    const text = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
    const data = JSON.parse(text);
    return data && typeof data === "object" && data.guilds ? data : null;
  } catch {
    return null;
  }
}

function load() {
  if (!fs.existsSync(FILE)) return { guilds: {} };
  const data = tryRead(FILE);
  if (data) return data;
  // こわれていたら、とっておいてからバックアップで戻す
  const broken = `${FILE}.broken-${Date.now()}`;
  try { fs.copyFileSync(FILE, broken); } catch {}
  const candidates = [`${FILE}.tmp`];
  try {
    candidates.push(...fs.readdirSync(BACKUP_DIR).filter((n) => n.endsWith(".json")).sort().reverse().map((n) => path.join(BACKUP_DIR, n)));
  } catch {}
  for (const c of candidates) {
    const d = tryRead(c);
    if (d) {
      console.warn(`data.json がこわれていたので、${path.basename(c)} から戻しました（こわれたファイルは ${path.basename(broken)} に残してあります）`);
      return d;
    }
  }
  console.error(`data.json がこわれていて、バックアップもありませんでした。空の状態からはじめます（こわれたファイルは ${path.basename(broken)}）`);
  return { guilds: {} };
}

export const db = load();

let lastBackupDay = "";
function backup() {
  const day = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  if (day === lastBackupDay) return;
  lastBackupDay = day;
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    fs.copyFileSync(FILE, path.join(BACKUP_DIR, `data-${day}.json`));
    const files = fs.readdirSync(BACKUP_DIR).filter((n) => /^data-\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
    for (const old of files.slice(0, Math.max(0, files.length - KEEP_DAYS))) fs.unlinkSync(path.join(BACKUP_DIR, old));
  } catch (e) {
    console.warn("バックアップを作れませんでした:", e.message);
  }
}

export function save() {
  const text = JSON.stringify(db, null, 2);
  const tmp = FILE + ".tmp";
  try {
    fs.writeFileSync(tmp, text);
    try {
      fs.renameSync(tmp, FILE);
    } catch {
      // ほかのソフトがファイルをつかんでいて入れかえられないときは、そのまま上書きする
      fs.writeFileSync(FILE, text);
      try { fs.unlinkSync(tmp); } catch {}
    }
    backup();
  } catch (e) {
    console.error("data.json に保存できませんでした:", e.message);
  }
}

export function guildData(id) {
  db.guilds[id] ??= { config: { morningHour: 8, members: [], names: {} }, events: [], nextId: 1 };
  const g = db.guilds[id];
  g.config ??= {};
  g.config.members ??= [];
  g.config.names ??= {};
  g.events ??= [];
  g.nextId ??= 1;
  return g;
}
