// カレンダー画像の描画（標準のCanvas 2D APIだけを使う）
// テーマ: 水色の韓国ガーリー ─ ギンガムチェック、リボン、マスキングテープ、シールっぽいハート

export const THEME = {
  ink: "#3D5F8C",
  soft: "#86A6CC",
  faint: "#BCD4EC",
  sun: "#E290B4",
  sat: "#5C9BE0",
  blue: "#8CC8F5",
  blueDeep: "#6AAFE8",
  pink: "#FFB7D2",
  freeInk: "#4AA6DD",
  chipInk: "#2D4A72",
  paper: "#FFFFFF",
};
// ふたり=水色　1人目=ラベンダー　2人目=ミルク
export const COLORS = { both: "#A8DAFF", a: "#D3CCFF", b: "#F1F4FA", other: "#DFE4EC" };

let FONT = `"Yu Gothic UI","BIZ UDPGothic","Meiryo","Hiragino Sans","Noto Sans CJK JP",sans-serif`;
let SERIF = `"Georgia","Times New Roman","Noto Serif CJK JP",serif`;
let HAND = `"Segoe Print","Ink Free"`;
export function setFont(f) { FONT = f; }
export function setSerifFont(f) { SERIF = f; }
export function setHandFont(f) { HAND = f; }
const font = (w, px) => `${w} ${px}px ${FONT}`;
const serif = (px, italic = false, w = 400) => `${italic ? "italic " : ""}${w} ${px}px ${SERIF}`;
const hand = (px) => `400 ${px}px ${HAND},${SERIF}`;
const WD = ["日", "月", "火", "水", "木", "金", "土"];
const WD_EN = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const EN_MONTH = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const dayColor = (w) => (w === 0 ? THEME.sun : w === 6 ? THEME.sat : THEME.ink);

/* ======================= 基本パーツ ======================= */
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function fit(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + "…").width > maxW) s = s.slice(0, -1);
  return s + "…";
}
function wrap(ctx, text, maxW, maxLines) {
  const lines = [];
  let cur = "";
  for (const ch of text) {
    if (ctx.measureText(cur + ch).width > maxW && cur) {
      lines.push(cur); cur = ch;
      if (lines.length === maxLines) break;
    } else cur += ch;
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.join("").length < [...text].length && lines.length) lines[lines.length - 1] = fit(ctx, lines[lines.length - 1] + "…", maxW);
  return lines;
}

/* ======================= デコパーツ ======================= */
/** シールっぽいハート（白いふち＋つや） */
function heart(ctx, cx, cy, s, color = THEME.pink, outline = true) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.4);
  ctx.bezierCurveTo(cx - s * 0.95, cy - s * 0.18, cx - s * 0.5, cy - s * 0.95, cx, cy - s * 0.42);
  ctx.bezierCurveTo(cx + s * 0.5, cy - s * 0.95, cx + s * 0.95, cy - s * 0.18, cx, cy + s * 0.4);
  ctx.closePath();
  if (outline) {
    ctx.lineWidth = s * 0.28; ctx.strokeStyle = "#FFFFFF"; ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(90,140,200,0.25)"; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1;
    ctx.stroke(); ctx.shadowColor = "transparent";
  }
  ctx.fillStyle = color; ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx - s * 0.3, cy - s * 0.38, s * 0.13, s * 0.08, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.fill();
  ctx.restore();
}
function star(ctx, x, y, s, color) {
  ctx.save(); ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const r = k % 2 ? s * 0.45 : s;
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath(); ctx.lineJoin = "round";
  ctx.lineWidth = s * 0.25; ctx.strokeStyle = "#FFFFFF"; ctx.stroke();
  ctx.fillStyle = color; ctx.fill(); ctx.restore();
}
/** リボン（ちょうちょ結び） */
function ribbon(ctx, x, y, s, rot = -0.12) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.shadowColor = "rgba(90,140,200,0.3)"; ctx.shadowBlur = s * 0.12; ctx.shadowOffsetY = s * 0.04;
  const grad = (y0, y1) => {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, "#C9E7FF"); g.addColorStop(1, THEME.blueDeep);
    return g;
  };
  // たれ
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(d * s * 0.06, s * 0.05);
    ctx.quadraticCurveTo(d * s * 0.25, s * 0.45, d * s * 0.42, s * 0.85);
    ctx.lineTo(d * s * 0.3, s * 0.76);
    ctx.lineTo(d * s * 0.22, s * 0.92);
    ctx.quadraticCurveTo(d * s * 0.08, s * 0.5, -d * s * 0.04, s * 0.08);
    ctx.closePath();
    ctx.fillStyle = grad(0, s); ctx.fill();
  }
  // 輪
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(d * s * 0.35, -s * 0.55, d * s * 0.85, -s * 0.35, d * s * 0.7, s * 0.05);
    ctx.bezierCurveTo(d * s * 0.6, s * 0.3, d * s * 0.25, s * 0.2, 0, 0);
    ctx.closePath();
    ctx.fillStyle = grad(-s * 0.5, s * 0.3); ctx.fill();
  }
  ctx.shadowColor = "transparent";
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(d * s * 0.14, -s * 0.06);
    ctx.quadraticCurveTo(d * s * 0.4, -s * 0.34, d * s * 0.6, -s * 0.12);
    ctx.lineWidth = s * 0.035; ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineCap = "round"; ctx.stroke();
  }
  // 結び目
  rr(ctx, -s * 0.13, -s * 0.13, s * 0.26, s * 0.26, s * 0.08);
  ctx.fillStyle = THEME.blue; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.stroke();
  ctx.restore();
}
/** 水玉のマスキングテープ */
function tape(ctx, x, y, w, h, rot, color = "rgba(168,218,255,0.75)") {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath();
  const z = 4;
  ctx.moveTo(-w / 2, -h / 2);
  ctx.lineTo(w / 2, -h / 2);
  for (let k = 1; k <= 6; k++) ctx.lineTo(w / 2 - (k % 2 ? z : 0), -h / 2 + (h * k) / 6);
  ctx.lineTo(-w / 2, h / 2);
  for (let k = 5; k >= 0; k--) ctx.lineTo(-w / 2 + (k % 2 ? z : 0), -h / 2 + (h * k) / 6);
  ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  ctx.clip();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  let row = 0;
  for (let py = -h / 2 + 6; py < h / 2; py += 12, row++) {
    for (let px = -w / 2 + 6 + (row % 2) * 8; px < w / 2; px += 16) {
      ctx.beginPath(); ctx.arc(px, py, 2.4, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}
/** ギンガムチェックの背景 */
function background(ctx, W, H, seed = 3) {
  ctx.fillStyle = "#F4F9FF"; ctx.fillRect(0, 0, W, H);
  const step = 36, band = 18;
  ctx.fillStyle = "rgba(160,205,245,0.18)";
  for (let x = 0; x < W; x += step) ctx.fillRect(x, 0, band, H);
  for (let y = 0; y < H; y += step) ctx.fillRect(0, y, W, band);
  let r = seed;
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  [[W - 54, H - 46, "heart"], [42, H - 40, "star"], [W * 0.5 + 330, 52, "star"]].forEach(([x, y, kind]) => {
    if (kind === "heart") heart(ctx, x, y, 20 + rnd() * 4, "#BFE2FF");
    else star(ctx, x, y, 10 + rnd() * 3, "#FFF1A8");
  });
}
/** 白い紙（カード） */
function paper(ctx, x, y, w, h, r, { fill = THEME.paper, stroke = "rgba(170,205,238,0.9)", lw = 1.2, dashed = false, shadow = true } = {}) {
  ctx.save();
  if (shadow) { ctx.shadowColor = "rgba(100,150,210,0.18)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3; }
  rr(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
  ctx.restore();
  ctx.save();
  if (dashed) ctx.setLineDash([6, 5]);
  rr(ctx, x, y, w, h, r); ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke();
  ctx.restore();
}
function chip(ctx, x, y, w, h, color) {
  rr(ctx, x, y, w, h, Math.min(12, h / 2));
  ctx.fillStyle = color; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = "rgba(140,180,222,0.6)"; ctx.stroke();
}
function pill(ctx, text, x, y, size = 16) {
  ctx.font = font(700, size);
  const tw = ctx.measureText(text).width;
  const w = tw + size * 2.9, h = size * 2.1;
  paper(ctx, x, y - h / 2, w, h, h / 2, { lw: 1.2 });
  heart(ctx, x + size * 1.1, y, size * 0.9, THEME.pink, false);
  ctx.fillStyle = THEME.ink; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillText(text, x + size * 2, y + 1);
}
function legend(ctx, items, right, y) {
  ctx.font = font(700, 16);
  const ws = items.map((it) => ctx.measureText(it.label).width + 46);
  let x = right - (ws.reduce((a, b) => a + b, 0) + (items.length - 1) * 10);
  items.forEach((it, k) => {
    paper(ctx, x, y - 17, ws[k], 34, 17, { lw: 1 });
    ctx.beginPath(); ctx.arc(x + 18, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = it.color; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = "rgba(130,170,215,0.8)"; ctx.stroke();
    ctx.fillStyle = THEME.ink; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(it.label, x + 32, y + 1);
    x += ws[k] + 10;
  });
}

/* ======================= 月カレンダー ======================= */
export function monthSize(m) {
  const first = m.days[0].weekday;
  const rows = Math.ceil((first + m.days.length) / 7);
  return { width: 1400, height: 240 + 46 + rows * 164 + 56, rows };
}
export function drawMonth(ctx, m) {
  const { width: W, height: H } = monthSize(m);
  background(ctx, W, H, m.month * 7 + 3);

  // 見出し
  const P = 44;
  ribbon(ctx, P + 50, 84, 78);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.font = hand(22); ctx.fillStyle = THEME.soft;
  ctx.fillText(String(m.year), P + 122, 62);
  ctx.font = serif(100); ctx.fillStyle = THEME.ink;
  ctx.fillText(String(m.month), P + 116, 156);
  const mw = ctx.measureText(String(m.month)).width;
  ctx.font = hand(42); ctx.fillStyle = THEME.blueDeep;
  ctx.fillText(EN_MONTH[m.month - 1], P + 130 + mw, 152);
  if (m.subtitle) pill(ctx, m.subtitle, P + 120, 204);
  legend(ctx, m.legend, W - P, 204);
  tape(ctx, W - P - 110, 78, 180, 34, 0.07);

  const gx = P, gy = 240, cw = (W - P * 2) / 7, ch = 164;
  WD.forEach((w, i) => {
    const cx = gx + cw * i + cw / 2;
    ctx.textBaseline = "alphabetic";
    ctx.font = font(800, 17); ctx.fillStyle = dayColor(i); ctx.textAlign = "right";
    ctx.fillText(w, cx - 3, gy + 32);
    ctx.font = hand(15); ctx.fillStyle = THEME.soft; ctx.textAlign = "left";
    ctx.fillText(WD_EN[i], cx + 3, gy + 32);
  });

  const byDate = {};
  for (const e of m.events) (byDate[e.date] ||= []).push(e);
  const first = m.days[0].weekday;

  m.days.forEach((d, i) => {
    const idx = first + i;
    const r = Math.floor(idx / 7), c = idx % 7;
    const x = gx + c * cw + 5, y = gy + 46 + r * ch + 5, w = cw - 10, h = ch - 10;
    const isToday = d.date === m.today;
    const isPast = d.date < m.today;
    const isFree = !!m.free?.includes(d.date);
    paper(ctx, x, y, w, h, 16, {
      fill: isFree ? "#EAF6FF" : isPast ? "rgba(255,255,255,0.6)" : THEME.paper,
      stroke: isToday ? THEME.blueDeep : isFree ? "rgba(106,175,232,0.9)" : "rgba(170,205,238,0.9)",
      lw: isToday ? 2.4 : 1.2, dashed: isFree && !isToday, shadow: !isPast,
    });
    if (isToday) tape(ctx, x + w / 2 + 20, y + 1, 76, 20, 0.08);

    // 日付
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const nx = x + 27, ny = y + 28;
    if (isToday) {
      ctx.beginPath(); ctx.arc(nx, ny, 19, 0, Math.PI * 2); ctx.fillStyle = THEME.blue; ctx.fill();
      ctx.font = serif(23, false, 700); ctx.fillStyle = "#FFFFFF";
      ctx.fillText(String(d.day), nx, ny + 1);
      ctx.font = hand(17); ctx.fillStyle = THEME.blueDeep; ctx.textAlign = "left";
      ctx.fillText("today", nx + 26, ny + 2);
    } else {
      ctx.font = serif(26); ctx.fillStyle = dayColor(d.weekday);
      ctx.globalAlpha = isPast ? 0.45 : 1;
      ctx.fillText(String(d.day), nx, ny + 1);
      ctx.globalAlpha = 1;
    }
    if (isFree) {
      ctx.font = font(800, 15); ctx.fillStyle = THEME.freeInk; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("あいてる", x + w / 2 - 9, y + h - 24);
      heart(ctx, x + w / 2 + ctx.measureText("あいてる").width / 2 + 6, y + h - 23, 14, "#BFE2FF");
    }
    const an = m.anniv?.[d.date];
    if (an) {
      heart(ctx, x + w - 22, y + 27, 22);
      ctx.font = font(800, 12.5); ctx.fillStyle = "#D97AA5"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.fillText(fit(ctx, an, w - 100), x + w - 38, y + 29);
    }

    const list = byDate[d.date] || [];
    const maxChips = 3;
    ctx.save();
    ctx.globalAlpha = isPast ? 0.5 : 1;
    list.slice(0, list.length > maxChips ? maxChips - 1 : maxChips).forEach((e, k) => {
      const cy = y + 54 + k * 30;
      chip(ctx, x + 8, cy, w - 16, 25, e.color);
      ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = THEME.chipInk;
      const time = e.time ? e.time.replace(/^0/, "") : "";
      let tx = x + 16;
      if (time) { ctx.font = serif(14, false, 700); ctx.fillText(time, tx, cy + 13.5); tx += ctx.measureText(time).width + 6; }
      ctx.font = font(700, 14);
      ctx.fillText(fit(ctx, e.title, x + w - 14 - tx), tx, cy + 13.5);
    });
    if (list.length > maxChips) {
      ctx.font = font(700, 13.5); ctx.fillStyle = THEME.soft; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(`+ ほか ${list.length - (maxChips - 1)}件`, x + 14, y + 54 + (maxChips - 1) * 30 + 13);
    }
    ctx.restore();
  });

  ctx.font = font(700, 15); ctx.fillStyle = THEME.soft; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillText(m.footer || "", W / 2, H - 20);
}

/* ======================= 1週間の予定表 ======================= */
export function weekSize(w) {
  const byDate = {};
  for (const e of w.events) byDate[e.date] = (byDate[e.date] || 0) + 1;
  const most = Math.max(2, ...w.days.map((d) => Math.min(byDate[d.date] || 0, 5)));
  return { width: 1400, height: 240 + 124 + most * 100 + 50 };
}
export function drawWeek(ctx, w) {
  const { width: W, height: H } = weekSize(w);
  background(ctx, W, H, 11);
  const P = 44;
  ribbon(ctx, P + 50, 84, 78);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.font = hand(58); ctx.fillStyle = THEME.ink;
  ctx.fillText("this week", P + 116, 134);
  const tw = ctx.measureText("this week").width;
  ctx.font = font(800, 20); ctx.fillStyle = THEME.soft;
  ctx.fillText(w.title, P + 136 + tw, 130);
  if (w.headline) pill(ctx, w.headline, P + 120, 194);
  legend(ctx, w.legend, W - P, 194);
  tape(ctx, W - P - 110, 78, 180, 34, 0.07);

  const byDate = {};
  for (const e of w.events) (byDate[e.date] ||= []).push(e);
  const cw = (W - P * 2) / 7, top = 240, bottom = H - 36;

  w.days.forEach((d, i) => {
    const x = P + i * cw + 5, cwid = cw - 10;
    const isToday = d.date === w.today;
    paper(ctx, x, top, cwid, bottom - top, 18, { stroke: isToday ? THEME.blueDeep : "rgba(170,205,238,0.9)", lw: isToday ? 2.4 : 1.2 });
    if (isToday) tape(ctx, x + cwid / 2, top + 1, 92, 24, -0.05);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = serif(18); ctx.fillStyle = dayColor(d.weekday);
    ctx.fillText(`${d.month}.${d.day}`, x + cwid / 2, top + 28);
    if (isToday) { ctx.beginPath(); ctx.arc(x + cwid / 2, top + 68, 27, 0, Math.PI * 2); ctx.fillStyle = THEME.blue; ctx.fill(); }
    ctx.font = font(800, 29); ctx.fillStyle = isToday ? "#FFFFFF" : dayColor(d.weekday);
    ctx.fillText(WD[d.weekday], x + cwid / 2, top + 69);
    ctx.font = hand(16); ctx.fillStyle = isToday ? THEME.blueDeep : THEME.soft;
    ctx.fillText(isToday ? "today" : WD_EN[d.weekday], x + cwid / 2, top + 110);
    if (w.anniv?.[d.date]) heart(ctx, x + cwid - 22, top + 26, 18);

    const list = byDate[d.date] || [];
    let y = top + 130;
    if (!list.length) {
      ctx.font = font(700, 15); ctx.fillStyle = THEME.faint; ctx.textBaseline = "middle"; ctx.textAlign = "center";
      ctx.fillText("予定なし", x + cwid / 2, y + 30);
      heart(ctx, x + cwid / 2, y + 66, 13, "#DCEBFA", false);
    }
    list.slice(0, 5).forEach((e) => {
      chip(ctx, x + 8, y, cwid - 16, 90, e.color);
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = THEME.chipInk;
      ctx.font = e.time ? serif(22, false, 700) : font(800, 18);
      ctx.fillText(e.time ? e.time.replace(/^0/, "") : "終日", x + 18, y + 31);
      ctx.font = font(700, 15.5);
      wrap(ctx, e.title, cwid - 36, 2).forEach((ln, k) => ctx.fillText(ln, x + 18, y + 57 + k * 21));
      y += 100;
    });
    if (list.length > 5) {
      ctx.font = font(700, 14); ctx.fillStyle = THEME.soft; ctx.textAlign = "center";
      ctx.fillText(`+ ほか${list.length - 5}件`, x + cwid / 2, bottom - 12);
    }
  });
}
