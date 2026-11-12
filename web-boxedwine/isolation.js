// GitHub Pages cannot set COOP/COEP response headers. The worker adds them
// within this project's directory, before the emulator or its audio is loaded.
(() => {
  "use strict";
  const workerURL = new URL("coi-serviceworker.js", document.currentScript.src);
  const marker = `little-inferno.isolation:${workerURL.pathname}`;

  function activate(registration) {
    return new Promise((resolve) => {
      const workers = new Set();
      const timer = setTimeout(() => finish(false), 10000);
      function finish(value) {
        clearTimeout(timer);
        registration.removeEventListener("updatefound", watch);
        for (const worker of workers) worker.removeEventListener("statechange", watch);
        resolve(value);
      }
      function watch() {
        if (registration.active?.state === "activated") return finish(true);
        const worker = registration.installing || registration.waiting;
        if (worker && !workers.has(worker)) {
          workers.add(worker);
          worker.addEventListener("statechange", watch);
        }
      }
      registration.addEventListener("updatefound", watch);
      watch();
    });
  }

  window.InfernoIsolation = {
    ready: (async () => {
      if (window.crossOriginIsolated) {
        try { sessionStorage.removeItem(marker); } catch {}
        return true;
      }
      if (!window.isSecureContext || !navigator.serviceWorker) return false;
      let registrationTimer;
      try {
        const registration = await Promise.race([
          navigator.serviceWorker.register(workerURL.href, { updateViaCache: "none" }),
          new Promise(resolve => { registrationTimer = setTimeout(() => resolve(null), 10000); }),
        ]);
        clearTimeout(registrationTimer);
        if (!registration) return false;
        if (!(await activate(registration))) return false;
        if (sessionStorage.getItem(marker)) return false;
        sessionStorage.setItem(marker, "1");
        location.reload();
        return new Promise(() => {});
      } catch (error) {
        console.warn("Could not prepare browser isolation:", error);
        return false;
      } finally {
        clearTimeout(registrationTimer);
      }
    })(),
  };
})();
