// 作品ギャラリー・お題ガチャ・ワンドロ のデータまわり
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as L from "./lib.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
export const GALLERY_DIR = path.join(DIR, "gallery");

/* ===================== お題 ===================== */
export const THEMES = {
  きせつ: ["雨の日", "夏祭り", "雪の朝", "桜", "ハロウィン", "クリスマス", "花火", "海辺", "紅葉", "梅雨明け", "真夏の昼", "初詣"],
  ばしょ: ["夜の街", "放課後の教室", "喫茶店", "水族館", "図書館", "屋上", "駅のホーム", "遊園地", "コンビニ", "お花畑", "宇宙", "海の底"],
  もの: ["傘", "ぬいぐるみ", "手紙", "ケーキ", "ヘッドホン", "リボン", "鍵", "花束", "猫", "うさぎ", "金魚", "星"],
  きもち: ["はじめまして", "おやすみ", "ないしょ", "ドキドキ", "ひとやすみ", "さよなら", "おかえり", "うれしい", "ねむい", "わくわく"],
  ふく: ["おそろいの服", "制服", "パジャマ", "浴衣", "メイド服", "スーツ", "ゴスロリ", "ジャージ", "天使", "魔法少女"],
  いろ: ["水色だけ", "モノクロ", "パステル", "赤と黒", "3色だけ", "夕焼け色"],
};
const ALL = Object.values(THEMES).flat();

/** ふたりのお題（こっそり追加したもの）。むかしの文字だけの形も読めるようにする */
export function secretThemes(g) {
  g.themes = (g.themes || []).map((t) => (typeof t === "string" ? { text: t, by: null, drawn: 0 } : t));
  return g.themes;
}
export function addSecret(g, text, by) {
  const list = secretThemes(g);
  const t = String(text).trim().slice(0, 30);
  if (!t) return null;
  if (list.some((x) => x.text === t)) return { dup: true, total: list.length };
  list.push({ text: t, by, drawn: 0, at: Date.now() });
  return { total: list.length, waiting: list.filter((x) => !x.drawn).length };
}

/** お題ガチャ。12%で2つ組み合わせの★★★、ひみつのお題があれば30%でそこから（まだ出てないもの優先） */
export function gacha(g) {
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const secrets = secretThemes(g);
  const roll = Math.random();
  if (roll < 0.12) {
    const cats = Object.keys(THEMES);
    const a = pick(cats);
    let b = pick(cats);
    while (b === a) b = pick(cats);
    return { theme: `${pick(THEMES[a])} × ${pick(THEMES[b])}`, rarity: 3 };
  }
  if (roll < 0.42 && secrets.length) {
    const fresh = secrets.filter((x) => !x.drawn);
    const s = pick(fresh.length ? fresh : secrets);
    const first = !s.drawn;
    s.drawn = (s.drawn || 0) + 1;
    return { theme: s.text, rarity: 2, secretBy: s.by, first };
  }
  return { theme: pick(ALL), rarity: roll < 0.6 ? 2 : 1 };
}

/* ===================== 作品の保存 ===================== */
const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/webp": "webp" };

export function isImage(att) {
  const type = (att.contentType || "").split(";")[0];
  return !!EXT[type] || /\.(png|jpe?g|webp)$/i.test(att.name || "");
}

/** Discordの添付画像をダウンロードして gallery/ に保存し、記録を返す */
export async function saveArtwork(guildId, g, att, { by, title = "", theme = "", source = "post" }) {
  if (!isImage(att)) throw new Error("保存できるのは画像（png / jpg / webp）だけだよ");
  if (att.size > 25 * 1024 * 1024) throw new Error("画像が大きすぎるよ（25MBまで）");
  const ext = EXT[(att.contentType || "").split(";")[0]] || (att.name.match(/\.(png|jpe?g|webp)$/i)?.[1] || "png").toLowerCase().replace("jpeg", "jpg");
  const r = await fetch(att.url);
  if (!r.ok) throw new Error(`画像をダウンロードできなかったよ（${r.status}）`);
  const buf = Buffer.from(await r.arrayBuffer());
  g.art ??= [];
  g.artNext ??= 1;
  const id = g.artNext++;
  const dir = path.join(GALLERY_DIR, String(guildId));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join("gallery", String(guildId), `${id}.${ext}`);
  fs.writeFileSync(path.join(DIR, file), buf);
  const rec = { id, by, file, title: String(title).slice(0, 40), theme, date: L.today(), at: Date.now(), source };
  g.art.push(rec);
  return rec;
}

export function removeArtwork(g, id) {
  const k = (g.art || []).findIndex((a) => a.id === id);
  if (k < 0) return null;
  const [rec] = g.art.splice(k, 1);
  try { fs.unlinkSync(absPath(rec)); } catch {}
  return rec;
}

export const absPath = (rec) => path.join(DIR, rec.file);

export function monthArts(g, y, m, who) {
  const prefix = `${y}-${String(m).padStart(2, "0")}-`;
  return (g.art || []).filter((a) => a.date.startsWith(prefix) && (!who || a.by === who)).sort((a, b) => a.at - b.at);
}

/** 成長記録に使う2枚（同じお題が2回以上あればそのお題の最初と最後、なければ最初と最新） */
export function growthPair(g, who) {
  const list = (g.art || []).filter((a) => a.by === who).sort((a, b) => a.at - b.at);
  if (list.length < 2) return { count: list.length };
  const byTheme = {};
  for (const a of list) if (a.theme) (byTheme[a.theme] ||= []).push(a);
  const repeated = Object.entries(byTheme).filter(([, v]) => v.length >= 2).sort((a, b) => (b[1].at(-1).at - b[1][0].at) - (a[1].at(-1).at - a[1][0].at))[0];
  const [before, after, sameTheme] = repeated ? [repeated[1][0], repeated[1].at(-1), repeated[0]] : [list[0], list.at(-1), ""];
  const days = L.daysBetween(before.date, after.date);
  const span = days >= 60 ? `${Math.round(days / 30)}か月` : days >= 14 ? `${Math.round(days / 7)}週間` : `${Math.max(1, days)}日`;
  return { count: list.length, before, after, sameTheme, span };
}
