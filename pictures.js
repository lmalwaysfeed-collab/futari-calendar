// カレンダー画像づくりを「別の作業場所（ワーカー）」でやる
// → 画像を作っている間も、botはボタンやコマンドにすぐ返事ができる
import { Worker } from "node:worker_threads";

let worker = null;
let seq = 0;
const waiting = new Map(); // id → { resolve, reject, timer }
const cache = new Map();   // 同じ内容の画像は作り直さない（最大20枚）

function startWorker() {
  try {
    const w = new Worker(new URL("./render-worker.js", import.meta.url));
    w.on("message", ({ id, ok, buf, error }) => {
      const p = waiting.get(id);
      if (!p) return;
      waiting.delete(id); clearTimeout(p.timer);
      ok ? p.resolve(Buffer.from(buf)) : p.reject(new Error(error));
    });
    w.on("error", (e) => {
      console.error("画像ワーカーでエラー:", e.message);
      for (const [, p] of waiting) { clearTimeout(p.timer); p.reject(e); }
      waiting.clear();
      worker = null; // 次に使うときに作り直す
    });
    w.on("exit", () => { if (worker === w) worker = null; });
    w.unref();
    return w;
  } catch (e) {
    console.warn("ワーカーを作れなかったので、本体で画像を作ります:", e.message);
    return null;
  }
}

let direct = null; // ワーカーが使えないときの予備
async function renderDirect(kind, model) {
  direct ??= await import("./image.js");
  return kind === "month" ? direct.monthPng(model) : kind === "week" ? direct.weekPng(model) : direct.artPng(kind, model);
}

async function render(kind, model) {
  const key = kind + JSON.stringify(model);
  if (cache.has(key)) return cache.get(key);
  worker ??= startWorker();
  let buf;
  if (!worker) buf = await renderDirect(kind, model);
  else {
    buf = await new Promise((resolve, reject) => {
      const id = ++seq;
      const timer = setTimeout(() => { waiting.delete(id); reject(new Error("画像づくりに時間がかかりすぎました")); }, 30_000);
      waiting.set(id, { resolve, reject, timer });
      worker.postMessage({ id, kind, model });
    }).catch(() => renderDirect(kind, model));
  }
  cache.set(key, buf);
  if (cache.size > 20) cache.delete(cache.keys().next().value);
  return buf;
}

export const monthPng = (model) => render("month", model);
export const weekPng = (model) => render("week", model);
export const artPng = (kind, model) => render(kind, model);
