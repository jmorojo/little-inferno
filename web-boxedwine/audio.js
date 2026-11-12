(() => {
  "use strict";
  const key = "little-inferno.audio";
  let volume = 100,
    muted = false,
    lastVolume = 100;
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && Number.isFinite(saved.volume))
      volume = Math.round(Math.max(0, Math.min(100, saved.volume)));
    if (typeof saved?.muted === "boolean") muted = saved.muted;
    if (Number.isFinite(saved?.lastVolume) && saved.lastVolume > 0)
      lastVolume = Math.max(1, Math.round(Math.min(100, saved.lastVolume)));
  } catch {}

  const outputs = new Map();
  const level = () => (muted ? 0 : volume / 100);
  const connect = window.AudioNode?.prototype.connect;
  const disconnect = window.AudioNode?.prototype.disconnect;

  function output(context) {
    if (outputs.has(context)) return outputs.get(context);
    const gain = context.createGain();
    // Set the level before connecting anything: a context created while muted
    // must never send its first samples to the speakers at full volume.
    gain.gain.value = level();
    connect.call(gain, context.destination);
    outputs.set(context, gain);
    context.addEventListener("statechange", () => {
      if (context.state === "closed") outputs.delete(context);
    });
    return gain;
  }

  if (connect && disconnect) {
    // BoxedWine's worklet and SDL both connect directly to the destination.
    // Route every such connection, including later devices, through one mixer.
    AudioNode.prototype.connect = function (destination, ...args) {
      if (
        destination === this.context.destination &&
        outputs.get(this.context) !== this
      ) {
        connect.call(this, output(this.context), ...args);
        return destination;
      }
      return connect.call(this, destination, ...args);
    };
    AudioNode.prototype.disconnect = function (destination, ...args) {
      if (
        destination === this.context.destination &&
        outputs.has(this.context) &&
        outputs.get(this.context) !== this
      )
        return disconnect.call(this, outputs.get(this.context), ...args);
      return disconnect.apply(this, arguments);
    };
  }

  function update() {
    for (const [context, gain] of outputs) {
      if (context.state === "closed") {
        outputs.delete(context);
        continue;
      }
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      // Muting is immediate, even if the engine resumes a suspended context.
      gain.gain.setValueAtTime(level(), now);
    }
    try {
      localStorage.setItem(key, JSON.stringify({ volume, muted, lastVolume }));
    } catch {}
    window.dispatchEvent(new Event("inferno:audio"));
  }

  window.InfernoAudio = {
    get volume() {
      return volume;
    },
    get muted() {
      return muted || volume === 0;
    },
    setVolume(value) {
      if (!Number.isFinite(value)) return;
      const next = Math.round(Math.max(0, Math.min(100, value)));
      if (next === volume && muted === (next === 0)) return;
      volume = next;
      muted = volume === 0;
      if (volume > 0) lastVolume = volume;
      update();
    },
    toggleMute() {
      if (muted || volume === 0) {
        muted = false;
        if (volume === 0) volume = lastVolume;
      } else muted = true;
      update();
    },
    resume() {
      for (const context of outputs.keys())
        if (context.state === "suspended") context.resume().catch(() => {});
    },
  };
})();
