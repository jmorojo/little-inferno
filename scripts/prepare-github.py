"""Export this committed branch without Git history and stage its release asset."""
import argparse
import io
import json
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile

from runtime_assets import ROOT, sha256


def prepare():
    if subprocess.check_output(["git", "status", "--porcelain"], cwd=ROOT).strip():
        raise ValueError("Commit the branch changes before exporting the GitHub source snapshot.")
    metadata = json.loads((ROOT / "scripts/github-game.json").read_text())
    game = ROOT / "local" / metadata["asset"]
    if not game.is_file() or game.stat().st_size != metadata["size"] or sha256(game) != metadata["sha256"]:
        raise ValueError("The local game ZIP does not match scripts/github-game.json.")
    commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    archive = subprocess.check_output(["git", "archive", "--format=tar", commit], cwd=ROOT)
    destination = ROOT / "dist/github"
    destination.parent.mkdir(exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=".github-prepare-", dir=destination.parent))
    try:
        source = stage / "source"
        source.mkdir()
        with tarfile.open(fileobj=io.BytesIO(archive)) as files:
            files.extractall(source, filter="data")
        if any(p.is_symlink() or (p.is_file() and p.stat().st_size > 10 * 1024 * 1024) for p in source.rglob("*")):
            raise ValueError("The source snapshot contains a symlink or an unexpected large file.")
        releases = stage / "release-assets"
        releases.mkdir()
        shutil.copyfile(game, releases / metadata["asset"])
        (releases / "littleinferno.zip.sha256").write_text(f'{metadata["sha256"]}  {metadata["asset"]}\n')
        (stage / "preparation.json").write_text(json.dumps({"sourceCommit": commit, "game": metadata}, indent=2) + "\n")
        if destination.exists():
            shutil.rmtree(destination)
        stage.replace(destination)
    finally:
        if stage.exists():
            shutil.rmtree(stage)
    print(f"GitHub source: {destination / 'source'} (no .git or historical binaries)")
    print(f"Release assets: {destination / 'release-assets'}")
    print(f"Source commit: {commit}")


if __name__ == "__main__":
    try:
        argparse.ArgumentParser(description=__doc__).parse_args()
        prepare()
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        raise SystemExit(str(error))
