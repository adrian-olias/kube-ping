// Serves the page and its assets from public/. Only files inside public/ are
// read: anything that resolves outside it is a 404.
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { sendJson } from "./http.js";

export const PUBLIC_DIR = fileURLToPath(new URL("../../public/", import.meta.url));

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const notFound = (res) => sendJson(res, 404, { error: "not found" });

// "/kube-dino/" is served from "kube-dino/index.html". "/kube-dino" without the
// slash redirects there, so the page's relative links resolve.
export function createStaticHandler(root = PUBLIC_DIR) {
  const base = resolve(root);

  return async (req, res) => {
    // Only GET and HEAD exist here. Other methods get the same 404 as an unknown API path.
    if (req.method !== "GET" && req.method !== "HEAD") return notFound(res);

    const { pathname } = new URL(req.url, "http://localhost");
    let decoded;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      return sendJson(res, 400, { error: "bad path" });
    }
    if (decoded.includes("\0")) return notFound(res);

    const target = resolve(base, `.${decoded}`);
    if (target !== base && !target.startsWith(base + sep)) return notFound(res);

    let file = target;
    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) {
      if (!decoded.endsWith("/")) {
        res.writeHead(301, { Location: `${pathname}/` });
        return res.end();
      }
      file = resolve(file, "index.html");
      info = await stat(file).catch(() => null);
    }
    if (!info?.isFile()) return notFound(res);

    const body = await readFile(file);
    res.writeHead(200, {
      "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
      "Content-Length": body.length,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(req.method === "HEAD" ? undefined : body);
  };
}
