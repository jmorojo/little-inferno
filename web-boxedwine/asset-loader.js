/* Read ordinary local ZIPs or the verified, bounded files in a deploy bundle. */
(() => {
  "use strict";
  let manifestPromise;
  const error = (key, vars) => I18n.error(key, vars);
  async function manifest() {
    if (!manifestPromise)
      manifestPromise = (async () => {
        const response = await fetch("assets-manifest.json", {
          cache: "no-cache",
        });
        if (response.status === 404) return null; // Source checkout: ordinary local ZIPs.
        if (!response.ok)
          throw error("httpError", {
            file: "assets-manifest.json",
            status: response.status,
          });
        let data;
        try {
          data = await response.json();
        } catch {
          throw error("manifestInvalid");
        }
        if (
          data.version !== 1 ||
          !data.archives ||
          typeof data.archives !== "object"
        )
          throw error("manifestInvalid");
        return data;
      })();
    return manifestPromise;
  }
  async function digest(bytes) {
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(hash)]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
  }
  function validateDescriptor(value) {
    if (
      !Number.isSafeInteger(value?.size) ||
      value.size <= 0 ||
      value.size > 1024 * 1024 * 1024 ||
      !/^[a-f0-9]{64}$/.test(value.sha256) ||
      !Array.isArray(value.parts) ||
      !value.parts.length
    )
      throw error("manifestInvalid");
    let size = 0;
    for (const part of value.parts) {
      if (
        !/^bundles\/[a-zA-Z0-9._-]+\.part$/.test(part.path) ||
        !Number.isSafeInteger(part.size) ||
        part.size <= 0 ||
        part.size > 8 * 1024 * 1024 ||
        !/^[a-f0-9]{64}$/.test(part.sha256)
      )
        throw error("manifestInvalid");
      size += part.size;
    }
    if (size !== value.size) throw error("manifestInvalid");
  }
  async function downloadParts(value, label) {
    validateDescriptor(value);
    const bytes = new Uint8Array(value.size);
    let offset = 0;
    for (const part of value.parts) {
      const response = await fetch(part.path);
      if (!response.ok)
        throw error("httpError", { file: part.path, status: response.status });
      const reader = response.body?.getReader();
      const start = offset;
      if (reader) {
        while (true) {
          const { done, value: chunk } = await reader.read();
          if (done) break;
          if (offset + chunk.length > start + part.size) {
            await reader.cancel();
            throw error("partSize", { file: part.path });
          }
          bytes.set(chunk, offset);
          offset += chunk.length;
          Inferno.progress(label, offset, value.size);
        }
      } else {
        const chunk = new Uint8Array(await response.arrayBuffer());
        if (chunk.length !== part.size)
          throw error("partSize", { file: part.path });
        bytes.set(chunk, offset);
        offset += chunk.length;
        Inferno.progress(label, offset, value.size);
      }
      if (offset - start !== part.size)
        throw error("partSize", { file: part.path });
      if ((await digest(bytes.subarray(start, offset))) !== part.sha256)
        throw error("checksum", { file: part.path });
    }
    if ((await digest(bytes)) !== value.sha256)
      throw error("checksum", { file: value.name });
    return bytes;
  }
  async function downloadFile(path, label) {
    const response = await fetch(path);
    if (!response.ok)
      throw error("httpError", { file: path, status: response.status });
    const total = response.headers.has("Content-Encoding")
      ? 0
      : Number(response.headers.get("Content-Length")) || 0;
    const reader = response.body?.getReader();
    if (!reader) return new Uint8Array(await response.arrayBuffer());
    let bytes = total ? new Uint8Array(total) : null,
      loaded = 0;
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (bytes && loaded + value.length <= bytes.length)
        bytes.set(value, loaded);
      else {
        if (bytes) {
          chunks.push(bytes.subarray(0, loaded));
          bytes = null;
        }
        chunks.push(value);
      }
      loaded += value.length;
      Inferno.progress(label, loaded, total);
    }
    if (bytes) return bytes.subarray(0, loaded);
    bytes = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return bytes;
  }
  window.InfernoAssets = {
    async download(path, label) {
      const index = await manifest();
      if (index && !Object.hasOwn(index.archives, path))
        throw error("manifestInvalid");
      const bytes = index
        ? await downloadParts(index.archives[path], label)
        : await downloadFile(path, label);
      Inferno.status("loadingAsset", { file: path });
      return bytes;
    },
  };
})();
