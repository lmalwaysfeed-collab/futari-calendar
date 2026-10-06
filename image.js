// カレンダーをPNG画像にする（くっきり見えるように2倍の解像度で書き出す）
import fs from "node:fs";
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import { drawMonth, monthSize, drawWeek, weekSize, setFont, setSerifFont, setHandFont } from "./render.js";
import * as AR from "./art-render.js";

const SCALE = 2;

// 使えるフォントをさがす（Windowsのフォントを優先）
const files = [
  ["C:/Windows/Fonts/YuGothB.ttc", "Yu Gothic UI"],
  ["C:/Windows/Fonts/YuGothM.ttc", "Yu Gothic UI"],
  ["C:/Windows/Fonts/BIZ-UDGothicB.ttc", "BIZ UDPGothic"],
  ["C:/Windows/Fonts/meiryob.ttc", "Meiryo"],
  ["C:/Windows/Fonts/meiryo.ttc", "Meiryo"],
  ["C:/Windows/Fonts/georgia.ttf", "Georgia"],
  ["C:/Windows/Fonts/georgiab.ttf", "Georgia"],
  ["C:/Windows/Fonts/georgiai.ttf", "Georgia"],
  ["C:/Windows/Fonts/segoepr.ttf", "Segoe Print"],
  ["C:/Windows/Fonts/Inkfree.ttf", "Ink Free"],
];
const have = () => new Set(GlobalFonts.families.map((f) => f.family));
let fams = have();
for (const [file, family] of files) {
  if (fams.has(family)) continue;
  try { if (fs.existsSync(file)) GlobalFonts.registerFromPath(file, family); } catch {}
}
if (process.env.FONT_FILE) {
  try { GlobalFonts.registerFromPath(process.env.FONT_FILE, "CustomFont"); } catch {}
}
fams = have();
const pick = (list) => list.filter((f) => fams.has(f));
const jp = pick(["CustomFont", "Yu Gothic UI", "Yu Gothic", "BIZ UDPGothic", "Meiryo", "Hiragino Sans", "Noto Sans CJK JP"]);
const latin = pick(["Georgia", "Times New Roman", "Noto Serif CJK JP"]);
if (jp.length) setFont(jp.map((f) => `"${f}"`).join(",") + ",sans-serif");
if (latin.length) setSerifFont(latin.map((f) => `"${f}"`).join(",") + (jp.length ? `,"${jp[0]}"` : "") + ",serif");
const handList = pick(["Segoe Print", "Ink Free"]);
if (handList.length) setHandFont(handList.map((f) => `"${f}"`).join(","));
if (!jp.length) console.warn("日本語フォントが見つかりません。.env に FONT_FILE=C:/Windows/Fonts/meiryo.ttc を足してください");

function render(sizeFn, drawFn, model) {
  const { width, height } = sizeFn(model);
  const canvas = createCanvas(Math.ceil(width * SCALE), Math.ceil(height * SCALE));
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);
  drawFn(ctx, model);
  return canvas.toBuffer("image/png");
}
export const monthPng = (model) => render(monthSize, drawMonth, model);
export const weekPng = (model) => render(weekSize, drawWeek, model);

/* 作品カード（ワンドロ結果・コラージュ・成長記録）。model.files に画像ファイルの場所が入っている */
const ART = { pair: [AR.pairSize, AR.drawPair], collage: [AR.collageSize, AR.drawCollage], growth: [AR.growthSize, AR.drawGrowth] };
export async function artPng(kind, model) {
  const imgs = await Promise.all((model.files || []).map(async (f) => {
    if (!f) return null;
    try { return await loadImage(fs.readFileSync(f)); } catch { return null; }
  }));
  const [sizeFn, drawFn] = ART[kind];
  const { width, height } = sizeFn(model);
  const canvas = createCanvas(Math.ceil(width * SCALE), Math.ceil(height * SCALE));
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);
  drawFn(ctx, model, imgs);
  return canvas.toBuffer("image/png");
}
