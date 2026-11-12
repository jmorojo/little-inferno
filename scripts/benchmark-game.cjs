// Real-game comparison: fixed frame counts, fresh profile, identical inputs.
const { chromium } = require("playwright");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const fs = require("node:fs/promises");
const path = require("node:path");

const option = (key, fallback) => {
  const i = process.argv.indexOf(key);
  return i < 0 ? fallback : process.argv[i + 1];
};
const name = option("--name", "current");
if (!/^[a-z0-9_-]+$/i.test(name)) throw Error("Invalid benchmark name");
const wasm = option("--wasm", "web-boxedwine/boxedwine.wasm");
const frameCount = Number(option("--frames", "80"));
if (!Number.isInteger(frameCount) || frameCount < 20) throw Error("Invalid frame count");

(async () => {
  let browser;
  const directory = path.resolve("test-results/performance");
  await fs.mkdir(directory, { recursive: true });
  const server = spawn("python3", ["web-boxedwine/server.py", "--port", "18093"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    await once(server.stdout, "data");
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      headless: !process.argv.includes("--headed"),
      args: ["--enable-unsafe-swiftshader"],
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on("pageerror", e => errors.push(String(e)));
    await page.route("**/boxedwine.wasm", r => r.fulfill({
      path: path.resolve(wasm), contentType: "application/wasm",
    }));
    await page.addInitScript(() => {
      window.benchmark = { total: 0, active: false, frames: [], compilation: {} };
      for (const kind of ["Module", "Instance"]) {
        WebAssembly[kind] = new Proxy(WebAssembly[kind], {
          construct(target, args, newTarget) {
            const start = performance.now();
            try { return Reflect.construct(target, args, newTarget); }
            finally {
              if (benchmark.active) {
                const stats = benchmark.compilation[kind] ||= { calls: 0, ms: 0 };
                stats.calls++;
                stats.ms += performance.now() - start;
              }
            }
          },
        });
      }
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (...args) {
        const gl = getContext.apply(this, args);
        if (this.id === "canvas" && /webgl/.test(args[0]) && gl && !gl.benchmarkObserved) {
          gl.benchmarkObserved = true;
          let screen = true;
          const bind = gl.bindFramebuffer.bind(gl);
          gl.bindFramebuffer = (target, framebuffer) => {
            if (target === gl.FRAMEBUFFER || target === gl.DRAW_FRAMEBUFFER)
              screen = framebuffer === null;
            return bind(target, framebuffer);
          };
          const blit = gl.blitFramebuffer.bind(gl);
          gl.blitFramebuffer = (...values) => {
            const result = blit(...values);
            if (screen && Math.abs(values[6] - values[4]) >= 640 &&
                Math.abs(values[7] - values[5]) >= 360) {
              benchmark.total++;
              if (benchmark.active) benchmark.frames.push(performance.now());
            }
            return result;
          };
        }
        return gl;
      };
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");
    const point = async (x, y) => {
      const r = await page.locator("#canvas").boundingBox();
      return { x: r.x + r.width * x, y: r.y + r.height * y };
    };
    const waitFrames = async count => {
      const start = await page.evaluate(() => benchmark.total);
      await page.waitForFunction(({ start, count }) => benchmark.total >= start + count,
        { start, count }, { timeout: 180000, polling: 100 });
    };
    const measure = async (stage, count) => {
      const before = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(x => [x.name, x.value]));
      await page.evaluate(() => {
        benchmark.frames = []; benchmark.compilation = {}; benchmark.active = true;
      });
      await page.waitForFunction(n => benchmark.frames.length >= n, count,
        { timeout: 180000, polling: 100 });
      const sample = await page.evaluate(() => {
        benchmark.active = false;
        return { frames: benchmark.frames, compilation: benchmark.compilation };
      });
      const after = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(x => [x.name, x.value]));
      const intervals = sample.frames.slice(1).map((t, i) => t - sample.frames[i]).sort((a, b) => a - b);
      const percentile = q => intervals[Math.floor((intervals.length - 1) * q)];
      return { stage, frames: sample.frames.length,
        cpuMsPerFrame: 1000 * (after.ThreadTime - before.ThreadTime) / sample.frames.length,
        medianMs: percentile(.5), p95Ms: percentile(.95), maxMs: intervals.at(-1),
        compilation: sample.compilation };
    };
    await page.goto("http://127.0.0.1:18093/?lang=en");
    await page.locator("#play-button").click();
    await page.waitForFunction(() => Inferno.phase === "running" || Inferno.phase === "error",
      null, { timeout: 360000 });
    if (await page.evaluate(() => Inferno.phase === "error")) throw Error("Game failed to start");
    for (let i = 0; i < 60; i++) {
      if (await page.evaluate(() => GL.textures.length >= 210)) break;
      const p = await point(.3, .6);
      await page.mouse.click(p.x, p.y, { delay: 450 });
      await page.waitForTimeout(5000);
    }
    await page.waitForFunction(() => GL.textures.length >= 210, null, { timeout: 30000 });
    await page.waitForTimeout(3000);
    const flame = await point(.2, .7);
    await page.mouse.move(flame.x, flame.y); await page.mouse.down();
    await waitFrames(frameCount);
    const results = [await measure("flame1", frameCount), await measure("flame2", frameCount)];
    const object = await point(.65, .62);
    await page.mouse.move(object.x, object.y);
    results.push(await measure("burn", Math.round(frameCount * .75)));
    await page.screenshot({ path: path.join(directory, name + ".png") });
    await page.mouse.up();
    const renderer = await page.evaluate(() => {
      const gl = GL.currentContext?.GLctx ||
        GL.contexts.find(c => c?.GLctx?.canvas === Module.canvas)?.GLctx;
      if (!gl) throw Error("Game WebGL context is unavailable");
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      return gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
    });
    const report = { date: new Date().toISOString(), browser: browser.version(),
      renderer, wasm: path.resolve(wasm), viewport: [1280, 900],
      canvas: await page.evaluate(() => [Module.canvas.width, Module.canvas.height]),
      results, errors };
    await fs.writeFile(path.join(directory, name + ".json"), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
    if (errors.length) process.exitCode = 1;
  } finally { await browser?.close(); server.kill(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
