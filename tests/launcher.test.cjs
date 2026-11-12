const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { chromium } = require("playwright");
let server, browser;
const base = "http://127.0.0.1:18088/?lang=es";
before(async () => {
  server = spawn("python3", ["web-boxedwine/server.py", "--port", "18088"], {
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

test("inicio ligero, ayuda, sonido y diseño móvil", async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("request", (r) => requests.push(r.url()));
  await page.goto(base);
  assert.equal(await page.title(), "Little Inferno · Jugar");
  assert.equal(
    requests.some((url) => /\.(zip|wasm)(?:\?|$)/.test(url)),
    false,
  );
  assert.equal(await page.locator("#diagnostics").getAttribute("open"), null);
  await page.locator("#help-button").click();
  assert.equal(await page.locator("#help").isVisible(), true);
  await page.locator("#sound-button").click();
  assert.equal(
    await page.locator("#sound-button").getAttribute("aria-label"),
    "Activar sonido",
  );
  await page.locator("#fullscreen-button").click();
  await page.waitForFunction(
    () =>
      document.fullscreenElement !== null &&
      document
        .getElementById("fullscreen-button")
        .getAttribute("aria-label") === "Salir de pantalla completa",
  );
  assert.equal(
    await page.locator("#fullscreen-button").getAttribute("aria-label"),
    "Salir de pantalla completa",
  );
  await page.locator("#fullscreen-button").click();
  await page.waitForFunction(() => document.fullscreenElement === null);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.deepEqual(errors, []);
  await page.close();
});

test("una descarga fallida muestra error y conserva los datos del sitio", async () => {
  const page = await browser.newPage();
  await page.route("**/littleinferno.zip", (route) =>
    route.fulfill({ status: 404, body: "missing" }),
  );
  await page.goto(base);
  await page.evaluate(() => localStorage.setItem("unrelated-data", "keep"));
  await page.locator("#play-button").click();
  await page.waitForFunction(() => Inferno.phase === "error");
  assert.match(
    await page.locator("#diagnostic-status").textContent(),
    /littleinferno.zip: HTTP 404/,
  );
  assert.equal(await page.locator("#curtain").isVisible(), true);
  assert.equal(await page.locator("#retry-button").isVisible(), true);
  assert.equal(
    await page.evaluate(() => localStorage.getItem("unrelated-data")),
    "keep",
  );
  await page.close();
});

test("el silencio permanece al reanudar el audio con clics y teclas del juego", async () => {
  const page = await browser.newPage();
  // Meter the final speaker connection, downstream of the application's mixer.
  await page.addInitScript(() => {
    const connect = AudioNode.prototype.connect;
    window.speakerMeters = [];
    AudioNode.prototype.connect = function (destination, ...args) {
      if (destination === this.context.destination) {
        const meter = this.context.createAnalyser();
        meter.fftSize = 2048;
        connect.call(this, meter, ...args);
        connect.call(meter, destination);
        speakerMeters.push(meter);
        return destination;
      }
      return connect.call(this, destination, ...args);
    };
  });
  await page.goto(base);
  await page.evaluate(async () => {
    const context = (window.gameAudio = new AudioContext());
    const source = context.createConstantSource();
    source.offset.value = 0.2;
    source.connect(context.destination);
    source.start();
    window.speakerPeak = () => {
      const data = new Float32Array(2048);
      speakerMeters[0].getFloatTimeDomainData(data);
      return Math.max(...data.map(Math.abs));
    };
    for (const event of ["pointerdown", "mousedown", "keydown", "touchstart"])
      window.addEventListener(event, () => context.resume(), true);
    document.getElementById("curtain").hidden = true;
    document.getElementById("canvas").style.visibility = "visible";
  });
  await page.locator("#sound-button").click(); // mute before the engine resumes
  await page.evaluate(() => gameAudio.resume());
  await page.waitForTimeout(100);
  assert.ok(await page.evaluate(() => speakerPeak() < 0.000001));
  for (const event of ["click", "key"]) {
    await page.evaluate(() => gameAudio.suspend());
    if (event === "click") await page.locator("#canvas").click();
    else await page.keyboard.press("Space");
    await page.waitForFunction(() => gameAudio.state === "running");
    await page.waitForTimeout(100);
    assert.ok(await page.evaluate(() => speakerPeak() < 0.000001), event);
    assert.equal(await page.locator("#sound-button").getAttribute("aria-pressed"), "true");
  }
  await page.locator("#sound-button").click();
  await page.waitForFunction(() => speakerPeak() > 0.19);
  await page.evaluate(() => gameAudio.close());
  await page.close();
});

test("el knob ajusta la salida real, recuerda volumen y silencio y admite nuevos dispositivos", async () => {
  const page = await browser.newPage();
  await page.goto(base);
  const sampleOutput = () => page.evaluate(async () => {
    const context = new OfflineAudioContext(1, 256, 48000);
    const source = context.createConstantSource();
    source.offset.value = 0.5;
    if (source.connect(context.destination) !== context.destination)
      throw new Error("connect() must retain its normal return value");
    source.disconnect(context.destination);
    source.connect(context.destination);
    source.start();
    const result = await context.startRendering();
    return result.getChannelData(0)[128];
  });
  assert.equal(await sampleOutput(), 0.5);
  await page.evaluate(() => {
    // Match SDL's capture handlers, installed after the player's controls.
    window.addEventListener("keydown", event => event.stopImmediatePropagation(), true);
  });
  const knob = page.locator("#volume-knob");
  await knob.focus();
  await page.keyboard.press("Home");
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowUp");
  assert.equal(await knob.getAttribute("aria-valuenow"), "50");
  assert.equal(await sampleOutput(), 0.25);
  // Drag upwards by 20 pixels: ten percentage points, without scrolling.
  const box = await knob.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 20, { steps: 4 });
  await page.mouse.up();
  assert.equal(await knob.getAttribute("aria-valuenow"), "60");
  assert.ok(Math.abs(await sampleOutput() - 0.3) < 0.000001);
  await page.locator("#sound-button").click();
  assert.equal(await sampleOutput(), 0, "a device created after mute must also be silent");
  await page.reload();
  assert.equal(await knob.getAttribute("aria-valuenow"), "60");
  assert.equal(await page.locator("#sound-button").getAttribute("aria-pressed"), "true");
  assert.equal(await sampleOutput(), 0);
  await knob.focus();
  await page.keyboard.press("Home");
  await page.locator("#sound-button").click();
  assert.equal(await knob.getAttribute("aria-valuenow"), "60");
  assert.ok(Math.abs(await sampleOutput() - 0.3) < 0.000001);
  await page.close();
});

test("un ZIP inválido no deja una pantalla negra", async () => {
  const page = await browser.newPage();
  await page.route("**/littleinferno.zip", (route) =>
    route.fulfill({ contentType: "application/zip", body: "invalid zip" }),
  );
  await page.goto(base);
  await page.locator("#play-button").click();
  await page.waitForFunction(() => Inferno.phase === "error");
  assert.equal(await page.locator("#error-actions").isVisible(), true);
  assert.equal(await page.locator("#curtain").isVisible(), true);
  await page.close();
});

test("un inicio sin escena vence con un error visible", async () => {
  const page = await browser.newPage();
  await page.goto(base);
  await page.clock.install();
  await page.route("**/runtime.js", (route) =>
    route.fulfill({
      body: "Inferno.booting();",
      contentType: "text/javascript",
    }),
  );
  await page.route("**/boxedwine.js", (route) =>
    route.fulfill({ body: "", contentType: "text/javascript" }),
  );
  await page.locator("#play-button").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#status")
      .textContent.includes("Iniciando el juego"),
  );
  await page.clock.fastForward(301000);
  assert.equal(await page.evaluate(() => Inferno.phase), "error");
  assert.match(await page.locator("#diagnostic-status").textContent(), /300 s/);
  await page.close();
});

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
function zip(files) {
  const result = spawnSync(
    "python3",
    [
      "-c",
      'import io,json,sys,zipfile; b=io.BytesIO(); z=zipfile.ZipFile(b,"w"); [(z.writestr(k,v)) for k,v in json.load(sys.stdin).items()]; z.close(); sys.stdout.buffer.write(b.getvalue())',
    ],
    { input: JSON.stringify(files) },
  );
  assert.equal(result.status, 0);
  return result.stdout;
}
async function stubGameFiles(page) {
  await page.route("**/littleinferno.zip", (route) =>
    route.fulfill({
      contentType: "application/zip",
      body: zip({
        "Little Inferno.exe": "fixture",
        "resource.pak": "fixture",
        "embed.pak": "fixture",
        "frontend.pak": "fixture",
      }),
    }),
  );
  await page.route("**/boxedwine.zip", (route) =>
    route.fulfill({
      contentType: "application/zip",
      body: zip({
        "home/username/.wine/user.reg": "WINE REGISTRY Version 2\n",
        "bin/wine.link": "/opt/wine/bin/wine",
        "opt/wine/bin/wine": "fixture",
      }),
    }),
  );
  // Use the real Emscripten FS and WASM initialization, without executing a fixture EXE.
  await page.route("**/runtime.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body:
        fs.readFileSync("web-boxedwine/runtime.js", "utf8") +
        "\nModule.noInitialRun = true;",
    }),
  );
}

test("la primera comprobación y todos los contextos WebGL solicitan alto rendimiento", async () => {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    window.graphicsRequests = [];
    for (const prototype of [HTMLCanvasElement.prototype, OffscreenCanvas.prototype]) {
      const getContext = prototype.getContext;
      prototype.getContext = function (type, attrs) {
        if (/webgl/.test(type)) graphicsRequests.push(attrs?.powerPreference);
        return getContext.call(this, type, attrs);
      };
    }
  });
  await stubGameFiles(page);
  await page.goto(base);
  await page.locator("#play-button").click();
  await page.waitForFunction(() => window.Module?.calledRun);
  const preference = await page.evaluate(() => {
    const handle = GL.createContext(document.getElementById("canvas"), { majorVersion: 2, powerPreference: "default" });
    GL.createContext(document.createElement("canvas"), { majorVersion: 2, powerPreference: "low-power" });
    const offscreen = new OffscreenCanvas(16, 16).getContext("webgl2", { powerPreference: "low-power" });
    return { requests: graphicsRequests, actual: GL.getContext(handle).GLctx.getContextAttributes().powerPreference, offscreen: offscreen.getContextAttributes().powerPreference };
  });
  assert.ok(preference.requests.length >= 4);
  assert.ok(preference.requests.every(value => value === "high-performance"));
  assert.equal(preference.actual, "high-performance");
  assert.equal(preference.offscreen, "high-performance");
  assert.match(await page.locator("#graphics-device").textContent(), /Renderizador gráfico: /);
  await page.locator("#language-select").selectOption("fr");
  assert.match(await page.locator("#graphics-device").textContent(), /Moteur graphique : /);
  await page.close();
});

test("el modo de fluidez se recuerda y llega al motor sin cambiar el guardado", async () => {
  const page = await browser.newPage();
  await stubGameFiles(page);
  await page.goto(base);
  assert.equal(await page.evaluate(() => Inferno.resolution), "960x540");
  await page.locator("#quality-select").selectOption("smooth");
  await page.reload();
  assert.equal(await page.locator("#quality-select").inputValue(), "smooth");
  await page.locator("#play-button").click();
  await page.waitForFunction(() => window.Module?.calledRun);
  assert.equal(await page.locator("#quality-select").isDisabled(), true);
  const args = await page.evaluate(() => Module.arguments);
  assert.equal(args[args.indexOf("-resolution") + 1], "800x450");
  assert.equal(args[args.indexOf("-root") + 1], "/profile/little-inferno");
  await page.close();
});

test("el montaje real conserva cambios en el juego y el perfil de Wine al recargar", async () => {
  const page = await browser.newPage();
  await stubGameFiles(page);
  await page.goto(base);
  await page.locator("#play-button").click();
  await page.waitForFunction(() => window.Module?.calledRun);
  await page.evaluate(() => {
    FS.writeFile("/profile/little-inferno/profiles.bin", "game-save");
    FS.writeFile(
      "/profile/little-inferno/home/username/.wine/test-save",
      "wine-save",
    );
  });
  // IDBFS autoPersist queues IndexedDB transactions asynchronously.
  await page.evaluate(
    () =>
      new Promise((resolve, reject) =>
        FS.syncfs(false, (e) => (e ? reject(e) : resolve())),
      ),
  );
  await page.reload();
  await page.locator("#play-button").click();
  await page.waitForFunction(() => window.Module?.calledRun);
  const saved = await page.evaluate(() => [
    FS.readFile("/profile/little-inferno/profiles.bin", { encoding: "utf8" }),
    FS.readFile("/profile/little-inferno/home/username/.wine/test-save", {
      encoding: "utf8",
    }),
  ]);
  assert.deepEqual(saved, ["game-save", "wine-save"]);
  assert.equal(
    await page.locator("#curtain").isVisible(),
    true,
    "montar archivos no significa que el juego haya dibujado",
  );
  await page.close();
});

test("sin IndexedDB permite iniciar y avisa de que el guardado es temporal", async () => {
  const page = await browser.newPage();
  await page.addInitScript(() =>
    Object.defineProperty(window, "indexedDB", {
      get() {
        throw new Error("Storage unavailable");
      },
    }),
  );
  await stubGameFiles(page);
  await page.goto(base);
  await page.locator("#play-button").click();
  await page.waitForFunction(() => window.Module?.calledRun);
  assert.match(
    await page.locator("#save-status").textContent(),
    /solo se conservará durante esta sesión/,
  );
  await page.close();
});

test("el marco sigue la resolución del canvas al redimensionar y en pantalla completa", async () => {
  const page = await browser.newPage();
  await stubGameFiles(page);
  await page.goto(base);
  await page.locator("#play-button").click();
  await page.waitForFunction(() => window.Module?.calledRun);
  await page.evaluate(() => Inferno.ready());

  const checkFrame = async () => {
    await page.waitForFunction(() => {
      const canvas = document.getElementById("canvas");
      const frame = document
        .getElementById("game-screen")
        .getBoundingClientRect();
      const image = canvas.getBoundingClientRect();
      return (
        Math.abs(frame.width / frame.height - canvas.width / canvas.height) <
          0.003 &&
        ["x", "y", "width", "height"].every(
          (key) => Math.abs(frame[key] - image[key]) < 1,
        )
      );
    });
    const sizes = await page.evaluate(() => {
      const image = document.getElementById("canvas").getBoundingClientRect();
      return {
        width: image.width,
        height: image.height,
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
      };
    });
    assert.ok(
      sizes.width <= sizes.viewportWidth &&
        sizes.height <= sizes.viewportHeight,
    );
  };

  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1280, height: 1000 },
    { width: 900, height: 600 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const [width, height] of [
      [960, 540],
      [800, 600],
      [851, 479],
      [1024, 1024],
    ]) {
      await page.evaluate(
        ([width, height]) => {
          const canvas = document.getElementById("canvas");
          canvas.width = width;
          canvas.height = height;
        },
        [width, height],
      );
      await checkFrame();
    }
  }

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.locator("#fullscreen-button").click();
  await page.waitForFunction(() => document.fullscreenElement !== null);
  for (const [width, height] of [
    [960, 540],
    [800, 600],
  ]) {
    await page.evaluate(
      ([width, height]) => {
        const canvas = document.getElementById("canvas");
        canvas.width = width;
        canvas.height = height;
      },
      [width, height],
    );
    await checkFrame();
  }
  await page.locator("#fullscreen-button").click();
  await page.waitForFunction(() => document.fullscreenElement === null);
  await checkFrame();
  await page.close();
});

test("los clics breves duran lo suficiente para que el juego los vea", async () => {
  const page = await browser.newPage();
  await page.goto(base);
  await page.evaluate(() => {
    const canvas = document.querySelector("#canvas");
    canvas.style.visibility = "visible";
    document.querySelector("#curtain").hidden = true;
    window.mouseEvents = [];
    for (const type of ["mousedown", "mouseup"])
      window.addEventListener(
        type,
        (e) => mouseEvents.push({ type, time: performance.now() }),
        true,
      );
    // The emulator consumes input on window before it reaches the canvas.
    window.addEventListener(
      "mousedown",
      (e) => e.stopImmediatePropagation(),
      true,
    );
  });
  const box = await page.locator("#canvas").boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => mouseEvents.length === 2);
  const events = await page.evaluate(() => mouseEvents);
  assert.deepEqual(
    events.map((e) => e.type),
    ["mousedown", "mouseup"],
  );
  assert.ok(
    events[1].time - events[0].time >= 200,
    "mouse up must survive one slow emulated frame",
  );
  await page.close();
});

for (const [language, locale, title, heading, start, mute] of [
  [
    "en",
    "en-US",
    "Little Inferno · Play",
    "It’s cold outside.",
    "Light the fireplace",
    "Enable sound",
  ],
  [
    "es",
    "es-ES",
    "Little Inferno · Jugar",
    "Hace frío ahí fuera.",
    "Encender la chimenea",
    "Activar sonido",
  ],
  [
    "de",
    "de-DE",
    "Little Inferno · Spielen",
    "Draußen ist es kalt.",
    "Den Kamin anzünden",
    "Ton einschalten",
  ],
  [
    "fr",
    "fr-FR",
    "Little Inferno · Jouer",
    "Il fait froid dehors.",
    "Allumer la cheminée",
    "Activer le son",
  ],
]) {
  test(`interfaz completa y accesible en ${language}, también en móvil`, async () => {
    const page = await browser.newPage({
      locale,
      viewport: { width: 390, height: 844 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(base.split("?")[0]);
    assert.equal(await page.locator("html").getAttribute("lang"), language);
    assert.equal(await page.title(), title);
    assert.equal(
      await page.locator('link[rel="manifest"]').getAttribute("href"),
      `manifests/${language}.webmanifest`,
    );
    assert.equal(await page.locator("#page-title").textContent(), heading);
    assert.equal(
      (await page.locator("#play-button").textContent()).trim(),
      start,
    );
    await page.locator("#sound-button").click();
    assert.equal(
      await page.locator("#sound-button").getAttribute("aria-label"),
      mute,
    );
    await page.locator("#help-button").click();
    assert.equal(await page.locator("#help").isVisible(), true);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    assert.deepEqual(errors, []);
    await page.close();
  });
}

test("cambiar idioma conserva la elección y traduce estados, errores y guardado", async () => {
  const page = await browser.newPage();
  await page.route("**/runtime.js", (r) =>
    r.fulfill({ body: "Inferno.booting();", contentType: "text/javascript" }),
  );
  await page.route("**/boxedwine.js", (r) =>
    r.fulfill({ body: "", contentType: "text/javascript" }),
  );
  await page.goto(base);
  const coverage = await page.evaluate(() => {
    const base = I18n.messages.en,
      keys = Object.keys(base).sort();
    return Object.entries(I18n.messages).every(
      ([, table]) =>
        JSON.stringify(Object.keys(table).sort()) === JSON.stringify(keys) &&
        keys.every((key) => {
          const vars = (s) =>
            JSON.stringify((s.match(/\{\w+\}/g) || []).sort());
          return table[key].length && vars(table[key]) === vars(base[key]);
        }),
    );
  });
  assert.equal(
    coverage,
    true,
    "every message and interpolation must exist in all four languages",
  );
  await page.locator("#play-button").click();
  await page.waitForFunction(() =>
    document.querySelector("#status").textContent.includes("Iniciando"),
  );
  await page.evaluate(() => {
    Inferno.progress("downloadGame", 25, 100);
    Inferno.storage(false);
  });
  await page.locator("#language-select").selectOption("de");
  assert.match(
    await page.locator("#status").textContent(),
    /Spiel wird heruntergeladen · 25 %/,
  );
  assert.match(
    await page.locator("#save-status").textContent(),
    /nur für diese Sitzung/,
  );
  await page.evaluate(() =>
    Inferno.fail(
      "filesFailed",
      I18n.error("httpError", { file: "littleinferno.zip", status: 404 }),
    ),
  );
  await page.locator("#language-select").selectOption("fr");
  assert.equal(
    await page.locator("#status").textContent(),
    "Les fichiers du jeu n’ont pas pu être chargés.",
  );
  assert.match(
    await page.locator("#diagnostic-status").textContent(),
    /HTTP 404.*fichier.*intégralité/,
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem("little-inferno-language")),
    "fr",
  );
  await page.reload();
  assert.equal(await page.locator("html").getAttribute("lang"), "fr");
  assert.equal(await page.title(), "Little Inferno · Jouer");
  await page.close();
});
