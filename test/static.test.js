// The page and its assets over HTTP. Raw requests: fetch would normalise the
// paths these tests send before the server sees them.
import assert from "node:assert/strict";
import { request, createServer } from "node:http";
import { after, before, test } from "node:test";
import { createStaticHandler } from "../src/utils/static.js";

let server;
let port;

before(async () => {
  server = createServer(createStaticHandler());
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = server.address().port;
});

after(() => new Promise((resolve) => server.close(resolve)));

function get(path, method = "GET") {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path, method }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () =>
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", reject);
    req.end();
  });
}

test("serves the English and Spanish pages at their paths", async () => {
  for (const path of ["/kube-ping/", "/es/kube-ping/"]) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    assert.match(res.headers["content-type"], /^text\/html/);
    assert.match(res.body, /<title>/);
  }
});

test("serves the stylesheets and scripts with their types", async () => {
  const css = await get("/kube-ping/css/base.css");
  assert.equal(css.status, 200);
  assert.match(css.headers["content-type"], /^text\/css/);

  const js = await get("/kube-ping/js/ping.js");
  assert.equal(js.status, 200);
  assert.match(js.headers["content-type"], /^text\/javascript/);
  assert.equal(js.headers["x-content-type-options"], "nosniff");
});

test("a directory without the trailing slash redirects to it", async () => {
  const res = await get("/kube-ping");
  assert.equal(res.status, 301);
  assert.equal(res.headers.location, "/kube-ping/");
});

test("answers 404 for files that don't exist and for the root", async () => {
  assert.equal((await get("/kube-ping/missing.js")).status, 404);
  assert.equal((await get("/")).status, 404);
  assert.equal((await get("/es/")).status, 404);
});

test("never reads outside public/", async () => {
  // %2f stays encoded in the path, so the decoded value climbs out of public/.
  const res = await get("/kube-ping/..%2f..%2fpackage.json");
  assert.equal(res.status, 404);
  assert.equal((await get("/..%2fpackage.json")).status, 404);
  assert.equal((await get("/kube-ping/%00")).status, 404);
  assert.equal((await get("/kube-ping/%E0%A4%A")).status, 400);
});

test("only GET and HEAD are served", async () => {
  assert.equal((await get("/kube-ping/", "POST")).status, 404);

  const head = await get("/kube-ping/", "HEAD");
  assert.equal(head.status, 200);
  assert.equal(head.body, "");
});
