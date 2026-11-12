"""The mirror must preserve pinned bytes and never hide integrity failures."""
import hashlib
import io
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
import urllib.error

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
from runtime_assets import download


class RuntimeDownloadTests(unittest.TestCase):
    def test_missing_upstream_uses_verified_mirror(self):
        data = b"pinned runtime fixture"
        expected = hashlib.sha256(data).hexdigest()
        missing = urllib.error.HTTPError("https://upstream.invalid", 404, "Not Found", {}, None)
        with patch("urllib.request.urlopen", side_effect=[missing, io.BytesIO(data)]) as fetch:
            self.assertEqual(download("https://upstream.invalid", expected, ["https://mirror.invalid"]), data)
        self.assertEqual([call.args[0].full_url for call in fetch.call_args_list], ["https://upstream.invalid", "https://mirror.invalid"])

    def test_integrity_failure_does_not_try_another_source(self):
        expected = hashlib.sha256(b"correct runtime").hexdigest()
        with patch("urllib.request.urlopen", return_value=io.BytesIO(b"wrong runtime")) as fetch:
            with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
                download("https://upstream.invalid", expected, ["https://mirror.invalid"])
        self.assertEqual(fetch.call_count, 1)

    def test_unavailable_sources_propagate_the_network_error(self):
        with patch("urllib.request.urlopen", side_effect=urllib.error.URLError("unavailable")) as fetch:
            with self.assertRaises(urllib.error.URLError):
                download("https://upstream.invalid", "unused", ["https://mirror.invalid"])
        self.assertEqual(fetch.call_count, 2)


if __name__ == "__main__":
    unittest.main()
