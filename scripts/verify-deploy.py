"""Audit only the deploy allowlist and verify every packed archive byte."""
import hashlib
import argparse
import json
from pathlib import Path
import sys

from runtime_assets import ROOT, SOURCE, HASHES


def verify(target="netlify"):
    github = target == "github-pages"
    folder = ROOT / "dist" / target
    manifest = json.loads((folder / "assets-manifest.json").read_text())
    assert manifest["version"] == 1
    assert set(manifest["archives"]) == {"littleinferno.zip", "boxedwine.zip"}
    allowed = {
        "index.html", "boxedwine.html", "i18n.js", "audio.js", "player.js", "player.css",
        "asset-loader.js", "runtime.js", "webgl-compat.js", "manifest.webmanifest",
        "boxedwine.js", "boxedwine.wasm", "_headers", "netlify.toml", "assets-manifest.json",
    }
    if github:
        allowed.difference_update({"_headers", "netlify.toml"})
        allowed.update({".nojekyll", "isolation.js", "coi-serviceworker.js"})
        assert (folder / ".nojekyll").read_bytes() == b""
    for directory in ("assets", "manifests", "third-party"):
        allowed.update(str(p.relative_to(SOURCE)) for p in (SOURCE / directory).rglob("*") if p.is_file())
    for name, archive in manifest["archives"].items():
        digest = hashlib.sha256()
        size = 0
        for part in archive["parts"]:
            path = folder / part["path"]
            assert path.parent == folder / "bundles"
            data = path.read_bytes()
            assert len(data) == part["size"]
            assert hashlib.sha256(data).hexdigest() == part["sha256"]
            size += len(data)
            digest.update(data)
            allowed.add(part["path"])
        assert size == archive["size"]
        assert digest.hexdigest() == archive["sha256"]
        if name == "boxedwine.zip":
            assert digest.hexdigest() == HASHES[name]
    actual = {str(p.relative_to(folder)) for p in folder.rglob("*") if p.is_file()}
    assert actual == allowed, f"Unexpected/missing files: {actual ^ allowed}"
    assert all((folder / p).stat().st_size <= 8 * 1024 * 1024 for p in actual)
    for name in ("boxedwine.js", "boxedwine.wasm"):
        assert hashlib.sha256((folder / name).read_bytes()).hexdigest() == HASHES[name]
    for path in actual - {p for p in actual if p.startswith("bundles/")} - {"boxedwine.js", "boxedwine.wasm"}:
        if (SOURCE / path).is_file():
            expected = (SOURCE / path).read_bytes()
            if github and path == "index.html":
                expected = expected.replace(b'<script src="i18n.js" defer></script>', b'<script src="isolation.js" defer></script>\n    <script src="i18n.js" defer></script>')
            assert (folder / path).read_bytes() == expected, f"Stale deployment file: {path}"
    print(f"Verified: {len(actual)} allowlisted files, original archive hashes, no file above 8 MiB; source matches build.")


if __name__ == "__main__":
    try:
        parser = argparse.ArgumentParser(description=__doc__)
        parser.add_argument("--target", choices=("netlify", "github-pages"), default="netlify")
        verify(parser.parse_args().target)
    except (AssertionError, OSError, ValueError, KeyError) as error:
        print(f"Deployment verification failed: {error}", file=sys.stderr)
        sys.exit(1)
