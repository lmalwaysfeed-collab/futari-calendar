// ふたりカレンダー bot 本体
// 起動: npm start
import { takeOver } from "./logger.js";
import {
  Client, GatewayIntentBits, Events, ApplicationCommandOptionType as T, ChannelType,
  EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel,
} from "discord.js";
import * as L from "./lib.js";
import { db, save, guildData } from "./store.js";
import { monthModel, weekModel, headline, nameOf } from "./views.js";
import { monthPng, weekPng } from "./pictures.js";

import * as UP from "./updater.js";
export const VERSION = UP.localVersion();
import * as SV from "./servers.js";
import os from "node:os";

/* ---------------- コマンド定義 ---------------- */
const COMMANDS = [
  {
    name: "よてい", description: "予定を1行で追加（例: 明日19時 ごはん）",
    options: [{ type: T.String, name: "なにする", description: "例: 明日19時 ごはん / 土曜 水族館 / あさって バイト ひとり", required: true, max_length: 100 }],
  },
  {
    name: "カレンダー", description: "月のカレンダーを画像で表示",
    options: [{ type: T.String, name: "月", description: "例: 11 / 2026/11（省略すると今月）" }],
  },
  { name: "これから", description: "これから1週間の予定表を表示" },
  {
    name: "予定削除", description: "予定を消す",
    options: [{ type: T.String, name: "予定", description: "消す予定をえらんでね", required: true, autocomplete: true }],
  },
  {
    name: "空いてる日", description: "ふたりとも予定が入っていない日をさがす",
    options: [
      { type: T.Integer, name: "日数", description: "何日先までさがすか（省略すると30日）", min_value: 1, max_value: 90 },
      { type: T.Boolean, name: "土日だけ", description: "土日だけにしぼる" },
    ],
  },
  { name: "記念日", description: "付き合って何日目か表示" },
  {
    name: "設定", description: "チャンネル・相手・記念日などの設定（何も入れないと今の設定を表示）",
    options: [
      { type: T.Channel, name: "予定チャンネル", description: "ここに書いた文章を予定として読み取るチャンネル", channel_types: [ChannelType.GuildText] },
      { type: T.Channel, name: "通知チャンネル", description: "朝のお知らせとリマインドを送るチャンネル", channel_types: [ChannelType.GuildText] },
      { type: T.User, name: "あいて", description: "いっしょに使う相手" },
      { type: T.String, name: "わたしの呼び名", description: "例: ゆいちゃん（カレンダーと文章の読み取りに使う）", max_length: 12 },
      { type: T.String, name: "あいての呼び名", description: "例: けんくん", max_length: 12 },
      { type: T.String, name: "記念日", description: "付き合った日 例: 2025/7/12" },
      { type: T.Integer, name: "朝の時刻", description: "朝のお知らせを送る時（0〜23、はじめは8時）", min_value: 0, max_value: 23 },
      { type: T.String, name: "synctube", description: "いつも使うSyncTubeのお部屋のURL（消すときは「なし」）" },
      { type: T.Boolean, name: "通話でボタン", description: "ボイスチャンネルに入ったら SyncTube ボタンを出す（はじめはオン）" },
    ],
  },
  { name: "みる", description: "SyncTube を開くボタンを出す" },
  { name: "サーバー", description: "仕訳バトルのサーバーを起動・停止する（ボタンで操作）" },
];

/* ---------------- 共通 ---------------- */
const SKY = 0x8fd3ff, LAVENDER = 0xc3bcff, MIST = 0xb9d3ec;
const esc = (s) => String(s).replace(/([*_`~|\\>])/g, "\\$1");
const unix = (ms) => Math.floor(ms / 1000);
const eph = (content) => ({ content, flags: MessageFlags.Ephemeral });
const timeLabel = (ev) => (ev.time ? ev.time.replace(/^0/, "") : "終日");
const endLabel = (ev) => { const p = L.nowParts(L.endMs(ev)); return `${p.hh}:${String(p.mm).padStart(2, "0")}`; };

function rememberName(g, user, member) {
  g.config.names[user.id] = member?.displayName || user.globalName || user.username;
}
function whoIcon(g, ev) {
  if (ev.both) return "🩵";
  return ev.by === g.config.members[1] ? "🤍" : "💜";
}
function whoText(g, ev) {
  return ev.both ? "ふたりの予定" : `${nameOf(g, ev.by)}の予定`;
}
function mentionsFor(g, ev) {
  const ids = ev.both && g.config.members.length ? g.config.members : [ev.by];
  return [...new Set(ids)];
}
function eventLine(g, ev) {
  return `${whoIcon(g, ev)} \`${L.fmtDate(ev.date)} ${timeLabel(ev)}\`　${esc(ev.title)}`;
}

/* ---------------- ボタン ---------------- */
const addButton = () => new ButtonBuilder().setCustomId("add").setLabel("予定を追加").setEmoji("🎀").setStyle(ButtonStyle.Primary);
function syncButton(g) {
  const url = g?.config?.synctube;
  return url ? new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(url).setLabel("SyncTube").setEmoji("🎬") : null;
}
function navRow(y, m, g) {
  const p = L.shiftMonth(y, m, -1), n = L.shiftMonth(y, m, 1);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`cal:${p.y}-${p.m}`).setLabel(`◀ ${p.m}月`).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("cal:now").setLabel("今月").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`cal:${n.y}-${n.m}`).setLabel(`${n.m}月 ▶`).setStyle(ButtonStyle.Secondary),
    addButton(),
  );
  const sb = syncButton(g);
  if (sb) row.addComponents(sb);
  return row;
}
function eventRow(g, ev) {
  const row = new ActionRowBuilder();
  const opts = g.config.members.length === 2
    ? [["both", "ふたり", "🩵"], [g.config.members[0], nameOf(g, g.config.members[0]), "💜"], [g.config.members[1], nameOf(g, g.config.members[1]), "🤍"]]
    : [["both", "ふたり", "🩵"], [ev.by, "じぶんだけ", "💜"]];
  for (const [val, label, emoji] of opts) {
    const on = val === "both" ? ev.both : !ev.both && ev.by === val;
    row.addComponents(new ButtonBuilder().setCustomId(`ev:set:${ev.id}:${val}`).setLabel(label.slice(0, 20)).setEmoji(emoji)
      .setStyle(on ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(on));
  }
  row.addComponents(new ButtonBuilder().setCustomId(`ev:undo:${ev.id}`).setLabel("取り消し").setEmoji("🗑️").setStyle(ButtonStyle.Danger));
  return row;
}
async function monthFile(g, y, m, extra = {}) {
  const model = monthModel(g, y, m, L.today());
  if (extra.free) model.free = extra.free;
  return new AttachmentBuilder(await monthPng(model), { name: "calendar.png" });
}
async function monthMessage(g, y, m, extra = {}) {
  return { embeds: [], files: [await monthFile(g, y, m, extra)], components: [navRow(y, m, g)], attachments: [] };
}

/* ---------------- 予定の追加 ---------------- */
async function createDiscordEvent(guild, g, ev) {
  const start = L.startMs(ev), end = L.endMs(ev);
  if (start <= Date.now() + 60_000) return null; // 過去・直前は登録できない
  try {
    const se = await guild.scheduledEvents.create({
      name: ev.title,
      scheduledStartTime: new Date(start),
      scheduledEndTime: new Date(end),
      privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
      entityType: GuildScheduledEventEntityType.External,
      entityMetadata: { location: whoText(g, ev) },
      description: "ふたりカレンダーから追加",
    });
    return se.id;
  } catch (e) {
    console.warn("Discordのイベント欄への登録に失敗:", e.message);
    return null;
  }
}

/** p = parseQuick の結果。成功なら { ev }、だめなら { error } */
async function addEvent(guild, g, p, userId) {
  const ev = { id: 0, title: p.title, date: p.date, time: p.time, hours: p.hours || 2, both: p.both ?? true, by: p.who || userId, reminded: false };
  if (ev.date < L.today() || (ev.time && L.startMs(ev) < Date.now())) {
    return { error: `${L.fmtDate(ev.date)} ${timeLabel(ev)} はもう過ぎているみたい。日付を入れ直してね` };
  }
  ev.id = g.nextId++;
  ev.discordEventId = await createDiscordEvent(guild, g, ev);
  g.events.push(ev);
  save();
  return { ev };
}

async function addedCard(g, ev) {
  const days = L.daysBetween(L.today(), ev.date);
  const { y, m } = L.ymd(ev.date);
  const embed = new EmbedBuilder()
    .setColor(ev.both ? SKY : LAVENDER)
    .setAuthor({ name: "🎀 予定をとうろくしたよ" })
    .setTitle(ev.title)
    .setDescription(
      `**${L.fmtDate(ev.date)}　${ev.time ? `${timeLabel(ev)}〜${endLabel(ev)}` : "終日"}**\n` +
      `${whoIcon(g, ev)} ${whoText(g, ev)}　・　${days === 0 ? "今日です！" : `あと **${days}** 日`}` +
      (ev.discordEventId ? "\n-# サーバーのイベント欄にものせました" : ""),
    )
    .setImage("attachment://calendar.png");
  return { embeds: [embed], files: [await monthFile(g, y, m)], components: [eventRow(g, ev), navRow(y, m, g)], attachments: [] };
}

/* 日付が書いてなかったとき「いつ？」と聞く */
const pending = new Map(); // id → { p, by, at }
function askDate(p, userId) {
  for (const [k, v] of pending) if (Date.now() - v.at > 30 * 60_000) pending.delete(k);
  const pid = Math.random().toString(36).slice(2, 8);
  pending.set(pid, { p, by: userId, at: Date.now() });
  const t = L.today();
  const opts = [
    ["今日", t], ["明日", L.addDays(t, 1)], ["あさって", L.addDays(t, 2)],
    ["土曜", L.parseDate("土曜", t)], ["日曜", L.parseDate("日曜", t)],
  ];
  const seen = new Set();
  const row = new ActionRowBuilder();
  for (const [label, d] of opts) {
    if (seen.has(d)) continue;
    seen.add(d);
    row.addComponents(new ButtonBuilder().setCustomId(`pick:${pid}:${d}`).setLabel(`${label} ${L.fmtDate(d)}`).setStyle(ButtonStyle.Primary));
  }
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pick:${pid}:other`).setLabel("ほかの日を書く").setEmoji("✏️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`pick:${pid}:cancel`).setLabel("やめる").setStyle(ButtonStyle.Secondary),
  );
  const embed = new EmbedBuilder().setColor(SKY)
    .setTitle(`🎀「${p.title}」はいつ？`)
    .setDescription(`${p.time ? `${timeLabel(p)}〜　` : ""}日付をえらんでね`);
  return { embeds: [embed], components: [row, row2] };
}

function addModal(title = "予定を追加 🎀", value = "") {
  const input = new TextInputBuilder()
    .setCustomId("q").setLabel("いつ・なにする？").setStyle(TextInputStyle.Short)
    .setPlaceholder("例: 明日19時 ごはん / 土曜 水族館 / 12日 バイト ひとり")
    .setRequired(true).setMaxLength(100);
  if (value) input.setValue(value);
  return new ModalBuilder().setCustomId("addModal").setTitle(title).addComponents(new ActionRowBuilder().addComponents(input));
}

/** 文章を受け取って、追加できたらカード、日付がなければ「いつ？」を返す */
function peopleOf(g) {
  return g.config.members.map((id) => ({ id, names: [...L.nameAliases(g.config.nick?.[id]), ...L.nameAliases(g.config.names?.[id])] }));
}
async function fromText(guild, g, text, userId) {
  const p = L.parseQuick(text, L.today(), peopleOf(g));
  if (!p.date) return askDate(p, userId);
  const r = await addEvent(guild, g, p, userId);
  if (r.error) return { content: r.error };
  return await addedCard(g, r.ev);
}

/* ---------------- 各コマンド ---------------- */
async function cmdQuick(i, g) {
  await i.deferReply();
  await i.editReply(await fromText(i.guild, g, i.options.getString("なにする"), i.user.id));
}

async function cmdCalendar(i, g) {
  const t = L.today();
  let { y, m } = L.ymd(t);
  const s = i.options.getString("月");
  if (s) {
    const n = L.normalize(s).replace(/月$/, "");
    const mm = n.match(/^(?:(\d{4})[/\-.年])?(\d{1,2})$/);
    if (!mm || +mm[2] < 1 || +mm[2] > 12) return i.reply(eph("月が読めませんでした。例: `11` `2026/11`"));
    if (mm[1]) y = +mm[1];
    else if (+mm[2] < m - 6) y += 1; // 「1月」と書いたら来年の1月
    m = +mm[2];
  }
  await i.deferReply();
  await i.editReply(await monthMessage(g, y, m));
}

async function weekMessage(g, t, { morning = false } = {}) {
  const upcoming = L.sortEvents(g.events.filter((e) => e.date >= t)).slice(0, 10);
  const todays = g.events.filter((e) => e.date === t);
  let special = "";
  if (morning && g.config.anniversary) {
    const a = L.anniversary(g.config.anniversary, t);
    if (a?.isYearly) special = `🎉 今日は付き合って **${a.years}周年** ！おめでとう`;
    else if (a?.isHundred) special = `🎉 今日は付き合って **${a.n}日目** ！`;
    else if (a?.isMonthly) special = `💐 今日は **${a.months}か月記念日** ！`;
  }
  const list = morning
    ? (todays.length ? "**今日の予定**\n" + L.sortEvents(todays).map((e) => eventLine(g, e)).join("\n") : "今日の予定はないよ")
    : (upcoming.length ? upcoming.map((e) => eventLine(g, e)).join("\n") : "予定はまだないよ。下の 🎀 から入れてね");
  const head = headline(g, t);
  const embed = new EmbedBuilder()
    .setColor(SKY)
    .setTitle(morning ? `🫧 おはよう 今日は ${L.fmtDate(t)}` : "🎀 これからの予定")
    .setDescription((special ? special + "\n\n" : "") + list + (morning && head ? `\n\n-# ${head}` : ""))
    .setImage("attachment://week.png")
    .setFooter({ text: "🩵 ふたり　💜🤍 それぞれ" });
  const file = new AttachmentBuilder(await weekPng(weekModel(g, t)), { name: "week.png" });
  const row = new ActionRowBuilder().addComponents(
    addButton(),
    new ButtonBuilder().setCustomId("cal:now").setLabel("カレンダー").setEmoji("🗓️").setStyle(ButtonStyle.Secondary),
  );
  const sb = syncButton(g);
  if (sb) row.addComponents(sb);
  return { embeds: [embed], files: [file], components: [row] };
}
async function cmdWeek(i, g) {
  await i.deferReply();
  await i.editReply(await weekMessage(g, L.today()));
}

async function cmdDelete(i, g) {
  const id = Number(i.options.getString("予定"));
  const ev = removeEvent(i.guild, g, id);
  if (!ev) return i.reply(eph("その予定は見つかりませんでした。候補の中からえらんでね"));
  await i.reply({ embeds: [deletedEmbed(ev)] });
}
function removeEvent(guild, g, id) {
  const idx = g.events.findIndex((e) => e.id === id);
  if (idx < 0) return null;
  const [ev] = g.events.splice(idx, 1);
  save();
  if (ev.discordEventId) guild.scheduledEvents.delete(ev.discordEventId).catch(() => {});
  return ev;
}
const deletedEmbed = (ev) => new EmbedBuilder().setColor(MIST).setTitle("🫧 予定を消したよ")
  .setDescription(`~~${L.fmtDate(ev.date)} ${timeLabel(ev)}　${esc(ev.title)}~~`);

async function cmdFree(i, g) {
  const n = i.options.getInteger("日数") ?? 30;
  const weekend = i.options.getBoolean("土日だけ") ?? false;
  const t = L.today();
  const free = L.freeDays(g.events, t, n, weekend);
  await i.deferReply();
  const { y, m } = L.ymd(t);
  const text = free.length
    ? free.slice(0, 40).map((d) => `\`${L.fmtDate(d)}\``).join(" ") + (free.length > 40 ? ` ほか${free.length - 40}日` : "")
    : "この期間は空いている日がなかったよ";
  const embed = new EmbedBuilder()
    .setColor(SKY)
    .setTitle(`🩵 ${weekend ? "土日で" : ""}ふたりとも空いてる日`)
    .setDescription(`${n}日先までに **${free.length}日** あるよ\n${text}`)
    .setImage("attachment://calendar.png")
    .setFooter({ text: "点線で囲まれたマスが空いてる日（祝日は考えていません）" });
  await i.editReply({ ...(await monthMessage(g, y, m, { free })), embeds: [embed] });
}

async function cmdAnniv(i, g) {
  if (!g.config.anniversary) return i.reply(eph("記念日がまだ設定されていないよ。`/設定 記念日:2025/7/12` のように入れてね"));
  const t = L.today();
  const a = L.anniversary(g.config.anniversary, t);
  if (!a) return i.reply(eph("記念日が未来の日付になっているよ。`/設定` で直してね"));
  const special = a.isYearly ? `🎉 今日は **${a.years}周年** ！` : a.isHundred ? `🎉 今日は **${a.n}日目** ！` : a.isMonthly ? `💐 今日は **${a.months}か月記念日** ！` : "";
  const embed = new EmbedBuilder()
    .setColor(SKY)
    .setTitle(`🎀 付き合って ${a.n.toLocaleString()} 日目`)
    .setDescription(
      (special ? special + "\n\n" : "") +
      `付き合った日　${g.config.anniversary.replace(/-/g, "/")}\n` +
      `🩵 ${a.nextHundred}日目まで　あと **${a.toHundred}** 日\n` +
      `🩵 ${a.years + 1}周年（${L.fmtDate(a.nextYearDate)}）まで　あと **${a.toYear}** 日`,
    );
  await i.reply({ embeds: [embed] });
}

async function cmdSettings(i, g) {
  const inCh = i.options.getChannel("予定チャンネル");
  const ch = i.options.getChannel("通知チャンネル");
  const partner = i.options.getUser("あいて");
  const anniv = i.options.getString("記念日");
  const hour = i.options.getInteger("朝の時刻");
  const myNick = i.options.getString("わたしの呼び名");
  const theirNick = i.options.getString("あいての呼び名");
  const sync = i.options.getString("synctube");
  const syncAuto = i.options.getBoolean("通話でボタン");
  if (sync) {
    if (/^(なし|無し|消す|off|none)$/i.test(sync.trim())) delete g.config.synctube;
    else {
      const u = toUrl(sync);
      if (!u) return i.reply(eph("URLが読めなかったよ。`https://sync-tube.de/rooms/...` のように、ブラウザの上に出ているURLをそのまま貼ってね"));
      g.config.synctube = u;
    }
  }
  if (syncAuto !== null) g.config.syncAuto = syncAuto;
  if (inCh) g.config.inputChannelId = inCh.id;
  if (ch) g.config.channelId = ch.id;
  if (partner) {
    if (partner.bot) return i.reply(eph("botは相手に設定できないよ"));
    g.config.members = [...new Set([i.user.id, partner.id])];
    rememberName(g, partner, i.options.getMember("あいて"));
  }
  if (anniv) {
    const d = L.parseDate(anniv, L.today(), { past: true });
    if (!d || d > L.today()) return i.reply(eph("記念日が読めなかったよ。例: `2025/7/12`"));
    g.config.anniversary = d;
  }
  if (hour !== null) g.config.morningHour = hour;
  g.config.nick ??= {};
  if (myNick) g.config.nick[i.user.id] = myNick.trim();
  if (theirNick) {
    const other = partner?.id || g.config.members.find((id) => id !== i.user.id);
    if (!other) return i.reply(eph("先に `あいて` を設定してね（いっしょに入れてもOK）"));
    g.config.nick[other] = theirNick.trim();
  }
  save();
  const c = g.config;
  const changed = inCh || ch || partner || anniv || hour !== null || myNick || theirNick || sync || syncAuto !== null;
  const embed = new EmbedBuilder()
    .setColor(SKY)
    .setTitle(changed ? "🎀 設定を保存したよ" : "🫧 いまの設定")
    .addFields(
      { name: "予定チャンネル", value: c.inputChannelId ? `<#${c.inputChannelId}>\n-# ここに書くだけで予定になるよ` : "未設定", inline: true },
      { name: "通知チャンネル", value: c.channelId ? `<#${c.channelId}>` : "未設定", inline: true },
      { name: "朝のお知らせ", value: `${c.morningHour ?? 8}時`, inline: true },
      { name: "ふたり", value: c.members.length ? c.members.map((id, k) => `${k === 0 ? "💜" : "🤍"} ${c.nick?.[id] ? `**${c.nick[id]}**（<@${id}>）` : `<@${id}>`}`).join("\n") : "未設定（`あいて` を入れてね）", inline: true },
      { name: "記念日", value: c.anniversary ? c.anniversary.replace(/-/g, "/") : "未設定", inline: true },
      { name: "SyncTube", value: c.synctube ? `[お部屋を開く](${c.synctube})\n-# 通話でボタン: ${c.syncAuto === false ? "オフ" : "オン"}` : "未設定", inline: true },
    );
  await i.reply({ embeds: [embed], allowedMentions: { parse: [] } });
}

/* ---------------- SyncTube ---------------- */
function toUrl(s) {
  let t = String(s).trim().replace(/^<|>$/g, "");
  if (!/^https?:\/\//i.test(t)) t = "https://" + t;
  try { const u = new URL(t); return /^https?:$/.test(u.protocol) && u.hostname.includes(".") ? u.toString() : null; } catch { return null; }
}
function syncMessage(g, who = "") {
  const embed = new EmbedBuilder()
    .setColor(SKY)
    .setTitle("🎬 いっしょにみよう")
    .setDescription(`${who ? `${who} が通話に入ったよ。\n` : ""}下のボタンから SyncTube のお部屋を開けるよ`);
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(syncButton(g))] };
}
async function cmdWatch(i, g) {
  if (!g.config.synctube) return i.reply(eph("SyncTube のお部屋がまだ登録されていないよ。`/設定 synctube:` にお部屋のURLを貼ってね"));
  await i.reply(syncMessage(g));
}
const lastVoicePost = new Map(); // guildId → 時刻（連続で出しすぎないように）
export async function handleVoice(oldState, newState) {
  try {
    if (!newState.channelId || oldState.channelId === newState.channelId) return; // 入ったときだけ
    if (newState.member?.user?.bot) return;
    const g = guildData(newState.guild.id);
    if (!g.config.synctube || g.config.syncAuto === false) return;
    if (g.config.members.length && !g.config.members.includes(newState.id)) return;
    const last = lastVoicePost.get(newState.guild.id) || 0;
    if (Date.now() - last < 30 * 60_000) return; // 30分に1回まで
    lastVoicePost.set(newState.guild.id, Date.now());
    const name = nameOf(g, newState.id) === "だれか" ? newState.member?.displayName || "" : nameOf(g, newState.id);
    await newState.channel?.send(syncMessage(g, name)).catch((e) => console.warn("通話チャットに送れませんでした:", e.message));
  } catch (e) {
    console.error(e);
  }
}

/* ---------------- ボタン・入力欄 ---------------- */
/* ---------------- サーバー管理 ---------------- */
const MINT = 0x9be3c8, GRAY = 0xc9d3e0;
function canManage(i, g) {
  const admins = (process.env.ADMIN_IDS || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (admins.length) return admins.includes(i.user.id);
  if (g.config.members.length) return g.config.members.includes(i.user.id);
  return !!i.memberPermissions?.has?.("Administrator");
}
function ago(ms) {
  const m = Math.floor((Date.now() - ms) / 60000);
  if (m < 1) return "いま";
  if (m < 60) return `${m}分`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}時間${m % 60}分` : `${Math.floor(h / 24)}日${h % 24}時間`;
}
function serverCard(note = "") {
  const st = SV.status();
  const sh = st.shiwake, tn = st.tunnel;
  const line = (x) => x.running ? `🟢 動いてる（${ago(x.startedAt)}）` : x.crashed ? `🔴 止まった（${ago(x.stoppedAt) === "いま" ? "さっき" : ago(x.stoppedAt) + "前"}）` : "⚪ 止まってる";
  const both = sh.running && tn.running;
  const host = tn.url ? tn.url.replace(/^https:\/\//, "") : null;
  const embed = new EmbedBuilder()
    .setColor(both ? MINT : sh.running || tn.running ? SKY : GRAY)
    .setTitle("🎀 サーバー管理")
    .setFooter({ text: `ふたりカレンダー v${VERSION}` })
    .addFields(
      { name: "仕訳バトル", value: line(sh), inline: true },
      { name: "トンネル", value: line(tn), inline: true },
      { name: "このPC", value: `${os.hostname()}\n空きメモリ ${(os.freemem() / 1024 ** 3).toFixed(1)}GB`, inline: true },
    );
  if (host) {
    embed.addFields({ name: "URL Mappings に貼るURL", value: "```\n" + host + "\n```\n-# 起動するたびに変わるよ。Developer Portal → Activities → URL Mappings の TARGET に貼ってね" });
  }
  if (note) embed.setDescription(note);
  const running = sh.running || tn.running;
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("sv:start").setLabel("起動").setEmoji("▶️").setStyle(ButtonStyle.Success).setDisabled(both),
    new ButtonBuilder().setCustomId("sv:stop").setLabel("停止").setEmoji("⏹️").setStyle(ButtonStyle.Danger).setDisabled(!running),
    new ButtonBuilder().setCustomId("sv:restart").setLabel("再起動").setEmoji("🔄").setStyle(ButtonStyle.Secondary).setDisabled(!running),
    new ButtonBuilder().setCustomId("sv:refresh").setLabel("更新").setEmoji("👀").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("sv:logs").setLabel("ログ").setEmoji("📄").setStyle(ButtonStyle.Secondary),
  );
  const rows = [row];
  const row2 = new ActionRowBuilder();
  if (UP.configured()) row2.addComponents(new ButtonBuilder().setCustomId("sv:update").setLabel("アップデート").setEmoji("⬆️").setStyle(ButtonStyle.Primary));
  if (process.env.BOT_LOOP) row2.addComponents(new ButtonBuilder().setCustomId("sv:botrestart").setLabel("このbotを再起動").setEmoji("🎀").setStyle(ButtonStyle.Secondary));
  if (row2.components?.length || row2.data?.components?.length) rows.push(row2);
  return { embeds: [embed], components: rows };
}
let crashChannel = null;
SV.setCrashHandler((name) => {
  const label = SV.SERVICES[name].label;
  crashChannel?.send({ ...serverCard(`⚠️ **${label}** が止まっちゃった。「ログ」で原因を見て、「起動」で動かし直してね`) }).catch(() => {});
});

async function cmdServer(i, g) {
  if (!canManage(i, g)) return i.reply(eph("サーバー管理は ふたりだけが使えるよ"));
  await i.reply(serverCard());
}

async function onServerButton(i, g) {
  const act = i.customId.slice(3);
  if (!canManage(i, g)) return act === "logs" ? i.reply(eph("サーバー管理は ふたりだけが使えるよ")) : i.followUp(eph("サーバー管理は ふたりだけが使えるよ"));
  crashChannel = i.channel || crashChannel;
  if (act === "refresh") return i.editReply(serverCard());
  if (act === "logs") {
    const st = SV.status();
    const part = (x) => `**${x.label}**\n\`\`\`\n${(x.logs.slice(-14).join("\n") || "（まだログはありません）").slice(-900)}\n\`\`\``;
    return i.reply(eph(`${part(st.shiwake)}\n${part(st.tunnel)}`));
  }
  if (act === "update") {
    await i.editReply(serverCard("⏳ 新しいバージョンがあるか確認しています…"));
    try {
      const latest = await UP.remoteVersion();
      if (!UP.isNewer(latest, VERSION)) return i.editReply(serverCard(`✅ いまが最新だよ（v${VERSION}）`));
      await i.editReply(serverCard(`⏳ v${latest} を入れています…（1〜2分かかることがあるよ）`));
      const r = await UP.update();
      console.log(`アップデート v${VERSION} → v${latest}:`, r.changed.join(", "));
      if (process.env.BOT_LOOP) {
        await i.editReply(serverCard(`🎀 v${latest} にしたよ！ botを再起動するので、10秒くらいたってから「更新」を押してね\n-# かわったファイル: ${r.changed.length}こ${r.installed ? "（部品も入れなおしました）" : ""}`));
        await SV.stopAll();
        setTimeout(() => process.exit(0), 800);
      } else {
        await i.editReply(serverCard(`✅ v${latest} のファイルを入れたよ。botの黒い画面を閉じて、もう一度 start-bot.bat を開くと切りかわるよ`));
      }
    } catch (e) {
      console.error(e);
      await i.editReply(serverCard(`❌ アップデートできなかったよ: ${e.message}`));
    }
    return;
  }
  if (act === "botrestart") {
    await i.editReply(serverCard("🎀 botを再起動するよ。10秒くらい待ってから「更新」を押してね"));
    await SV.stopAll();
    setTimeout(() => process.exit(0), 500);
    return;
  }
  await i.editReply(serverCard(act === "stop" ? "⏳ 止めています…" : "⏳ 起動しています…（1分くらいかかることがあるよ）"));
  let note = "";
  if (act === "stop" || act === "restart") await SV.stopAll();
  if (act === "start" || act === "restart") {
    const r = await SV.startAll();
    note = r.ok ? (r.url ? "✅ 起動したよ！下のURLを URL Mappings に貼ったら、アクティビティから遊べるよ" : "✅ 起動したよ。URLが出るまで少しかかるので「更新」を押してね")
      : `❌ ${r.error}`;
  } else note = "⏹️ 止めたよ";
  await i.editReply(serverCard(note));
}

async function onButton(i) {
  const g = guildData(i.guildId);
  rememberName(g, i.user, i.member);
  const id = i.customId;

  // 入力欄を開くボタンだけは、受け付けより先に開く必要がある
  if (id === "add") return i.showModal(addModal());
  if (id.startsWith("pick:") && id.endsWith(":other")) {
    const pd = pending.get(id.split(":")[1]);
    return i.showModal(pd ? addModal("いつにする？ 🎀", `${pd.p.time ? timeLabel(pd.p) + " " : ""}${pd.p.title} `) : addModal());
  }
  if (id === "sv:logs") return onServerButton(i, g);

  // それ以外は、まず「受け付けたよ」と返してから考える（3秒ルール対策）
  await i.deferUpdate();
  const gone = (text) => i.editReply({ embeds: [new EmbedBuilder().setColor(MIST).setDescription(text)], components: [], files: [], attachments: [] });

  if (id.startsWith("sv:")) return onServerButton(i, g);

  if (id.startsWith("cal:")) {
    let y, m;
    if (id === "cal:now") ({ y, m } = L.ymd(L.today()));
    else [y, m] = id.slice(4).split("-").map(Number);
    return i.editReply(await monthMessage(g, y, m));
  }

  if (id.startsWith("ev:")) {
    const [, action, evId, val] = id.split(":");
    const ev = g.events.find((e) => e.id === Number(evId));
    if (!ev) return gone("この予定はもう消えているよ");
    if (action === "undo") {
      removeEvent(i.guild, g, ev.id);
      return i.editReply({ embeds: [deletedEmbed(ev)], components: [], files: [], attachments: [] });
    }
    if (action === "set") {
      if (val === "both") ev.both = true;
      else { ev.both = false; ev.by = val; }
      save();
      if (ev.discordEventId) i.guild.scheduledEvents.edit(ev.discordEventId, { entityMetadata: { location: whoText(g, ev) } }).catch(() => {});
      return i.editReply(await addedCard(g, ev));
    }
  }

  if (id.startsWith("pick:")) {
    const [, pid, choice] = id.split(":");
    const pd = pending.get(pid);
    if (!pd) return gone("時間がたったので取り消したよ。もう一度書いてね");
    pending.delete(pid);
    if (choice === "cancel") return gone("🫧 やめたよ");
    const r = await addEvent(i.guild, g, { ...pd.p, date: choice }, pd.by);
    if (r.error) return gone(r.error);
    return i.editReply(await addedCard(g, r.ev));
  }
}

async function onModal(i) {
  if (i.customId !== "addModal") return;
  const g = guildData(i.guildId);
  rememberName(g, i.user, i.member);
  await i.deferReply();
  await i.editReply(await fromText(i.guild, g, i.fields.getTextInputValue("q"), i.user.id));
}

async function onAutocomplete(i) {
  const g = guildData(i.guildId);
  const q = L.normalize(i.options.getFocused() || "");
  const t = L.today();
  const list = L.sortEvents(g.events.filter((e) => e.date >= t))
    .map((e) => ({ e, label: `${L.fmtDate(e.date)} ${timeLabel(e)} ${e.title}（${e.both ? "ふたり" : nameOf(g, e.by)}）` }))
    .filter(({ label }) => !q || label.includes(q))
    .slice(0, 25)
    .map(({ e, label }) => ({ name: label.slice(0, 100), value: String(e.id) }));
  await i.respond(list);
}

export async function handleInteraction(i) {
  const t0 = Date.now();
  const lag = t0 - (i.createdTimestamp || t0);
  const what = i.isButton?.() ? `ボタン ${i.customId}` : i.isChatInputCommand?.() ? `/${i.commandName}` : i.isModalSubmit?.() ? "入力欄" : i.isAutocomplete?.() ? null : "そのほか";
  if (what) console.log(`受信: ${what}（届くまで ${lag}ms）`);
  if (lag > 2500) console.warn(`Discordから届くのが遅れています（${lag}ms）。PCの時計ずれ・回線・PCの重さを確認してね`);
  try {
    if (!i.guildId) return i.isRepliable() && i.reply(eph("サーバーの中で使ってね"));
    if (i.isAutocomplete()) return await onAutocomplete(i);
    if (i.isButton()) return await onButton(i);
    if (i.isModalSubmit()) return await onModal(i);
    if (!i.isChatInputCommand()) return;
    const g = guildData(i.guildId);
    rememberName(g, i.user, i.member);
    switch (i.commandName) {
      case "よてい": return await cmdQuick(i, g);
      case "カレンダー": return await cmdCalendar(i, g);
      case "これから": return await cmdWeek(i, g);
      case "予定削除": return await cmdDelete(i, g);
      case "空いてる日": return await cmdFree(i, g);
      case "記念日": return await cmdAnniv(i, g);
      case "設定": return await cmdSettings(i, g);
      case "サーバー": return await cmdServer(i, g);
      case "みる": return await cmdWatch(i, g);
    }
  } catch (e) {
    console.error(`失敗: ${what}`, e);
    try {
      const msg = eph("エラーが起きました: " + e.message);
      if (i.deferred || i.replied) await i.followUp(msg);
      else if (i.isRepliable()) await i.reply(msg);
    } catch {}
  } finally {
    if (what && Date.now() - t0 > 1500) console.log(`  └ 処理 ${Date.now() - t0}ms（返事済み: ${i.deferred || i.replied ? "はい" : "いいえ"}）`);
  }
}

/* ---------------- 書きこみから予定を読む ---------------- */
export async function handleMessage(msg, botUserId) {
  try {
    if (msg.author.bot || !msg.guildId) return;
    const g = guildData(msg.guildId);
    const mentioned = msg.mentions.users.has(botUserId);
    const inChannel = g.config.inputChannelId && msg.channelId === g.config.inputChannelId;
    if (!mentioned && !inChannel) return;
    const text = msg.content.replace(/<@!?\d+>/g, " ").trim();
    if (!text) return;
    rememberName(g, msg.author, msg.member);
    const res = await fromText(msg.guild, g, text, msg.author.id);
    await msg.reply({ ...res, allowedMentions: { repliedUser: false } });
  } catch (e) {
    console.error(e);
  }
}

/* ---------------- 朝のお知らせ・リマインド ---------------- */
export async function tick(client) {
  const now = L.nowParts();
  let changed = false;
  for (const g of Object.values(db.guilds)) {
    if (!g.config.channelId) continue;
    const ch = await client.channels.fetch(g.config.channelId).catch(() => null);
    if (!ch) continue;

    // 1時間前のリマインド
    for (const ev of g.events) {
      if (!ev.time || ev.reminded) continue;
      const diff = L.startMs(ev) - Date.now();
      if (diff <= 3600_000 && diff > -10 * 60_000) {
        ev.reminded = true; changed = true;
        const ids = mentionsFor(g, ev);
        await ch.send({
          content: `${ids.map((id) => `<@${id}>`).join(" ")}　🎀 もうすぐ **${esc(ev.title)}** だよ（${timeLabel(ev)}〜）<t:${unix(L.startMs(ev))}:R>`,
          allowedMentions: { users: ids },
        }).catch((e) => console.warn("リマインド送信に失敗:", e.message));
      }
    }

    // 朝のお知らせ
    if (now.hh === (g.config.morningHour ?? 8) && g.config.lastMorning !== now.date) {
      g.config.lastMorning = now.date; changed = true;
      g.events = g.events.filter((e) => e.date >= L.addDays(now.date, -60)); // 古い予定のおそうじ
      await ch.send(await weekMessage(g, now.date, { morning: true })).catch((e) => console.warn("朝のお知らせ送信に失敗:", e.message));
    }
  }
  if (changed) save();
}
export const morningMessage = (g, t) => weekMessage(g, t, { morning: true });

/* ---------------- 起動 ---------------- */
export async function registerCommands(guild) {
  try {
    await guild.commands.set(COMMANDS);
    console.log(`コマンドを登録しました: ${guild.name}`);
  } catch (e) {
    console.error(`コマンド登録に失敗（${guild.name}）:`, e.message);
  }
}

function start(withMessages) {
  const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates];
  if (withMessages) intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
  const client = new Client({ intents });
  client.once(Events.ClientReady, async (c) => {
    console.log(`ふたりカレンダー v${VERSION} 起動 → ${c.user.tag}`);
    if (UP.configured()) UP.remoteVersion().then((v) => { if (UP.isNewer(v, VERSION)) console.log(`新しいバージョン v${v} があります。/サーバー の「アップデート」で入れられます`); }).catch(() => {});
    if (!withMessages) console.warn("※ 書きこみから予定を読む機能はオフです（README の「Message Content Intent」を見てね）");
    for (const guild of c.guilds.cache.values()) await registerCommands(guild);
    if (process.env.AUTO_START_SHIWAKE === "1") SV.startAll().then((r) => console.log("仕訳バトル自動起動:", r.ok ? r.url || "OK" : r.error));
    tick(c).catch(console.error);
    setInterval(() => tick(c).catch(console.error), 30_000);
  });
  client.on(Events.GuildCreate, registerCommands);
  client.on(Events.InteractionCreate, handleInteraction);
  client.on(Events.VoiceStateUpdate, handleVoice);
  if (withMessages) client.on(Events.MessageCreate, (msg) => handleMessage(msg, client.user.id));
  client.login(process.env.DISCORD_TOKEN).catch((e) => {
    if (withMessages && /disallowed intents/i.test(e.message)) {
      console.warn("Message Content Intent がオフなので、書きこみ読み取りなしで起動します");
      client.destroy();
      start(false);
    } else {
      console.error("ログインに失敗:", e.message);
      process.exit(1);
    }
  });
}

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, async () => { await SV.stopAll(); process.exit(0); });

if (!process.env.TEST) {
  if (!process.env.DISCORD_TOKEN) {
    console.error(".env に DISCORD_TOKEN がありません。README の手順を見てね");
    process.exit(1);
  }
  takeOver();
  start(true);
}
