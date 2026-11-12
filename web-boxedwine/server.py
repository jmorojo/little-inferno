"""Static server for the source launcher or a prepared Netlify folder."""
import argparse
import functools
import http.server
from pathlib import Path
from urllib.parse import urlsplit

SOURCE = Path(__file__).resolve().parent


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".wasm": "application/wasm", ".webmanifest": "application/manifest+json",
        ".part": "application/octet-stream",
    }

    def __init__(self, *args, base_path="/", isolation_headers=True, **kwargs):
        self.base_path = base_path
        self.isolation_headers = isolation_headers
        super().__init__(*args, **kwargs)

    def send_head(self):
        path = urlsplit(self.path)
        if self.base_path != "/" and path.path == self.base_path.rstrip("/"):
            self.send_response(301)
            self.send_header("Location", self.base_path + ("?" + path.query if path.query else ""))
            self.end_headers()
            return None
        if not path.path.startswith(self.base_path):
            self.send_error(404)
            return None
        return super().send_head()

    def translate_path(self, path):
        path = path[len(self.base_path) - 1:]
        translated = super().translate_path(path)
        # The original game stays local and is never a tracked source file.
        if Path(self.directory).resolve() == SOURCE and urlsplit(path).path == "/littleinferno.zip" and not Path(translated).is_file():
            return str(SOURCE.parent / "local/littleinferno.zip")
        return translated

    def end_headers(self):
        if self.isolation_headers:
            self.send_header("Cross-Origin-Opener-Policy", "same-origin")
            self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "public, max-age=31536000, immutable" if urlsplit(self.path).path.startswith("/bundles/") else "no-cache")
        super().end_headers()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8088)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--directory", type=Path, default=SOURCE)
    parser.add_argument("--base-path", default="/", help="Mount below a project path, such as /little-inferno/.")
    parser.add_argument("--no-isolation-headers", action="store_true", help="Emulate GitHub Pages; let the service worker supply COOP/COEP.")
    args = parser.parse_args()
    base_path = "/" + args.base_path.strip("/") + "/" if args.base_path.strip("/") else "/"
    if any(segment == ".." for segment in base_path.split("/")) or any(c in base_path for c in "?#"):
        parser.error("Invalid base path.")
    handler = functools.partial(Handler, directory=str(args.directory.resolve()), base_path=base_path,
                                isolation_headers=not args.no_isolation_headers)
    with http.server.ThreadingHTTPServer((args.host, args.port), handler) as server:
        print(f"Little Inferno: http://{args.host}:{args.port}{base_path}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
