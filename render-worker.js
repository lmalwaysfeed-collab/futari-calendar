// 画像を作る専用のワーカー（pictures.js から呼ばれる）
import { parentPort } from "node:worker_threads";
import { monthPng, weekPng } from "./image.js";

parentPort.on("message", ({ id, kind, model }) => {
  try {
    const buf = kind === "month" ? monthPng(model) : weekPng(model);
    const u8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength).slice();
    parentPort.postMessage({ id, ok: true, buf: u8 }, [u8.buffer]);
  } catch (e) {
    parentPort.postMessage({ id, ok: false, error: e.message });
  }
});
