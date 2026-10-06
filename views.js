// 保存データ → 画像に描く内容 への変換
import * as L from "./lib.js";
import { COLORS } from "./render.js";

/** 予定の色: ふたり=空色, 1人目=ラベンダー, 2人目=パール */
export function colorOf(ev, g) {
  if (ev.both) return COLORS.both;
  const i = (g.config.members || []).indexOf(ev.by);
  return i === 0 ? COLORS.a : i === 1 ? COLORS.b : COLORS.other;
}
export function nameOf(g, id) {
  return g.config.nick?.[id] || g.config.names?.[id] || "だれか";
}
export function legendOf(g) {
  const items = [{ label: "ふたり", color: COLORS.both }];
  const mem = g.config.members || [];
  if (mem[0]) items.push({ label: nameOf(g, mem[0]), color: COLORS.a });
  if (mem[1]) items.push({ label: nameOf(g, mem[1]), color: COLORS.b });
  return items;
}
const chip = (g) => (e) => ({ date: e.date, time: e.time, title: e.title, color: colorOf(e, g) });

export function monthModel(g, y, m, today) {
  const days = [];
  for (let d = 1; d <= L.daysInMonth(y, m); d++) {
    const date = L.make(y, m, d);
    days.push({ date, day: d, weekday: L.weekday(date) });
  }
  const from = days[0].date, to = days[days.length - 1].date;
  const events = L.sortEvents(g.events.filter((e) => e.date >= from && e.date <= to)).map(chip(g));
  const anniv = L.anniversaryDaysInMonth(g.config.anniversary, y, m);
  let subtitle = "ふたりのカレンダー";
  if (g.config.anniversary) {
    const a = L.anniversary(g.config.anniversary, today);
    if (a) subtitle = `付き合って ${a.n.toLocaleString()} 日目`;
  }
  const count = events.length;
  return {
    year: y, month: m, today, days, events, anniv, legend: legendOf(g), subtitle,
    footer: count ? `この月の予定 ${count}件` : "この月の予定はまだありません　/予定追加 で入れてね",
  };
}

export function weekModel(g, today) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = L.addDays(today, i);
    const { m, d } = L.ymd(date);
    days.push({ date, month: m, day: d, weekday: L.weekday(date) });
  }
  const to = days[6].date;
  const events = L.sortEvents(g.events.filter((e) => e.date >= today && e.date <= to)).map(chip(g));
  const anniv = {};
  for (const d of days) {
    const a = g.config.anniversary && L.anniversary(g.config.anniversary, d.date);
    if (a && (a.isMonthly || a.isHundred || d.date === g.config.anniversary)) anniv[d.date] = true;
  }
  return { title: "これから1週間", today, days, events, anniv, legend: legendOf(g), headline: headline(g, today) };
}

/** 朝のひとこと（次のふたりの予定・記念日） */
export function headline(g, today) {
  const parts = [];
  const nextBoth = L.sortEvents(g.events.filter((e) => e.both && e.date >= today))[0];
  if (nextBoth) {
    const n = L.daysBetween(today, nextBoth.date);
    parts.push(n === 0 ? `今日は「${nextBoth.title}」の日！` : `「${nextBoth.title}」まであと ${n} 日`);
  }
  if (g.config.anniversary) {
    const a = L.anniversary(g.config.anniversary, today);
    if (a) parts.push(`付き合って ${a.n.toLocaleString()} 日目`);
  }
  return parts.join("　・　");
}
