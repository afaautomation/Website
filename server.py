import http.server
import socketserver
import os
import sys

PORT = 8000
if len(sys.argv) > 1:
    try:
        PORT = int(sys.argv[1])
    except ValueError:
        pass

class CleanURLHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        translated = super().translate_path(path)
        clean_file_path = translated.split('?')[0].split('#')[0]
        if not os.path.exists(clean_file_path) and not clean_file_path.endswith('.html'):
            html_candidate = clean_file_path + '.html'
            if os.path.exists(html_candidate):
                return html_candidate
        return translated

if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(("", PORT), CleanURLHTTPRequestHandler) as httpd:
            print(f"Server started at http://localhost:{PORT} (Supports clean URLs & .html)")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
