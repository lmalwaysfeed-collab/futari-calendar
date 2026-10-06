// 予定と設定の保存（bot と同じフォルダの data.json に書きます）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FILE = process.env.DATA_FILE || path.join(path.dirname(fileURLToPath(import.meta.url)), "data.json");

export const db = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { guilds: {} };

export function save() {
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, FILE);
}

export function guildData(id) {
  db.guilds[id] ??= { config: { morningHour: 8, members: [], names: {} }, events: [], nextId: 1 };
  const g = db.guilds[id];
  g.config.members ??= [];
  g.config.names ??= {};
  return g;
}
