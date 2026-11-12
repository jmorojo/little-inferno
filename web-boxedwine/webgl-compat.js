/* BoxedWine WebGL buffer padding workaround. GPL-2.0-or-later.
 * Padding source: master 9905baab, project/emscripten/boxedwine-shell.js.
 * The graphics preference wrapper is maintained by this launcher. */
(function () {
  // Apply before the capability probe and Wine's temporary contexts as well as
  // the visible canvas. The browser/OS can still override this preference.
  for (const prototype of [
    window.HTMLCanvasElement?.prototype,
    window.OffscreenCanvas?.prototype,
  ]) {
    if (!prototype) continue;
    const getContext = prototype.getContext;
    prototype.getContext = function (type, attributes) {
      return getContext.call(
        this,
        type,
        /^(webgl2?|experimental-webgl)$/.test(type)
          ? { ...attributes, powerPreference: "high-performance" }
          : attributes,
      );
    };
  }
  function patchBufferData(contextPrototype) {
    if (!contextPrototype || contextPrototype.__boxedwineBufferDataPadding) {
      return;
    }
    contextPrototype.__boxedwineBufferDataPadding = true;
    function copyBytes(src, srcOffset, length) {
      if (!src) {
        return null;
      }
      var bytes = null;
      if (src instanceof ArrayBuffer) {
        bytes = new Uint8Array(src);
      } else if (ArrayBuffer.isView(src)) {
        bytes = new Uint8Array(src.buffer, src.byteOffset, src.byteLength);
      } else if (typeof src.length === "number") {
        bytes = Uint8Array.from(src);
      }
      if (!bytes) {
        return null;
      }
      var start = srcOffset || 0;
      var end = typeof length === "number" ? start + length : bytes.length;
      return new Uint8Array(bytes.slice(start, end));
    }
    var originalBufferData = contextPrototype.bufferData;
    contextPrototype.bufferData = function (
      target,
      srcOrSize,
      usage,
      srcOffset,
      length,
    ) {
      if (
        arguments.length === 5 &&
        target === this.ARRAY_BUFFER &&
        srcOrSize &&
        typeof srcOffset === "number" &&
        typeof length === "number"
      ) {
        var extraPadding = 256;
        var paddedLength = length + extraPadding;
        var padded = new Uint8Array(paddedLength);
        var sourceBytes = copyBytes(srcOrSize, srcOffset, length);
        if (sourceBytes) {
          padded.set(sourceBytes);
        }
        return originalBufferData.call(this, target, padded, usage);
      }
      if (
        arguments.length === 3 &&
        target === this.ARRAY_BUFFER &&
        srcOrSize &&
        typeof srcOrSize !== "number"
      ) {
        var sourceData = copyBytes(srcOrSize);
        if (sourceData) {
          var viewPadding = 256;
          var paddedView = new Uint8Array(sourceData.length + viewPadding);
          paddedView.set(sourceData);
          return originalBufferData.call(this, target, paddedView, usage);
        }
      }
      if (
        arguments.length === 3 &&
        target === this.ARRAY_BUFFER &&
        typeof srcOrSize === "number" &&
        srcOrSize > 0
      ) {
        var numericPadding = 256;
        return originalBufferData.call(
          this,
          target,
          srcOrSize + numericPadding,
          usage,
        );
      }
      return originalBufferData.apply(this, arguments);
    };
  }
  patchBufferData(
    window.WebGLRenderingContext && window.WebGLRenderingContext.prototype,
  );
  patchBufferData(
    window.WebGL2RenderingContext && window.WebGL2RenderingContext.prototype,
  );
})();
