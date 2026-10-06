// 作品カードの描画（ワンドロ結果・月のコラージュ・成長記録）
// 画像（img）は呼ぶ側で読みこんで渡す。標準のCanvas 2D APIだけを使う
import { THEME, deco } from "./render.js";

const { rr, fit, heart, star, ribbon, tape, background, pill } = deco;
const font = (w, px) => deco.font(w, px);
const serif = (px, i, w) => deco.serif(px, i, w);
const hand = (px) => deco.hand(px);
const EN_MONTH = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** 画像を枠いっぱいに切り抜いて描く */
function cover(ctx, img, x, y, w, h) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s, sh = h / s;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}
/** 画像を枠の中に全部入るように描く（ワンドロ結果は切らずに見せたい） */
function contain(ctx, img, x, y, w, h) {
  const s = Math.min(w / img.width, h / img.height);
  const dw = img.width * s, dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/** チェキ風の写真。cx,cy は中心。戻り値は外枠の高さ */
function polaroid(ctx, img, cx, cy, w, h, rot, caption, sub, { fit: mode = "cover", tapeColor } = {}) {
  const pad = Math.max(10, w * 0.045), bottom = Math.max(46, h * 0.17);
  const W = w + pad * 2, H = h + pad + bottom;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.shadowColor = "rgba(80,120,170,0.25)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(-W / 2, -H / 2, W, H);
  ctx.shadowColor = "transparent";
  const ix = -W / 2 + pad, iy = -H / 2 + pad;
  ctx.fillStyle = "#EEF5FC"; ctx.fillRect(ix, iy, w, h);
  if (img) {
    ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, w, h); ctx.clip();
    (mode === "contain" ? contain : cover)(ctx, img, ix, iy, w, h);
    ctx.restore();
  } else {
    ctx.font = font(700, Math.max(16, w * 0.05)); ctx.fillStyle = THEME.faint; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("まだ提出されていないよ", 0, iy + h / 2);
  }
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const capY = H / 2 - bottom / 2;
  if (caption) {
    ctx.font = font(800, Math.max(15, Math.min(26, w * 0.055))); ctx.fillStyle = THEME.ink;
    ctx.fillText(fit(ctx, caption, W - 30), 0, capY - (sub ? 11 : 0));
  }
  if (sub) {
    ctx.font = hand(Math.max(12, Math.min(18, w * 0.04))); ctx.fillStyle = THEME.soft;
    ctx.fillText(fit(ctx, sub, W - 30), 0, capY + 14);
  }
  ctx.restore();
  tape(ctx, cx + Math.sin(rot) * H / 2, cy - Math.cos(rot) * H / 2, Math.min(130, W * 0.4), 26, rot - 0.06, tapeColor);
  return H;
}

function header(ctx, W, { eyebrow, title, pillText, legendRight }) {
  const P = 44;
  ribbon(ctx, P + 50, 84, 78);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.font = hand(26); ctx.fillStyle = THEME.soft;
  ctx.fillText(eyebrow, P + 118, 64);
  ctx.font = font(900, 50); ctx.fillStyle = THEME.ink;
  ctx.fillText(fit(ctx, title, W - P * 2 - 330), P + 116, 128);
  if (pillText) pill(ctx, pillText, P + 120, 176);
  if (legendRight) {
    ctx.font = hand(22); ctx.fillStyle = THEME.blueDeep; ctx.textAlign = "right";
    ctx.fillText(legendRight, W - P, 64);
  }
  tape(ctx, W - P - 110, 104, 180, 34, 0.07);
}

/* ===================== ワンドロの結果 ===================== */
// m = { theme, rare, minutes, date, entries:[{ name, file, title, late }], imgs:[img|null] }
export function pairSize(m) {
  return { width: 1400, height: m.entries.length > 2 ? 1180 : 1000 };
}
export function drawPair(ctx, m, imgs) {
  const { width: W, height: H } = pairSize(m);
  background(ctx, W, H, 21);
  header(ctx, W, {
    eyebrow: m.rare ? "special odai ★★★" : "one drawing",
    title: `「${m.theme}」`,
    pillText: `${m.date}　${m.minutes}分ワンドロ`,
    legendRight: `${m.entries.filter((e) => e.file).length} works`,
  });
  if (m.rare) { star(ctx, W - 300, 150, 14, "#FFE27A"); star(ctx, W - 270, 170, 9, "#FFE27A"); }
  const n = m.entries.length;
  const top = 230, avail = H - top - 40;
  const cols = n <= 1 ? 1 : 2;
  const rows = Math.ceil(n / cols);
  const cellW = (W - 88) / cols, cellH = avail / rows;
  m.entries.forEach((e, k) => {
    const c = k % cols, r = Math.floor(k / cols);
    const cx = 44 + cellW * c + cellW / 2, cy = top + cellH * r + cellH / 2;
    const w = Math.min(cellW * 0.82, (cellH - 90) * 0.98), h = Math.min(cellH - 120, w * 1.05);
    const rot = n === 1 ? -0.015 : k % 2 ? 0.025 : -0.03;
    const sub = [e.title, e.late ? "ちょっと延長" : ""].filter(Boolean).join("　");
    polaroid(ctx, imgs[k], cx, cy, w, h, rot, e.name, sub, { fit: "contain", tapeColor: k % 2 ? "rgba(211,204,255,0.8)" : undefined });
  });
  if (n >= 2) heart(ctx, W / 2, top + cellH / 2, 30);
}

/* ===================== 月のコラージュ ===================== */
// m = { year, month, who, total, items:[{ name, title, theme, date }], imgs }
export function collageSize(m) {
  const n = Math.max(1, m.items.length);
  const cols = n <= 2 ? n : n <= 4 ? 2 : n <= 9 ? 3 : 4;
  const cell = (1400 - 88) / cols;
  const rows = Math.ceil(n / cols);
  return { width: 1400, height: Math.ceil(230 + rows * cell * 1.08 + 70), cols, cell };
}
export function drawCollage(ctx, m, imgs) {
  const { width: W, height: H, cols, cell } = collageSize(m);
  background(ctx, W, H, m.month * 3 + 1);
  header(ctx, W, {
    eyebrow: `${EN_MONTH[m.month - 1]} works`,
    title: `${m.year}年${m.month}月の作品`,
    pillText: `${m.who ? m.who + "　" : ""}${m.total}作品`,
    legendRight: m.total > m.items.length ? `+${m.total - m.items.length} more` : "",
  });
  if (!m.items.length) {
    ctx.font = font(800, 28); ctx.fillStyle = THEME.soft; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("この月の作品はまだないよ", W / 2, 230 + cell * 0.5);
    heart(ctx, W / 2, 230 + cell * 0.5 + 60, 24, "#BFE2FF");
    return;
  }
  m.items.forEach((it, k) => {
    const c = k % cols, r = Math.floor(k / cols);
    const cx = 44 + cell * c + cell / 2, cy = 230 + cell * 1.08 * r + cell * 0.54;
    const w = cell * 0.74, h = w;
    const rot = ((k * 37) % 7 - 3) * 0.012;
    polaroid(ctx, imgs[k], cx, cy, w, h, rot, it.title || (it.theme ? `「${it.theme}」` : it.date), `${it.name}　${it.date}`,
      { tapeColor: k % 3 === 1 ? "rgba(211,204,255,0.8)" : k % 3 === 2 ? "rgba(255,198,220,0.75)" : undefined });
  });
  ctx.font = font(700, 15); ctx.fillStyle = THEME.soft; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillText("作品チャンネルに貼る・/作品・ワンドロの提出 で増えていくよ", W / 2, H - 24);
}

/* ===================== 成長記録 ===================== */
// m = { who, span, count, sameTheme, before:{title,date}, after:{title,date} }
export function growthSize() {
  return { width: 1400, height: 920 };
}
export function drawGrowth(ctx, m, imgs) {
  const { width: W, height: H } = growthSize(m);
  background(ctx, W, H, 33);
  header(ctx, W, {
    eyebrow: "my growth",
    title: `${m.who}の成長記録`,
    pillText: `${m.span}で ${m.count}作品${m.sameTheme ? `　同じお題「${m.sameTheme}」` : ""}`,
  });
  const w = 470, h = 470, cy = 250 + (h + 110) / 2;
  polaroid(ctx, imgs[0], 340, cy, w, h, -0.035, m.before.title || "はじめのころ", `before　${m.before.date}`);
  polaroid(ctx, imgs[1], W - 340, cy, w, h, 0.03, m.after.title || "さいきん", `after　${m.after.date}`, { tapeColor: "rgba(211,204,255,0.8)" });
  // 矢印
  ctx.save();
  ctx.strokeStyle = THEME.blueDeep; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.setLineDash([2, 14]);
  ctx.beginPath(); ctx.moveTo(W / 2 - 80, cy + 10); ctx.quadraticCurveTo(W / 2, cy - 70, W / 2 + 80, cy + 10); ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(W / 2 + 80, cy + 10); ctx.lineTo(W / 2 + 58, cy - 6); ctx.moveTo(W / 2 + 80, cy + 10); ctx.lineTo(W / 2 + 60, cy + 26); ctx.stroke();
  ctx.restore();
  heart(ctx, W / 2, cy - 80, 30);
  ctx.font = font(900, 26); ctx.fillStyle = THEME.ink; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(m.span, W / 2, cy + 60);
  ctx.font = hand(20); ctx.fillStyle = THEME.soft;
  ctx.fillText("keep going!", W / 2, cy + 94);
}
