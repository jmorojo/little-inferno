const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const { once } = require("node:events");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const { chromium } = require("playwright");
let browser, server;
const base = "http://127.0.0.1:18090/?lang=en";
before(async () => {
  server = spawn("python3", ["web-boxedwine/server.py", "--port", "18090"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  await once(server.stdout, "data");
  browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ["--enable-unsafe-swiftshader"],
  });
});
after(async () => {
  await browser?.close();
  server?.kill();
});
function zip(files) {
  const r = spawnSync(
    "python3",
    [
      "-c",
      'import io,json,sys,zipfile; b=io.BytesIO(); z=zipfile.ZipFile(b,"w"); [(z.writestr(k,v)) for k,v in json.load(sys.stdin).items()]; z.close(); sys.stdout.buffer.write(b.getvalue())',
    ],
    { input: JSON.stringify(files) },
  );
  assert.equal(r.status, 0);
  return r.stdout;
}
const hash = (b) => createHash("sha256").update(b).digest("hex");
async function bundle(page, failure) {
  const files = {
    "littleinferno.zip": zip({
      "Little Inferno.exe": "fixture",
      "resource.pak": "resource",
      "embed.pak": "embed",
      "frontend.pak": "frontend",
    }),
    "boxedwine.zip": zip({ "bin/wine.link": "/opt/wine/bin/wine" }),
  };
  const manifest = { version: 1, archives: {} };
  for (const [name, bytes] of Object.entries(files)) {
    const mid = Math.floor(bytes.length / 2),
      parts = [bytes.subarray(0, mid), bytes.subarray(mid)];
    const descriptors = parts.map((b, i) => ({
      path: `bundles/${name}-${i}.part`,
      size: b.length,
      sha256: hash(b),
    }));
    manifest.archives[name] = {
      name,
      size: bytes.length,
      sha256: hash(bytes),
      parts: descriptors,
    };
    for (let i = 0; i < 2; i++)
      await page.route("**/" + descriptors[i].path, (r) => {
        if (failure === "missing" && name === "littleinferno.zip" && i === 1)
          return r.fulfill({ status: 404, body: "missing" });
        const body = Buffer.from(parts[i]);
        if (failure === "corrupt" && name === "littleinferno.zip" && i === 1)
          body[0] ^= 0xff;
        return r.fulfill({ body, contentType: "application/octet-stream" });
      });
  }
  await page.route("**/assets-manifest.json", (r) =>
    r.fulfill({ json: manifest }),
  );
  await page.route("**/runtime.js", (r) =>
    r.fulfill({
      body:
        fs.readFileSync("web-boxedwine/runtime.js", "utf8") +
        "\nModule.noInitialRun=true;",
      contentType: "text/javascript",
    }),
  );
  return files;
}
test("los fragmentos verificados reconstruyen los ZIP exactos en el FS real", async () => {
  const page = await browser.newPage();
  const files = await bundle(page);
  const requested = [];
  page.on("request", (r) => requested.push(r.url()));
  await page.goto(base);
  await page.locator("#play-button").click();
  await page.waitForFunction(() => window.Module?.calledRun);
  const actual = await page.evaluate(() =>
    Object.fromEntries(
      ["littleinferno.zip", "boxedwine.zip"].map((n) => [
        n,
        Array.from(FS.readFile("/" + n)),
      ]),
    ),
  );
  for (const name of Object.keys(files))
    assert.deepEqual(Buffer.from(actual[name]), files[name]);
  assert.equal(
    requested.some((u) => /\/(littleinferno|boxedwine)\.zip$/.test(u)),
    false,
    "the deployment must not request an unsplit ZIP",
  );
  assert.equal(
    await page.locator("#curtain").isVisible(),
    true,
    "mounting files does not pretend a game scene has rendered",
  );
  await page.close();
});
for (const failure of ["missing", "corrupt"])
  test(`un fragmento ${failure} muestra un error visible`, async () => {
    const page = await browser.newPage();
    await bundle(page, failure);
    await page.goto(base);
    await page.locator("#play-button").click();
    await page.waitForFunction(() => Inferno.phase === "error");
    assert.equal(await page.locator("#curtain").isVisible(), true);
    assert.match(
      await page.locator("#diagnostic-status").textContent(),
      failure === "missing" ? /HTTP 404/ : /integrity check failed/,
    );
    await page.close();
  });
