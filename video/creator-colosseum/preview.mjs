// Local preview exposes only the finished video and its thumbnail, never the workspace.
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const dir = fileURLToPath(new URL("./deliverables/", import.meta.url));
const html =
  '<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ResiliRoute — 4:54 Pitch & Demo</title><style>body{margin:0;background:#102a39;color:#ecf7fa;font:16px system-ui;padding:24px}main{max-width:1280px;margin:auto}h1{font-size:24px;margin:0 0 10px}p{color:#a9c8d5}video{display:block;width:100%;border-radius:12px;background:#071823}a{color:#77c6cf}</style><main><h1>ResiliRoute · Creator Colosseum</h1><p>4分54秒 · 英語音声 · 日英字幕 · 実際のアプリ操作</p><video controls preload="metadata" poster="/thumbnail.png" src="/film.mp4"></video><p>道路・施設はOpenStreetMapの実データ。需要・容量はモデル推定です。</p></main></html>';
createServer(async (req, res) => {
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }
  const name =
    req.url === "/film.mp4"
      ? "final-creator-colosseum-resiliroute.mp4"
      : req.url === "/thumbnail.png"
        ? "THUMBNAIL.png"
        : null;
  if (!name) {
    res.writeHead(404);
    res.end();
    return;
  }
  try {
    const path = dir + name,
      s = await stat(path),
      type = name.endsWith(".mp4") ? "video/mp4" : "image/png";
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if (range) {
      const start = Number(range[1]),
        end = range[2] ? Math.min(Number(range[2]), s.size - 1) : s.size - 1;
      if (start >= s.size || end < start) {
        res.writeHead(416, { "Content-Range": `bytes */${s.size}` });
        res.end();
        return;
      }
      res.writeHead(206, {
        "Content-Type": type,
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes ${start}-${end}/${s.size}`,
        "Content-Length": end - start + 1,
      });
      createReadStream(path, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Type": type,
        "Accept-Ranges": "bytes",
        "Content-Length": s.size,
      });
      createReadStream(path).pipe(res);
    }
  } catch {
    res.writeHead(404);
    res.end();
  }
}).listen(3002, "127.0.0.1");
