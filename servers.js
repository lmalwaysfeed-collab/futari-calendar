// 仕訳バトルのサーバーとトンネルを、botから起動・停止する
import { spawn } from "node:child_process";
import fs from "node:fs";

const PORT = () => process.env.SHIWAKE_PORT || "3001";

export const SERVICES = {
  shiwake: {
    label: "仕訳バトル",
    command: () => "npm run go",
    cwd: () => process.env.SHIWAKE_DIR,
    ready: /起動中|listening/i,
  },
  tunnel: {
    label: "トンネル",
    command: () => `${process.env.CLOUDFLARED || "cloudflared"} tunnel --url http://localhost:${PORT()}`,
    cwd: () => undefined,
    ready: /trycloudflare\.com/,
  },
};

const state = {}; // name → { child, startedAt, logs, url, exitCode, stoppedAt, stopping }
let onCrash = null;
/** 予定外に止まったときに呼ばれる関数を登録 */
export function setCrashHandler(fn) { onCrash = fn; }

function entry(name) {
  return (state[name] ??= { child: null, startedAt: 0, logs: [], url: null, exitCode: null, stoppedAt: 0, stopping: false });
}
function log(name, line) {
  const e = entry(name);
  for (const l of String(line).split(/\r?\n/)) {
    const t = l.replace(/\x1b\[[0-9;]*m/g, "").trimEnd();
    if (!t) continue;
    e.logs.push(t);
    if (e.logs.length > 60) e.logs.shift();
    const m = t.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (name === "tunnel" && m) e.url = m[0];
  }
}

export function isRunning(name) {
  return !!state[name]?.child;
}

/** サービスを起動して、準備ができるまで（最大 timeoutMs）待つ */
export function start(name, timeoutMs = 45_000) {
  const svc = SERVICES[name];
  const e = entry(name);
  if (e.child) return Promise.resolve({ ok: true, already: true });
  const cwd = svc.cwd();
  if (name === "shiwake" && (!cwd || !fs.existsSync(cwd))) {
    return Promise.resolve({ ok: false, error: "仕訳バトルのフォルダが見つかりません。.env の SHIWAKE_DIR を確認してね" });
  }
  e.logs = []; e.url = null; e.exitCode = null; e.stopping = false; e.crashed = false;
  let child;
  try {
    child = spawn(svc.command(), { cwd, shell: true, windowsHide: true, env: process.env, detached: process.platform !== "win32" });
  } catch (err) {
    return Promise.resolve({ ok: false, error: err.message });
  }
  e.child = child;
  e.startedAt = Date.now();
  log(name, `▶ ${svc.command()}`);

  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => { if (!done) { done = true; clearTimeout(timer); resolve(r); } };
    const onData = (buf) => {
      log(name, buf);
      if (svc.ready.test(String(buf))) finish({ ok: true });
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("error", (err) => { log(name, `エラー: ${err.message}`); });
    child.on("exit", (code) => {
      const wasStopping = e.stopping;
      e.child = null; e.exitCode = code; e.stoppedAt = Date.now(); e.stopping = false; e.crashed = !wasStopping;
      log(name, `■ 終了しました（コード ${code}）`);
      finish({ ok: false, error: `${svc.label}がすぐに止まりました。ログを見てね` });
      if (!wasStopping && onCrash) onCrash(name, code);
    });
    const timer = setTimeout(() => finish({ ok: true, slow: true }), timeoutMs);
  });
}

function killTree(child) {
  return new Promise((resolve) => {
    if (!child) return resolve();
    child.once("exit", () => resolve());
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
    } else {
      try { process.kill(-child.pid, "SIGTERM"); } catch { try { child.kill("SIGTERM"); } catch {} }
    }
    setTimeout(resolve, 8000);
  });
}

export async function stop(name) {
  const e = entry(name);
  if (!e.child) return false;
  e.stopping = true;
  await killTree(e.child);
  return true;
}

/** 仕訳バトル → トンネルの順に起動 */
export async function startAll() {
  const a = await start("shiwake", 90_000);
  if (!a.ok) return a;
  const b = await start("tunnel", 45_000);
  if (!b.ok) return b;
  return { ok: true, url: entry("tunnel").url };
}
export async function stopAll() {
  const t = await stop("tunnel");
  const s = await stop("shiwake");
  return t || s;
}

export function status() {
  return Object.fromEntries(Object.keys(SERVICES).map((name) => {
    const e = entry(name);
    return [name, {
      label: SERVICES[name].label,
      running: !!e.child,
      startedAt: e.startedAt,
      stoppedAt: e.stoppedAt,
      exitCode: e.exitCode,
      crashed: !!e.crashed,
      url: e.child ? e.url : null,
      logs: e.logs.slice(),
    }];
  }));
}
