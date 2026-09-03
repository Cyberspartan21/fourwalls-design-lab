#!/usr/bin/env python3
"""QA-Server: UTF-8-Charset + Viewport-Meta-Injection für HTML (bildet das Artifact-Skeleton nach)."""
import http.server, functools, sys, os

PRELUDE = b'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.translate_path(self.path.split("?")[0].split("#")[0])
        if path.endswith(".html") and os.path.isfile(path):
            with open(path, "rb") as f:
                body = PRELUDE + f.read() + b"</body></html>"
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8737
http.server.ThreadingHTTPServer(("127.0.0.1", port),
    functools.partial(Handler, directory=root)).serve_forever()
