"""Pinned BoxedWine downloads and reproducible optimization for packaging."""
import hashlib
import io
import os
from pathlib import Path
import urllib.request
import urllib.error
import zipfile

from boxedwine_patch import UPSTREAM_SHA, PATCHED_SHA, patch_engine

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "web-boxedwine"
ARTIFACT_URL = "https://boxedwine.org/builds/branches/master/builds/125/artifacts/build-125.zip"
ARTIFACT_SHA = "c943cdeb80c5d160d1adbbfad21ea4e6737211019128e6a90f478e0629e9275e"
SYSTEM_URL = "https://boxedwine.org/v2/27/TinyCore15Wine11.0-web.zip"
MIRROR = os.environ.get("BOXEDWINE_RUNTIME_MIRROR", "https://github.com/jmorojo/little-inferno/releases/download/game-data").rstrip("/")
HASHES = {
    "boxedwine.js": "59e5bec8604605348ff021bef5cdfbc148c946c468f3ae7918c7ebb85a507ccd",
    "boxedwine.wasm": PATCHED_SHA,
    "boxedwine.zip": "7f24b945165dfdc71cd86ae8a32927e07c32c072fb24711bad338830d283652c",
}


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as file:
        for block in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def valid(name):
    path = SOURCE / name
    return path.is_file() and sha256(path) == HASHES[name]


def download(url, expected, mirrors=()):
    for index, source in enumerate((url, *mirrors)):
        request = urllib.request.Request(source, headers={"User-Agent": "little-inferno-web-setup"})
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                data = response.read()
        except (urllib.error.URLError, TimeoutError):
            if index == len(mirrors):
                raise
            print("Runtime source unavailable; trying the pinned mirror…", flush=True)
            continue
        if hashlib.sha256(data).hexdigest() != expected:
            raise ValueError("Runtime SHA-256 mismatch; downloaded files were not installed.")
        return data


def runtime_artifact():
    archive = ROOT / "local/boxedwine-build-125.zip"
    if not archive.is_file() or sha256(archive) != ARTIFACT_SHA:
        data = download(ARTIFACT_URL, ARTIFACT_SHA, [MIRROR + "/boxedwine-build-125.zip"])
        archive.parent.mkdir(exist_ok=True)
        archive.write_bytes(data)
    return archive


def ensure_runtime():
    SOURCE.mkdir(exist_ok=True)
    wasm = SOURCE / "boxedwine.wasm"
    if wasm.is_file() and sha256(wasm) == UPSTREAM_SHA:
        wasm.write_bytes(patch_engine(wasm.read_bytes()))
    if not all(valid(name) for name in ("boxedwine.js", "boxedwine.wasm")):
        print("Downloading and verifying BoxedWine build 125…", flush=True)
        artifact = runtime_artifact().read_bytes()
        with zipfile.ZipFile(io.BytesIO(artifact)) as archive:
            for name in ("boxedwine.js", "boxedwine.wasm"):
                matches = [n for n in archive.namelist() if n.endswith("Web/SingleThreadedJit/" + name)]
                if len(matches) != 1:
                    raise ValueError(f"Expected one SingleThreadedJit/{name}")
                data = archive.read(matches[0])
                expected = UPSTREAM_SHA if name == "boxedwine.wasm" else HASHES[name]
                if hashlib.sha256(data).hexdigest() != expected:
                    raise ValueError(f"Runtime SHA-256 mismatch: {name}")
                if name == "boxedwine.wasm":
                    data = patch_engine(data)
                (SOURCE / name).write_bytes(data)
    if not valid("boxedwine.zip"):
        print("Downloading and verifying Wine 11 WebGL v27…", flush=True)
        (SOURCE / "boxedwine.zip").write_bytes(download(SYSTEM_URL, HASHES["boxedwine.zip"], [MIRROR + "/boxedwine.zip"]))
    print("Verified BoxedWine / Wine runtime ready.", flush=True)
