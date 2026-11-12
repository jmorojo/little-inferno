const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const { once } = require("node:events");
const { createHash } = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

let browser, directory;
const servers = [];
const root = "http://127.0.0.1:18091/little-inferno/";
const hash = data => createHash("sha256").update(data).digest("hex");
const game = { "Little Inferno.exe": "fixture", "resource.pak": "resource", "embed.pak": "embed", "frontend.pak": "frontend" };

before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "inferno-pages-test-"));
  for (const entry of await fs.readdir("dist/github-pages")) {
    if (["bundles", "assets-manifest.json"].includes(entry)) continue;
    await fs.cp(path.join("dist/github-pages", entry), path.join(directory, entry), { recursive: true });
  }
  await fs.appendFile(path.join(directory, "runtime.js"), "\nModule.noInitialRun=true;\n");
  await fs.mkdir(path.join(directory, "bundles"));
  const manifest = { version: 1, archives: {} };
  for (const [name, files] of Object.entries({ "littleinferno.zip": game, "boxedwine.zip": { "bin/wine.link": "/opt/wine/bin/wine" } })) {
    const result = spawnSync("python3", ["-c", "import io,json,sys,zipfile; b=io.BytesIO(); z=zipfile.ZipFile(b,'w'); [(z.writestr(k,v)) for k,v in json.load(sys.stdin).items()]; z.close(); sys.stdout.buffer.write(b.getvalue())"], { input: JSON.stringify(files) });
    assert.equal(result.status, 0);
    const bytes = result.stdout, parts = [];
    const midpoint = Math.floor(bytes.length / 2);
    for (const [i, data] of [bytes.subarray(0, midpoint), bytes.subarray(midpoint)].entries()) {
      const filename = `bundles/${name}-${i}.part`;
      await fs.writeFile(path.join(directory, filename), data);
      parts.push({ path: filename, size: data.length, sha256: hash(data) });
    }
    manifest.archives[name] = { name, size: bytes.length, sha256: hash(bytes), parts };
  }
  await fs.writeFile(path.join(directory, "assets-manifest.json"), JSON.stringify(manifest));
  for (const [port, headers] of [[18091, false], [18092, true]]) {
    const server = spawn("python3", ["web-boxedwine/server.py", "--port", String(port), "--directory", directory, "--base-path", "/little-inferno/", ...(!headers ? ["--no-isolation-headers"] : [])], { stdio: ["ignore", "pipe", "pipe"] });
    servers.push(server);
    await once(server.stdout, "data");
  }
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ["--enable-unsafe-swiftshader"],
  });
});
after(async () => {
  await browser?.close();
  for (const server of servers) server.kill();
  if (directory) await fs.rm(directory, { recursive: true, force: true });
});

async function freshPage() {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => {
    sessionStorage.setItem("test.visits", String(Number(sessionStorage.getItem("test.visits") || 0) + 1));
  });
  return { context, page };
}
async function isolated(page) {
  await page.waitForFunction(() => window.crossOriginIsolated && window.Inferno, null, { timeout: 20000 });
  assert.equal(await page.evaluate(() => InfernoIsolation.ready), true);
}

test("Pages activa aislamiento con una sola recarga y limita el worker a la subruta", async () => {
  const response = await fetch(root);
  assert.equal(response.headers.get("cross-origin-opener-policy"), null);
  assert.equal(response.headers.get("cross-origin-embedder-policy"), null);
  const { context, page } = await freshPage();
  await page.goto(root + "?lang=de#fire");
  await isolated(page);
  assert.equal(await page.evaluate(() => sessionStorage.getItem("test.visits")), "2");
  assert.equal(await page.evaluate(() => typeof SharedArrayBuffer), "function");
  assert.equal(await page.getAttribute("html", "lang"), "de");
  assert.equal(new URL(page.url()).hash, "#fire");
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).scope);
  assert.equal(scope, root);
  assert.equal((await fetch(new URL("/outside", root))).status, 404);
  const headers = await page.evaluate(async () => Object.fromEntries((await fetch("runtime.js")).headers));
  assert.equal(headers["cross-origin-opener-policy"], "same-origin");
  assert.equal(headers["cross-origin-embedder-policy"], "require-corp");
  const manifestURL = await page.locator('link[rel="manifest"]').getAttribute("href");
  const manifest = await page.evaluate(async url => (await fetch(url)).json(), manifestURL);
  assert.equal(new URL(manifest.start_url, new URL(manifestURL, page.url())).pathname, "/little-inferno/");
  await context.close();
});

test("WASM y fragmentos funcionan bajo la subruta y conservan guardado, volumen e idioma", async () => {
  const { context, page } = await freshPage();
  const requests = [];
  context.on("request", r => requests.push(r.url()));
  await page.goto(root + "?lang=en");
  await isolated(page);
  await page.locator("#play-button").click();
  await page.waitForFunction(() => window.Module?.calledRun);
  await page.evaluate(async () => {
    FS.writeFile("/profile/little-inferno/pages-save-probe", new Uint8Array([17, 22, 91]));
    await new Promise((resolve, reject) => FS.syncfs(false, e => e ? reject(e) : resolve()));
    InfernoAudio.setVolume(37);
    InfernoAudio.toggleMute();
    I18n.setLanguage("fr");
  });
  await page.reload();
  await isolated(page);
  assert.equal(await page.evaluate(() => sessionStorage.getItem("test.visits")), "3");
  assert.equal(await page.getAttribute("html", "lang"), "fr");
  assert.equal(await page.locator("#volume-knob").getAttribute("aria-valuenow"), "37");
  assert.equal(await page.locator("#sound-button").getAttribute("aria-pressed"), "true");
  await page.locator("#play-button").click();
  await page.waitForFunction(() => window.Module?.calledRun);
  assert.deepEqual(await page.evaluate(() => Array.from(FS.readFile("/profile/little-inferno/pages-save-probe"))), [17, 22, 91]);
  assert.ok(await page.evaluate(() => FS.readFile("/littleinferno.zip").length > 100));
  const downloads = requests.filter(url => /(?:\.wasm|runtime\.js|assets-manifest\.json|\.part)$/.test(url));
  assert.ok(downloads.some(url => url.endsWith("boxedwine.wasm")));
  assert.ok(downloads.some(url => url.endsWith(".part")));
  assert.ok(downloads.every(url => url.startsWith(root)), downloads.join("\n"));
  await context.close();
});

test("un worker ausente muestra el error traducido antes de descargar el juego", async () => {
  const worker = path.join(directory, "coi-serviceworker.js");
  await fs.rename(worker, worker + ".missing");
  const { context, page } = await freshPage();
  try {
    const downloads = [];
    context.on("request", r => { if (/\.wasm|\.part$/.test(r.url())) downloads.push(r.url()); });
    await page.goto(root + "?lang=es");
    assert.equal(await page.evaluate(() => InfernoIsolation.ready), false);
    await page.locator("#play-button").click();
    await page.waitForFunction(() => Inferno.phase === "error");
    assert.equal(await page.locator("#diagnostic-status").textContent(), await page.evaluate(() => I18n.t("isolationRequired")));
    assert.deepEqual(downloads, []);
  } finally {
    await context.close();
    await fs.rename(worker + ".missing", worker);
  }
});

test("el límite de recarga evita bucles y una recarga manual recupera la sesión", async () => {
  const { context, page } = await freshPage();
  await page.addInitScript(() => sessionStorage.setItem("little-inferno.isolation:/little-inferno/coi-serviceworker.js", "1"));
  await page.goto(root + "?lang=en");
  assert.equal(await page.evaluate(() => InfernoIsolation.ready), false);
  assert.equal(await page.evaluate(() => sessionStorage.getItem("test.visits")), "1");
  await page.locator("#play-button").click();
  await page.waitForFunction(() => Inferno.phase === "error");
  await page.reload();
  await isolated(page);
  assert.equal(await page.evaluate(() => sessionStorage.getItem("test.visits")), "2");
  await context.close();
});

test("un servidor con COOP/COEP conserva aislamiento sin registrar worker ni recargar", async () => {
  const { context, page } = await freshPage();
  await page.goto("http://127.0.0.1:18092/little-inferno/?lang=en");
  await isolated(page);
  assert.equal(await page.evaluate(() => sessionStorage.getItem("test.visits")), "1");
  assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0);
  await context.close();
});
