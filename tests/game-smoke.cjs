// Slow integration check: real game ZIP, unmodified EXE and real Wine/WebGL.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const fs = require("node:fs/promises");
const { chromium } = require("playwright");

(async () => {
  let browser, page;
  const pages = process.argv.includes("--pages");
  const server = spawn(
    "python3",
    [
      "web-boxedwine/server.py",
      "--port",
      "18089",
      "--directory",
      process.env.GAME_TEST_DIRECTORY ||
        (pages ? "dist/github-pages" : process.argv.includes("--deploy") ? "dist/netlify" : "web-boxedwine"),
      ...(pages ? ["--base-path", "/little-inferno/", "--no-isolation-headers"] : []),
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  try {
    await once(server.stdout, "data");
    browser = await chromium.launch({
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      args: ["--enable-unsafe-swiftshader"],
    });
    page = await browser.newPage({
      viewport: { width: 1280, height: 1000 },
    });
    const checkAudio = process.argv.includes("--audio");
    if (checkAudio)
      await page.addInitScript(() => {
        const connect = AudioNode.prototype.connect;
        window.gameSpeakerMeters = [];
        AudioNode.prototype.connect = function (destination, ...args) {
          if (destination === this.context.destination) {
            const meter = this.context.createAnalyser();
            meter.fftSize = 2048;
            connect.call(this, meter, ...args);
            connect.call(meter, destination);
            gameSpeakerMeters.push(meter);
            return destination;
          }
          return connect.call(this, destination, ...args);
        };
        window.gameSpeakerPeak = () => {
          const values = new Float32Array(2048);
          let peak = 0;
          for (const meter of gameSpeakerMeters) {
            meter.getFloatTimeDomainData(values);
            for (const value of values) peak = Math.max(peak, Math.abs(value));
          }
          return peak;
        };
      });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    const smooth = process.argv.includes("--smooth");
    const perf = process.argv.includes("--perf");
    const base = `http://127.0.0.1:18089/${pages ? "little-inferno/" : ""}${perf ? "?perf=1" : ""}`;
    await page.goto(base);
    if (pages) {
      const originResponse = await fetch(base);
      assert.equal(originResponse.headers.get("cross-origin-opener-policy"), null);
      await page.waitForFunction(() => window.crossOriginIsolated && window.Inferno, null, { timeout: 20000 });
      assert.ok(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL.endsWith("/little-inferno/coi-serviceworker.js")));
    }
    if (smooth) await page.locator("#quality-select").selectOption("smooth");
    await page.locator("#play-button").click();
    await page.waitForFunction(
      () => Inferno.phase === "running" || Inferno.phase === "error",
      null,
      { timeout: 360000 },
    );
    assert.equal(
      await page.evaluate(() => Inferno.phase),
      "running",
      await page.locator("#diagnostic-status").textContent(),
    );
    const initialTextures = await page.evaluate(() => GL.textures.length);
    assert.ok(
      initialTextures >= 50,
      "the game must have uploaded its actual scene textures",
    );
    if (smooth)
      assert.ok(
        await page.evaluate(() => Module.canvas.width <= 800),
        "smooth mode must reduce the actual game canvas resolution",
      );
    if (perf)
      await page.waitForFunction(
        () => document.getElementById("output").value.includes("[Performance]"),
        null,
        { timeout: 60000 },
      );
    for (const height of [720, 1000]) {
      await page.setViewportSize({ width: 1280, height });
      await page.waitForFunction(() => {
        const canvas = document
          .getElementById("canvas")
          .getBoundingClientRect();
        const frame = document
          .getElementById("game-screen")
          .getBoundingClientRect();
        return ["x", "y", "width", "height"].every(
          (key) => Math.abs(frame[key] - canvas[key]) < 1,
        );
      });
    }
    await fs.mkdir("test-results", { recursive: true });
    await page.screenshot({ path: "test-results/game-first-scene.png" });
    // Wait for visible warning text, rather than assuming the original fade-in
    // completes in a fixed wall-clock delay on a software GPU.
    await page.waitForFunction(
      () => {
        const gl = GL.currentContext.GLctx;
        const width = gl.drawingBufferWidth,
          height = gl.drawingBufferHeight;
        const previous = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
        const w = Math.floor(width * 0.6),
          h = Math.floor(height * 0.4);
        const pixels = new Uint8Array(w * h * 4);
        gl.readPixels(
          Math.floor(width * 0.2),
          Math.floor(height * 0.3),
          w,
          h,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixels,
        );
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, previous);
        for (let i = 0; i < pixels.length; i += 4)
          if (pixels[i] > 110) return true;
        return false;
      },
      null,
      { timeout: 90000, polling: 1000 },
    );
    await page.waitForTimeout(2000);
    const box = await page.locator("#canvas").boundingBox();
    // Deliberately use a click with no artificial Playwright delay.
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForFunction(
      (n) => GL.textures.length > n || Inferno.phase === "error",
      initialTextures,
      { timeout: 60000 },
    );
    assert.equal(await page.evaluate(() => Inferno.phase), "running");
    assert.ok((await page.locator("#graphics-device").textContent()).length > 0);
    if (checkAudio) {
      assert.ok(await page.evaluate(() => Module.boxedwineAudio), "the game must use the real AudioWorklet backend");
      await page.waitForFunction(() => gameSpeakerPeak() > 0.000001, null, {
        timeout: 90000,
      });
      await page.locator("#sound-button").click();
      await page.evaluate(() => Module.boxedwineAudio.context.suspend());
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForFunction(() => Module.boxedwineAudio.context.state === "running");
      await page.waitForTimeout(150);
      assert.ok(await page.evaluate(() => gameSpeakerPeak() < 0.000001), "engine auto-resume must remain silent");
      await page.locator("#volume-knob").focus();
      await page.keyboard.press("Home");
      for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowUp");
      assert.equal(await page.locator("#volume-knob").getAttribute("aria-valuenow"), "50");
      await page.waitForFunction(() => gameSpeakerPeak() > 0.000001);
      console.log("Real game audio: audible output, mute across engine resume, and volume knob verified.");
    }
    assert.deepEqual(errors, []);
    await page.screenshot({ path: "test-results/game-after-click.png" });
    await fs.writeFile(
      "test-results/game.log",
      await page.locator("#output").inputValue(),
    );
    console.log(
      "Original game rendered; a normal click advanced to the next scene.",
    );
  } finally {
    if (page && !page.isClosed()) {
      await fs.mkdir("test-results", { recursive: true });
      await fs.writeFile(
        "test-results/game.log",
        await page
          .locator("#output")
          .inputValue()
          .catch(() => "Page unavailable"),
      );
      await page
        .screenshot({
          path: "test-results/game-last-state.png",
          timeout: 10000,
        })
        .catch(() => {});
    }
    await browser?.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
