// 日付・時刻まわりの計算（すべて日本時間で扱う）
const JST = 9 * 3600 * 1000;
export const WD = ["日", "月", "火", "水", "木", "金", "土"];
const pad = (n) => String(n).padStart(2, "0");

export function nowParts(ms = Date.now()) {
  const d = new Date(ms + JST);
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    hh: d.getUTCHours(),
    mm: d.getUTCMinutes(),
  };
}
export const today = (ms) => nowParts(ms).date;

export function ymd(s) {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}
function valid(y, m, d) {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}
export function make(y, m, d) {
  return valid(y, m, d) ? `${y}-${pad(m)}-${pad(d)}` : null;
}
export function addDays(s, n) {
  const { y, m, d } = ymd(s);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
export function weekday(s) {
  const { y, m, d } = ymd(s);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
export function daysBetween(a, b) {
  const A = ymd(a), B = ymd(b);
  return Math.round((Date.UTC(B.y, B.m - 1, B.d) - Date.UTC(A.y, A.m - 1, A.d)) / 86400000);
}
export function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
export function shiftMonth(y, m, n) {
  const t = (y * 12 + (m - 1)) + n;
  return { y: Math.floor(t / 12), m: (t % 12) + 1 };
}

/** 全角数字や記号を半角にそろえる */
export function normalize(s) {
  return String(s)
    .trim()
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[／]/g, "/")
    .replace(/[：]/g, ":")
    .replace(/[－−]/g, "-")
    .replace(/\s+/g, "");
}

/**
 * 日付の読み取り。例: 今日 / 明日 / あさって / 3日後 / 土曜 / 来週の金曜 / 10/12 / 10月12日 / 12日 / 2026/10/12
 * past=true のときは、年を省略した日付を「いちばん近い過去」として読む（記念日用）
 */
export function parseDate(input, base, { past = false } = {}) {
  const s = normalize(input);
  const rel = { 今日: 0, きょう: 0, 明日: 1, あした: 1, あす: 1, 明後日: 2, あさって: 2, しあさって: 3 };
  if (s in rel) return addDays(base, rel[s]);
  let m;
  if ((m = s.match(/^(\d{1,3})日後$/))) return addDays(base, +m[1]);

  const wd = s.match(/^(来週の?)?([日月火水木金土])(曜日?)?$/);
  if (wd) {
    const target = WD.indexOf(wd[2]);
    const w = weekday(base);
    if (wd[1]) {
      // 来週（月曜はじまり）の その曜日
      const nextMon = addDays(base, 7 - ((w + 6) % 7));
      return addDays(nextMon, (target + 6) % 7);
    }
    return addDays(base, (target - w + 7) % 7);
  }

  const { y: by, m: bm } = ymd(base);
  if ((m = s.match(/^(\d{4})[/\-.年](\d{1,2})[/\-.月](\d{1,2})日?$/))) return make(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[/\-.月](\d{1,2})日?$/))) {
    let d = make(by, +m[1], +m[2]);
    if (past) { if (d && d > base) d = make(by - 1, +m[1], +m[2]); }
    else if (d && d < base) d = make(by + 1, +m[1], +m[2]);
    return d;
  }
  if (!past && (m = s.match(/^(\d{1,2})日$/))) {
    let d = make(by, bm, +m[1]);
    if (!d || d < base) {
      const n = shiftMonth(by, bm, 1);
      d = make(n.y, n.m, +m[1]);
    }
    return d;
  }
  return null;
}

/** 時刻の読み取り。例: 19:00 / 19時 / 19時半 / 7時15分 / 午後7時 / 1930 / 19 */
export function parseTime(input) {
  let s = normalize(input);
  let pm = false;
  if (/^(午後|PM|pm|夜)/.test(s)) { pm = true; s = s.replace(/^(午後|PM|pm|夜)/, ""); }
  else s = s.replace(/^(午前|AM|am|朝)/, "");
  let m, h, mi = 0;
  if ((m = s.match(/^(\d{1,2}):(\d{2})$/))) { h = +m[1]; mi = +m[2]; }
  else if ((m = s.match(/^(\d{1,2})時(半|(\d{1,2})分?)?$/))) { h = +m[1]; mi = m[2] === "半" ? 30 : m[3] ? +m[3] : 0; }
  else if ((m = s.match(/^(\d{1,2})(\d{2})$/))) { h = +m[1]; mi = +m[2]; }
  else if ((m = s.match(/^(\d{1,2})$/))) h = +m[1];
  else return null;
  if (pm && h < 12) h += 12;
  if (h > 23 || mi > 59) return null;
  return `${pad(h)}:${pad(mi)}`;
}

export function toMs(date, time = "00:00") {
  const { y, m, d } = ymd(date);
  const [hh, mm] = time.split(":").map(Number);
  return Date.UTC(y, m - 1, d, hh, mm) - JST;
}
export const startMs = (ev) => toMs(ev.date, ev.time || "00:00");
export const endMs = (ev) => (ev.time ? startMs(ev) + (ev.hours || 2) * 3600000 : toMs(addDays(ev.date, 1)));

export function fmtDate(s) {
  const { m, d } = ymd(s);
  return `${m}/${d}(${WD[weekday(s)]})`;
}
export function sortEvents(list) {
  return list.slice().sort((a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || ""));
}

/** だれの予定も入っていない日 */
export function freeDays(events, base, n, weekendOnly = false) {
  const busy = new Set(events.map((e) => e.date));
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = addDays(base, i);
    const w = weekday(d);
    if (weekendOnly && w !== 0 && w !== 6) continue;
    if (!busy.has(d)) out.push(d);
  }
  return out;
}

/** 記念日まわり（付き合った日を1日目として数える） */
export function anniversary(start, base) {
  const n = daysBetween(start, base) + 1;
  if (n < 1) return null;
  const S = ymd(start), B = ymd(base);
  let months = (B.y - S.y) * 12 + (B.m - S.m);
  if (B.d < S.d) months--;
  const isMonthly = B.d === S.d && months > 0;
  const isYearly = isMonthly && months % 12 === 0;
  const nextHundred = Math.floor(n / 100) * 100 + 100;
  let ny = make(B.y, S.m, S.d) || make(B.y, 3, 1);
  if (ny <= base) ny = make(B.y + 1, S.m, S.d) || make(B.y + 1, 3, 1);
  return {
    n,
    months,
    years: Math.floor(months / 12),
    isMonthly,
    isYearly,
    isHundred: n % 100 === 0,
    nextHundred,
    toHundred: nextHundred - n,
    nextYearDate: ny,
    toYear: daysBetween(base, ny),
  };
}

/** その月の中で記念日（○か月・○周年・100日ごと）にあたる日 */
export function anniversaryDaysInMonth(start, y, m) {
  if (!start) return {};
  const out = {};
  const S = ymd(start);
  for (let d = 1; d <= daysInMonth(y, m); d++) {
    const date = make(y, m, d);
    if (date < start) continue;
    const a = anniversary(start, date);
    if (date === start) out[date] = "付き合った日";
    else if (a.isYearly) out[date] = `${a.years}周年`;
    else if (a.isHundred) out[date] = `${a.n}日目`;
    else if (a.isMonthly) out[date] = `${a.months}か月`;
  }
  void S;
  return out;
}

/**
 * 1行の文章から予定を読み取る
 * 例: 「明日19時ごはん」「土曜 13:30 水族館デート」「10/12 映画」「来週の金曜 夜8時 通話」
 *     「12日 18時〜21時 飲み会」「あさって バイト ひとり」
 * people = [{ id, names: ["けんくん", "けん"] }] を渡すと、名前が書いてあればその人の予定にする
 * 戻り値: { date|null, time|null, hours, both|null, who|null, title }
 */
export function parseQuick(input, base, people = []) {
  let s = " " + String(input)
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[／]/g, "/").replace(/[：]/g, ":").replace(/[～〜]/g, "~").replace(/　/g, " ") + " ";
  let date = null, time = null, hours = 2, both = null, who = null;
  const take = (re, fn) => {
    const m = s.match(re);
    if (!m) return false;
    const v = fn(m);
    if (v === null || v === undefined) return false;
    s = s.slice(0, m.index) + " " + s.slice(m.index + m[0].length);
    return v;
  };

  // 日付（上から順にためす）
  const dateRules = [
    [/(\d{4})[/.\-年](\d{1,2})[/.\-月](\d{1,2})日?/, (m) => make(+m[1], +m[2], +m[3])],
    [/(\d{1,2})月(\d{1,2})日/, (m) => parseDate(`${m[1]}/${m[2]}`, base)],
    [/(?<![\d:])(\d{1,2})\/(\d{1,2})(?![\d:])/, (m) => parseDate(`${m[1]}/${m[2]}`, base)],
    [/(しあさって|明後日|あさって|明日|あした|あす|今日|きょう)/, (m) => parseDate(m[1], base)],
    [/(\d{1,3})日後/, (m) => addDays(base, +m[1])],
    [/(来週末|今週末|週末)/, (m) => {
      const sat = parseDate("土曜", base);
      return m[1] === "来週末" ? addDays(sat, 7) : sat;
    }],
    [/(来週の?)?([日月火水木金土])曜日?/, (m) => parseDate(`${m[1] || ""}${m[2]}`, base)],
    [/(?<![\d/月])(\d{1,2})日(?![後間])/, (m) => parseDate(`${m[1]}日`, base)],
  ];
  for (const [re, fn] of dateRules) {
    const v = take(re, fn);
    if (v) { date = v; break; }
  }

  // 時刻（〜終わりの時刻もあれば長さにする）
  const T = "(午前|午後|朝|昼|夜|AM|PM|am|pm)?\\s*(\\d{1,2})(?::(\\d{2})|時(半|(\\d{1,2})分)?)";
  const toHM = (pre, h, mm, half, mins) => {
    h = +h;
    let mi = mm ? +mm : half === "半" ? 30 : mins ? +mins : 0;
    if (/午後|夜|PM|pm/.test(pre || "") && h < 12) h += 12;
    if (pre === "昼" && h <= 6) h += 12;
    if (h > 24 || mi > 59) return null;
    if (h === 24) h = 0;
    return [h, mi];
  };
  take(new RegExp(T + "(?:\\s*(?:~|-|から)\\s*" + T + ")?"), (m) => {
    const st = toHM(m[1], m[2], m[3], m[4], m[5]);
    if (!st) return null;
    time = `${String(st[0]).padStart(2, "0")}:${String(st[1]).padStart(2, "0")}`;
    if (m[7]) {
      let en = toHM(m[6] || (st[0] >= 12 && +m[7] < 12 ? "午後" : ""), m[7], m[8], m[9], m[10]);
      if (en) {
        let diff = en[0] * 60 + en[1] - (st[0] * 60 + st[1]);
        if (diff <= 0) diff += 24 * 60;
        hours = Math.min(24, Math.max(1, Math.round(diff / 60)));
      }
    }
    return true;
  });

  // だれの予定か（名前 → ひとり/じぶん → ふたり の順）
  const aliases = people.flatMap((p) => p.names.filter((n) => n && n.length >= 2).map((n) => ({ id: p.id, n })))
    .sort((a, b) => b.n.length - a.n.length);
  const found = new Set();
  for (const { id, n } of aliases) {
    const re = new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(と|の予定)?");
    while (take(re, () => true)) found.add(id);
  }
  if (found.size === 1) { who = [...found][0]; both = false; }
  else if (found.size > 1) both = true; // ふたりとも書いてあったら ふたりの予定
  if (both === null) take(/(ひとりで|ひとり|一人で|一人|じぶん|自分)(の予定)?/, () => { both = false; return true; });
  if (both === null) take(/(ふたりで|ふたり|二人で|二人)(の予定)?/, () => { both = true; return true; });

  // 残りが内容
  let title = s.replace(/\s+/g, " ").trim()
    .replace(/^(に|で|の|は|から|、|,|\s)+/, "")
    .replace(/(に|で|を|の|、|,|\s)+$/, "")
    .trim();
  if (!title) title = "予定";
  return { date, time, hours, both, who, title: title.slice(0, 60) };
}

/** 呼び名から、文章で使われそうな言い方を作る（例: けんくん → けんくん / けん） */
export function nameAliases(name) {
  if (!name) return [];
  const out = [name];
  const stem = name.replace(/(ちゃん|くん|君|さん|たん|ちゃ)$/, "");
  if (stem !== name && stem.length >= 2) out.push(stem);
  return out;
}
