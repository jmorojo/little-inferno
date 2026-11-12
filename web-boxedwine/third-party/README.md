# Runtime provenance

The runtime is based on **BoxedWine master build 125**, `Web/SingleThreadedJit`, built 2026-11-08. `boxedwine.js` is unmodified. `boxedwine.wasm` has the bounded-return lookahead optimization described below. Source revision: [`9905baabdd17154b952548c619372f4890f0e758`](https://github.com/danoon2/Boxedwine/tree/9905baabdd17154b952548c619372f4890f0e758). BoxedWine is GPL-2.0-or-later; see the accompanying license. The source tree contains its dependency licenses and Emscripten build instructions at `project/emscripten/buildInstructions.md`.

- Artifact: https://boxedwine.org/builds/branches/master/builds/125/artifacts/build-125.zip
- Artifact SHA-256: `c943cdeb80c5d160d1adbbfad21ea4e6737211019128e6a90f478e0629e9275e`
- `boxedwine.js`: `59e5bec8604605348ff021bef5cdfbc148c946c468f3ae7918c7ebb85a507ccd`
- Upstream `boxedwine.wasm`: `251d50875af37e4a7b24c7acc4aaa92dc6df728184b91fccd817145ce8455d5e`
- Shipped `boxedwine.wasm`: `b2f133be3a57bad25133114050c6f5d486ed86433bd3b97a0cd73ab8a983ac0c`

The original build archive is also mirrored, without modification, as [`boxedwine-build-125.zip`](https://github.com/jmorojo/little-inferno/releases/download/game-data/boxedwine-build-125.zip). The original Wine filesystem is mirrored as [`boxedwine.zip`](https://github.com/jmorojo/little-inferno/releases/download/game-data/boxedwine.zip). These copies retain the pinned hashes and notices and let setup reproduce the runtime when the upstream build URL expires. The Pages workflow downloads these release assets before building. Local setup falls back to the mirror on a network error and rejects any checksum mismatch.

## Bounded return lookahead

The WASM JIT stops its block search at a real x86 return once it has looked ahead at least 1,024 guest bytes. Conditional branches past that return use the existing side-exit path. This reduces large, overlapping translations and their compilation cost; it does not change guest instructions, floating-point precision, simulation speed or rendering resolution. It is a lookahead policy, not a hard maximum block size: a function without a return can still produce a larger block.

The complete GPL source change and its CPU regression are in [boxedwine-bounded-lookahead.patch](boxedwine-bounded-lookahead.patch). Apply that patch to the pinned source revision to rebuild or run its `testJit` target. The regression checks both paths through a large function, including registers, flags and the x87 stack.

`scripts/boxedwine_patch.py` in this project's repository reproduces the equivalent change directly on the pinned release WASM. It adds 13 instruction bytes to the return predicate inside one function and updates the function/code-section lengths. The upstream module, original function, expected predicate and resulting module are all SHA-256 checked. Function indices, imports, data, ABI and the JavaScript remain unchanged. No SDK is required for normal setup or deployment. An unknown runtime is rejected rather than patched by offset.

The supplied source patch can be tested using the upstream Emscripten instructions, then `make testJit TARGET_EXEC=boxedwine.js` and `node Build/TestJit/boxedwine.js -fast` from `project/emscripten`.

`boxedwine.zip` is the **TinyCore 15 / Wine 11 WebGL filesystem v27**, unmodified. It includes Wine, the WebGL Direct3D DLLs, patches and third-party notices. The matching source/build manifest is `tools/buildWine/webgl_filesystems_v27.json` at the above revision. Wine source and WebGL patches/build instructions are linked from `tools/d3dToWebGL/README.md` in that tree. Keep those notices when redistributing the filesystem.

- Filesystem: https://boxedwine.org/v2/27/TinyCore15Wine11.0-web.zip
- SHA-256: `7f24b945165dfdc71cd86ae8a32927e07c32c072fb24711bad338830d283652c`

Run `python3 scripts/fetch-runtime.py` to reproduce the pinned runtime downloads. No game content is downloaded by that script. Little Inferno and its game assets belong to Tomorrow Corporation.

## GitHub Pages cross-origin isolation

The Pages package includes the unmodified `coi-serviceworker.js` v0.1.7 from [gzuidhof/coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker/tree/7b1d2a092d0d2dd2b7270b6f12f13605de26f214), revision `7b1d2a092d0d2dd2b7270b6f12f13605de26f214`. SHA-256: `e97bbac6017322d48aa54a5bc7ce473c725a4b7376ff245002e0ba71c3dcdd7e`. It is MIT licensed; see [coi-serviceworker-MIT.txt](coi-serviceworker-MIT.txt).

The local `isolation.js` registers that file as a worker under the project directory; it does not execute the dependency's window bootstrap. It waits for activation and limits automatic reloads before starting the emulator. The worker forwards requests with isolation headers and does not cache application/game content. Netlify uses its response headers and does not need the Pages bootstrap.
