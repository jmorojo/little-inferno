(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const t = (...args) => I18n.t(...args);
  const quality = $("quality-select");
  try {
    if (localStorage.getItem("little-inferno.quality") === "smooth")
      quality.value = "smooth";
  } catch {}
  quality.addEventListener("change", () => {
    try {
      localStorage.setItem("little-inferno.quality", quality.value);
    } catch {}
  });
  let phase = "idle",
    startupTimer,
    logFlush;
  let graphicsDevice;
  let statusState = { key: "firstLoad" },
    detailState = { key: "idleDetail" },
    persistent;
  const logLines = [];
  let logLength = 0;
  const describe = (value) =>
    value?.i18nKey
      ? t(value.i18nKey, value.i18nVars)
      : value?.key
        ? t(value.key, value.vars)
        : String(value?.message || value || "");
  function render() {
    $("session-status").dataset.state = phase;
    $("session-label").textContent = t(
      {
        idle: "phaseIdle",
        loading: "phaseLoading",
        running: "phaseRunning",
        error: "phaseError",
      }[phase],
    );
    $("launch-title").textContent = t(
      phase === "error"
        ? "errorTitle"
        : phase === "idle"
          ? "spark"
          : "launchTitle",
    );
    $("status").textContent = describe(statusState);
    $("diagnostic-status").textContent = describe(detailState);
    $("save-status").textContent = t(
      persistent === undefined
        ? "saveDefault"
        : persistent
          ? "savePersistent"
          : "saveTemporary",
    );
    const audio = InfernoAudio;
    const soundLabel = t(audio.muted ? "unmute" : "mute");
    $("sound-button").setAttribute("aria-label", soundLabel);
    $("sound-button").setAttribute("aria-pressed", String(audio.muted));
    $("sound-button").title = soundLabel;
    const volumeLabel = t(audio.muted ? "volumeMuted" : "volumeLevel", {
      volume: audio.volume,
    });
    $("volume-knob").setAttribute("aria-label", t("volume"));
    $("volume-knob").setAttribute("aria-valuenow", audio.volume);
    $("volume-knob").setAttribute("aria-valuetext", volumeLabel);
    $("volume-knob").title = volumeLabel;
    $("volume-knob").style.setProperty(
      "--volume-angle",
      `${audio.volume * 2.7 - 135}deg`,
    );
    $("volume-value").textContent = `${audio.volume}%`;
    if (graphicsDevice)
      $("graphics-device").textContent = t("graphicsDevice", {
        renderer: graphicsDevice,
      });
    const fullscreen = t(
      document.fullscreenElement ? "exitFullscreen" : "fullscreen",
    );
    $("fullscreen-button").setAttribute("aria-label", fullscreen);
    $("fullscreen-button").title = fullscreen;
    $("fullscreen-button").querySelector("span").textContent = fullscreen;
  }
  function status(key, vars = {}, detail) {
    statusState = { key, vars };
    detailState = detail || statusState;
    render();
  }
  function log(text) {
    text = String(text);
    logLines.push(text);
    logLength += text.length;
    while (logLength > 80000 && logLines.length > 1)
      logLength -= logLines.shift().length;
    if (!logFlush)
      logFlush = setTimeout(() => {
        $("output").value = logLines.join("\n");
        $("output").scrollTop = $("output").scrollHeight;
        logFlush = null;
      }, 50);
    console.log("[Little Inferno]", text);
  }
  function fail(key, detail) {
    if (phase === "error") return;
    clearTimeout(startupTimer);
    window.MainLoop?.pause();
    phase = "error";
    $("game-screen").classList.remove("running");
    $("curtain").hidden = false;
    $("play-button").hidden = true;
    $("progress").hidden = true;
    $("error-actions").hidden = false;
    status(key, {}, detail || { key });
    log(detail?.stack || describe(detail || { key }));
  }
  function ready() {
    if (phase !== "loading") return;
    clearTimeout(startupTimer);
    phase = "running";
    $("curtain").hidden = true;
    $("game-screen").classList.add("running");
    $("canvas").focus({ preventScroll: true });
    detailState = { key: "readyDetail" };
    render();
  }
  async function loadScript(src) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(I18n.error("scriptFailed", { file: src }));
      document.head.appendChild(script);
    });
  }
  async function startGame() {
    if (phase !== "idle") return;
    phase = "loading";
    quality.disabled = true;
    $("play-button").hidden = true;
    status("checkBrowser");
    try {
      if (location.protocol === "file:") throw I18n.error("httpRequired");
      if (!window.WebAssembly) throw I18n.error("wasmRequired");
      if (window.InfernoIsolation && !(await InfernoIsolation.ready))
        throw I18n.error("isolationRequired");
      await loadScript("webgl-compat.js");
      const gl = document.createElement("canvas").getContext("webgl2");
      if (!gl) throw I18n.error("webglRequired");
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      await loadScript("asset-loader.js");
      await loadScript("runtime.js");
      await loadScript("boxedwine.js");
    } catch (error) {
      fail("prepareFailed", error);
    }
  }
  window.Inferno = {
    log,
    fail,
    ready,
    status,
    graphics(renderer) {
      graphicsDevice = renderer;
      $("graphics-device").hidden = false;
      log(`[Graphics] ${renderer} · requested powerPreference=high-performance`);
      render();
    },
    get phase() {
      return phase;
    },
    get resolution() {
      return quality.value === "smooth" ? "800x450" : "960x540";
    },
    booting() {
      status("starting");
      $("progress").hidden = true;
      startupTimer = setTimeout(
        () => fail("timeout", { key: "timeoutDetail" }),
        300000,
      );
    },
    progress(key, loaded, total) {
      if (phase !== "loading") return;
      const progress = $("progress");
      progress.hidden = false;
      if (total > 0) {
        progress.max = total;
        progress.value = loaded;
      } else progress.removeAttribute("value");
      // Keep the key and numbers so a language change also updates an active download.
      statusState = {
        get message() {
          return `${t(key)} · ${total > 0 ? Math.round((loaded / total) * 100) + " %" : (loaded / 1048576).toLocaleString(I18n.language, { maximumFractionDigits: 1 }) + " MB"}`;
        },
      };
      detailState = statusState;
      render();
    },
    storage(value) {
      persistent = value;
      render();
    },
  };
  $("play-button").addEventListener("click", startGame);
  $("retry-button").addEventListener("click", () => location.reload());
  $("error-details").addEventListener("click", () => {
    $("diagnostics").open = true;
    $("diagnostics").scrollIntoView({ behavior: "smooth", block: "center" });
  });
  $("sound-button").addEventListener("click", () => {
    InfernoAudio.toggleMute();
    InfernoAudio.resume();
  });
  const knob = $("volume-knob");
  let volumeDrag;
  knob.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || volumeDrag) return;
    event.preventDefault();
    knob.focus({ preventScroll: true });
    volumeDrag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      volume: InfernoAudio.volume,
    };
    knob.setPointerCapture(event.pointerId);
    InfernoAudio.resume();
  });
  knob.addEventListener("pointermove", (event) => {
    if (volumeDrag?.id !== event.pointerId) return;
    InfernoAudio.setVolume(
      volumeDrag.volume +
        (event.clientX - volumeDrag.x - event.clientY + volumeDrag.y) / 2,
    );
  });
  const endVolumeDrag = (event) => {
    if (volumeDrag?.id !== event.pointerId) return;
    volumeDrag = undefined;
    if (knob.hasPointerCapture(event.pointerId))
      knob.releasePointerCapture(event.pointerId);
  };
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    knob.addEventListener(event, endVolumeDrag);
  // SDL consumes keyboard events on window. Handle this control first so
  // adjusting volume does not send arrow keys into the running game.
  window.addEventListener("keydown", (event) => {
    if (event.target !== knob) return;
    const values = {
      ArrowUp: InfernoAudio.volume + 5,
      ArrowRight: InfernoAudio.volume + 5,
      ArrowDown: InfernoAudio.volume - 5,
      ArrowLeft: InfernoAudio.volume - 5,
      PageUp: InfernoAudio.volume + 10,
      PageDown: InfernoAudio.volume - 10,
      Home: 0,
      End: 100,
    };
    if (!(event.key in values)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    InfernoAudio.setVolume(values[event.key]);
    InfernoAudio.resume();
  }, true);
  window.addEventListener("inferno:audio", render);
  $("canvas").addEventListener("pointerdown", () => {
    $("canvas").focus({ preventScroll: true });
    InfernoAudio.resume();
  });
  $("canvas").addEventListener("contextmenu", (event) =>
    event.preventDefault(),
  );
  // A short browser click can begin and end between two emulated game polls.
  // Keep the press observable for one slow frame without changing drag gestures.
  const presses = new Map();
  const releases = new Map();
  const delayed = new WeakSet();
  window.addEventListener(
    "mousedown",
    (event) => {
      if (event.target !== $("canvas")) return;
      const release = releases.get(event.button);
      if (release) {
        clearTimeout(release.timer);
        release.send();
      }
      presses.set(event.button, performance.now());
    },
    true,
  );
  window.addEventListener(
    "mouseup",
    (event) => {
      if (delayed.has(event) || !presses.has(event.button)) return;
      const remaining = 250 - (performance.now() - presses.get(event.button));
      presses.delete(event.button);
      if (remaining <= 0) return;
      event.stopImmediatePropagation();
      const target = event.target;
      const send = () => {
        releases.delete(event.button);
        const up = new MouseEvent("mouseup", {
          bubbles: true,
          clientX: event.clientX,
          clientY: event.clientY,
          button: event.button,
          buttons: event.buttons,
        });
        delayed.add(up);
        target.dispatchEvent(up);
      };
      releases.set(event.button, { send, timer: setTimeout(send, remaining) });
    },
    true,
  );
  $("fullscreen-button").addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.querySelector(".player").requestFullscreen();
    } catch (error) {
      log(t("fullscreenFailed", { error: error.message }));
    }
  });
  document.addEventListener("fullscreenchange", render);
  window.addEventListener("inferno:language", render);
  $("help-button").addEventListener("click", () => {
    const open = $("help").hidden;
    $("help").hidden = !open;
    $("help-button").setAttribute("aria-expanded", String(open));
    if (open)
      $("help").scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  $("download-log").addEventListener("click", () => {
    const url = URL.createObjectURL(
      new Blob(
        [$("diagnostic-status").textContent + "\n\n" + logLines.join("\n")],
        { type: "text/plain;charset=utf-8" },
      ),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "little-inferno.log";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  window.addEventListener("error", (event) => {
    if (phase === "loading" || phase === "running")
      fail("unexpected", event.message);
  });
  window.addEventListener("unhandledrejection", (event) => {
    if (phase === "loading" || phase === "running")
      fail("unexpected", event.reason);
  });
  render();
})();
