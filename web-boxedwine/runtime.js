/* Little Inferno launcher for BoxedWine 26R2 / Wine 11 WebGL.
 * Runtime source and licenses: third-party/README.md. */
var Module = (() => {
  "use strict";
  const app = window.Inferno;
  const canvas = document.getElementById("canvas");
  const profile = "/profile/little-inferno";
  const gamePath = "/home/username/.wine/dosdevices/c:/files";
  const debug = new URLSearchParams(location.search).get("debug") === "1";
  const measureFrames = new URLSearchParams(location.search).get("perf") === "1";

  // Inspect the central directory before handing an archive to the native ZIP FS.
  function validateZip(bytes, path, required = []) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let end = bytes.length - 22;
    for (; end >= Math.max(0, bytes.length - 65557); end--)
      if (view.getUint32(end, true) === 0x06054b50) break;
    if (end < 0 || end < bytes.length - 65557)
      throw I18n.error("zipInvalid", { file: path });
    const entries = view.getUint16(end + 10, true);
    let offset = view.getUint32(end + 16, true);
    const names = new Set();
    for (let i = 0; i < entries; i++) {
      if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50)
        throw I18n.error("zipDirectory", { file: path });
      const length = view.getUint16(offset + 28, true);
      names.add(
        new TextDecoder().decode(
          bytes.subarray(offset + 46, offset + 46 + length),
        ),
      );
      offset +=
        46 +
        length +
        view.getUint16(offset + 30, true) +
        view.getUint16(offset + 32, true);
    }
    for (const name of required)
      if (!names.has(name))
        throw I18n.error("zipMissing", { name, file: path });
  }

  async function downloadZip(path, label, required) {
    const bytes = await InfernoAssets.download(path, label);
    validateZip(bytes, path, required);
    // Native BoxedWine mounts ZIPs directly; canOwn avoids a second 320 MB copy.
    FS.writeFile(`/${path}`, bytes, { canOwn: true });
  }

  async function mountProfile() {
    FS.mkdirTree(profile);
    let mounted = false;
    try {
      // Access can throw in private or storage-restricted browsing contexts.
      if (!window.indexedDB) throw I18n.error("storageUnavailable");
      FS.mount(IDBFS, { autoPersist: true }, profile);
      mounted = true;
      await new Promise((resolve, reject) =>
        FS.syncfs(true, (e) => (e ? reject(e) : resolve())),
      );
      app.storage(true);
    } catch (error) {
      if (mounted) FS.unmount(profile);
      app.log(I18n.t("tempStorage", { error: error.message || error }));
      app.storage(false);
    }
  }

  async function setup() {
    Module.addRunDependency("little-inferno-files");
    try {
      await downloadZip("littleinferno.zip", "downloadGame", [
        "Little Inferno.exe",
        "resource.pak",
        "embed.pak",
        "frontend.pak",
      ]);
      await downloadZip("boxedwine.zip", "downloadEngine");
      await mountProfile();
      // Only seed new profiles. Native Wine's writable union holds all game saves.
      for (const directory of ["AppData/Roaming", "Application Data"]) {
        const path = `${profile}/home/username/.wine/drive_c/users/username/${directory}/Little Inferno`;
        FS.mkdirTree(path);
        if (!FS.analyzePath(`${path}/settings.txt`).exists)
          FS.writeFile(`${path}/settings.txt`, "fullscreen = 0\nvsync = 1\n");
      }
      Module.arguments.push(
        "-root",
        profile,
        "-zip",
        "/boxedwine.zip",
        "-mount",
        "/littleinferno.zip",
        gamePath,
        "-resolution",
        app.resolution,
        "-disableHideCursor",
        "-w",
        gamePath,
        "-env",
        debug
          ? "WINEDEBUG=fixme-all,trace+seh,trace+d3d"
          : "WINEDEBUG=fixme-all,err+all",
        "/bin/wine",
        "Little Inferno.exe",
        "-d3d9",
      );
      app.log("BoxedWine 26R2 · Wine 11 · Direct3D 9 → WebGL 2");
      app.booting();
      Module.removeRunDependency("little-inferno-files");
    } catch (error) {
      app.fail("filesFailed", error);
    }
  }

  // Keep the last frame visible while the cooperative CPU yields to the browser.
  const getContext = canvas.getContext.bind(canvas);
  canvas.getContext = (type, attrs) =>
    getContext(
      type,
      /webgl/.test(type)
        ? {
            ...attrs,
            preserveDrawingBuffer: true,
            powerPreference: "high-performance",
          }
        : attrs,
    );
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    app.fail("graphicsLost");
  });
  const sizeCanvas = () =>
    canvas
      .closest(".player")
      .style.setProperty("--canvas-ratio", canvas.width / canvas.height);
  sizeCanvas();
  new MutationObserver(sizeCanvas).observe(canvas, {
    attributes: true,
    attributeFilter: ["width", "height"],
  });
  let draws = 0,
    frames = 0;
  let lastPresent = 0,
    sampleStart = 0,
    intervals = [];
  if (measureFrames)
    document.addEventListener("visibilitychange", () => {
      lastPresent = sampleStart = 0;
      intervals = [];
    });
  function recordPresent() {
    const now = performance.now();
    if (document.hidden || app.phase !== "running") {
      lastPresent = sampleStart = 0;
      intervals = [];
      return;
    }
    if (lastPresent) intervals.push(now - lastPresent);
    else sampleStart = now;
    lastPresent = now;
    if (now - sampleStart < 10000 || intervals.length < 2) return;
    const sorted = intervals.slice().sort((a, b) => a - b);
    const percentile = (q) => sorted[Math.floor((sorted.length - 1) * q)].toFixed(1);
    app.log(
      `[Performance] ${canvas.width}x${canvas.height} · ` +
        `${((intervals.length * 1000) / (now - sampleStart)).toFixed(1)} FPS · ` +
        `frame median=${percentile(0.5)} ms p95=${percentile(0.95)} ms ` +
        `max=${sorted[sorted.length - 1].toFixed(1)} ms`,
    );
    sampleStart = now;
    intervals = [];
  }
  return {
    arguments: [],
    canvas,
    preRun: [setup],
    print: (...parts) => app.log(parts.join(" ")),
    printErr: (...parts) => app.log(parts.join(" ")),
    setStatus: () => {},
    onAbort: (error) => app.fail("runtimeStopped", String(error)),
    onExit: (code) =>
      app.fail("gameClosed", { key: "exitCode", vars: { code } }),
    boxedwinePresentSoftwareFrame(width, height, buffer) {
      const surface = document.getElementById("boxedwine-webgl-canvas-0");
      surface.width = width;
      surface.height = height;
      surface
        .getContext("2d")
        .putImageData(
          new ImageData(new Uint8ClampedArray(buffer), width, height),
          0,
          0,
        );
    },
    onRuntimeInitialized() {
      const createContext = GL.createContext;
      GL.createContext = function (...args) {
        const handle = createContext.apply(this, args);
        const gl = handle && GL.getContext(handle).GLctx;
        if (gl && args[0] === canvas && !gl.infernoObserved) {
          gl.infernoObserved = true;
          const info = gl.getExtension("WEBGL_debug_renderer_info");
          app.graphics(
            gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
          );
          let drawingToScreen = true;
          let viewWidth = 0,
            viewHeight = 0;
          const viewport = gl.viewport.bind(gl);
          gl.viewport = (x, y, width, height) => {
            viewWidth = width;
            viewHeight = height;
            return viewport(x, y, width, height);
          };
          const bind = gl.bindFramebuffer.bind(gl);
          gl.bindFramebuffer = (target, framebuffer) => {
            if (target === gl.FRAMEBUFFER || target === gl.DRAW_FRAMEBUFFER)
              drawingToScreen = framebuffer === null;
            return bind(target, framebuffer);
          };
          for (const method of [
            "drawArrays",
            "drawElements",
            "blitFramebuffer",
          ]) {
            const original = gl[method].bind(gl);
            gl[method] = function (...values) {
              const large =
                method === "blitFramebuffer"
                  ? Math.abs(values[6] - values[4]) >= 640 &&
                    Math.abs(values[7] - values[5]) >= 360
                  : viewWidth >= 640 && viewHeight >= 360;
              if (drawingToScreen && large) draws++;
              const result = original(...values);
              if (
                measureFrames &&
                method === "blitFramebuffer" &&
                drawingToScreen &&
                large
              )
                recordPresent();
              return result;
            };
          }
        }
        return handle;
      };
      const observe = () => {
        if (canvas.width >= 640 && canvas.height >= 360 && draws > 0) {
          if (++frames >= 3) {
            app.ready();
            return;
          }
        }
        draws = 0;
        if (app.phase === "loading") requestAnimationFrame(observe);
      };
      requestAnimationFrame(observe);
    },
  };
})();
