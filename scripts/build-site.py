"""Produce a static Netlify or GitHub Pages folder with verified archives."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import urllib.request
import zipfile

from runtime_assets import ROOT, SOURCE, ensure_runtime, sha256

PART_SIZE = 8 * 1024 * 1024
FILES = (
    "index.html", "boxedwine.html", "i18n.js", "audio.js", "player.js", "player.css",
    "asset-loader.js", "runtime.js", "webgl-compat.js", "manifest.webmanifest",
    "boxedwine.js", "boxedwine.wasm", "_headers", "netlify.toml",
)
REQUIRED_GAME = {"Little Inferno.exe", "resource.pak", "embed.pak", "frontend.pak"}


def game_archive(expected_sha=None):
    path = Path(os.environ.get("LITTLE_INFERNO_GAME_ZIP", str(ROOT / "local/littleinferno.zip"))).resolve()
    if not path.is_file():
        url = os.environ.get("LITTLE_INFERNO_GAME_URL")
        if not url:
            raise ValueError("Missing local/littleinferno.zip. Copy your game ZIP there, or set LITTLE_INFERNO_GAME_ZIP / LITTLE_INFERNO_GAME_URL.")
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(".download")
        try:
            print("Downloading the configured game archive…", flush=True)
            with urllib.request.urlopen(url, timeout=120) as response, temporary.open("wb") as file:
                shutil.copyfileobj(response, file)
            temporary.replace(path)
        finally:
            temporary.unlink(missing_ok=True)
    expected = os.environ.get("LITTLE_INFERNO_GAME_SHA256") or expected_sha
    if expected and sha256(path) != expected.lower():
        raise ValueError("Game archive SHA-256 mismatch.")
    with zipfile.ZipFile(path) as archive:
        missing = REQUIRED_GAME - set(archive.namelist())
        if missing:
            raise ValueError("Game ZIP is missing: " + ", ".join(sorted(missing)))
    return path


def split_archive(path, directory, name):
    parts = []
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as source:
        for number, block in enumerate(iter(lambda: source.read(PART_SIZE), b"")):
            checksum = hashlib.sha256(block).hexdigest()
            filename = f"{name}-{number:03d}-{checksum[:16]}.part"
            (directory / "bundles" / filename).write_bytes(block)
            digest.update(block)
            size += len(block)
            parts.append({"path": "bundles/" + filename, "size": len(block), "sha256": checksum})
    return {"name": path.name, "size": size, "sha256": digest.hexdigest(), "parts": parts}


def build(target="netlify"):
    ensure_runtime()
    github = target == "github-pages"
    game_config = json.loads((ROOT / "scripts/github-game.json").read_text()) if github else {}
    game = game_archive(game_config.get("sha256"))
    destination = ROOT / "dist" / target
    destination.parent.mkdir(exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=f".{target}-build-", dir=destination.parent))
    try:
        for name in FILES:
            if github and name in ("_headers", "netlify.toml"):
                continue
            shutil.copyfile(SOURCE / name, stage / name)
        if github:
            for name in ("isolation.js", "coi-serviceworker.js"):
                shutil.copyfile(SOURCE / name, stage / name)
            index = stage / "index.html"
            original = index.read_text()
            anchor = '<script src="i18n.js" defer></script>'
            if original.count(anchor) != 1:
                raise ValueError("Expected one translation script in the launcher.")
            index.write_text(original.replace(anchor, '<script src="isolation.js" defer></script>\n    ' + anchor))
            (stage / ".nojekyll").write_text("")
        for name in ("assets", "manifests", "third-party"):
            shutil.copytree(SOURCE / name, stage / name)
        (stage / "bundles").mkdir()
        manifest = {"version": 1, "archives": {
            "littleinferno.zip": split_archive(game, stage, "game"),
            "boxedwine.zip": split_archive(SOURCE / "boxedwine.zip", stage, "wine"),
        }}
        (stage / "assets-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
        files = [p for p in stage.rglob("*") if p.is_file()]
        if any(p.stat().st_size > PART_SIZE for p in files):
            raise ValueError("A deployment file exceeds the 8 MiB packaging limit.")
        if destination.exists():
            shutil.rmtree(destination)
        stage.replace(destination)
        print(f"Ready: {destination}")
        print(f"{len(files)} files; {sum(p.stat().st_size for p in destination.rglob('*') if p.is_file()) / 1024**2:.1f} MiB; no file above 8 MiB.")
    finally:
        if stage.exists():
            shutil.rmtree(stage)


if __name__ == "__main__":
    try:
        parser = argparse.ArgumentParser(description=__doc__)
        parser.add_argument("--target", choices=("netlify", "github-pages"), default="netlify")
        build(parser.parse_args().target)
    except (OSError, ValueError, zipfile.BadZipFile) as error:
        print(f"Build failed: {error}", file=sys.stderr)
        sys.exit(1)
