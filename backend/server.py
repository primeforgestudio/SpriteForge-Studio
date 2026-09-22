import os
import sys
import json
import re
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import numpy as np
import cv2

try:
    import av
except ImportError:
    av = None


class VideoEngine:
    """Высокоскоростное ядро декодирования видео на PyAV (C FFmpeg) и OpenCV."""

    def __init__(self):
        self.container = None
        self.stream = None
        self.file_path = None
        self.width = 0
        self.height = 0
        self.duration = 0.0
        self.fps = 30.0
        self.total_frames = 0
        self._frame_cache = {}

    def close(self):
        if self.container:
            try:
                self.container.close()
            except Exception:
                pass
            self.container = None
        self.stream = None
        self._frame_cache.clear()

    def load_video(self, path: str):
        self.close()
        self.file_path = path

        if not av:
            return {"error": "PyAV is not installed"}

        try:
            self.container = av.open(path, metadata_errors='ignore')
            self.stream = self.container.streams.video[0]
            self.stream.thread_type = 'AUTO'

            self.width = self.stream.width
            self.height = self.stream.height
            if self.stream.duration:
                self.duration = float(self.stream.duration * self.stream.time_base)
            else:
                self.duration = 0.0

            self.fps = float(self.stream.average_rate) if self.stream.average_rate else 30.0
            if self.stream.frames > 0:
                self.total_frames = self.stream.frames
            else:
                self.total_frames = max(1, int(self.duration * self.fps))

            self._frame_cache = {}
            return {
                "success": True,
                "filename": os.path.basename(path),
                "width": self.width,
                "height": self.height,
                "duration": self.duration,
                "fps": self.fps,
                "totalFrames": self.total_frames,
            }
        except Exception as e:
            return {"error": str(e)}

    def get_frame_bgr(self, frame_index: int):
        if not self.container or not self.stream:
            return None

        frame_index = max(0, min(self.total_frames - 1, frame_index))
        if frame_index in self._frame_cache:
            return self._frame_cache[frame_index]

        try:
            target_pts = int(frame_index / self.fps / self.stream.time_base)
            self.container.seek(target_pts, stream=self.stream, any_frame=False, backward=True)

            best_img = None
            best_idx = -1

            for packet in self.container.demux(self.stream):
                if packet.dts is None:
                    continue
                for frame in packet.decode():
                    if frame.pts is None:
                        continue
                    current_time = frame.pts * self.stream.time_base
                    current_idx = int(round(current_time * self.fps))

                    # Конвертация в BGR
                    bgr = frame.to_ndarray(format='bgr24')
                    self._frame_cache[current_idx] = bgr

                    if current_idx == frame_index:
                        return bgr

                    if best_img is None or abs(current_idx - frame_index) < abs(best_idx - frame_index):
                        best_img = bgr
                        best_idx = current_idx

                    if current_idx > frame_index + 20:
                        break

            if best_img is not None and abs(best_idx - frame_index) <= 3:
                self._frame_cache[frame_index] = best_img
                return best_img

        except Exception as e:
            print(f"[VideoEngine] Seek error: {e}", file=sys.stderr)

        return None


engine = VideoEngine()


class SpriteForgeRequestHandler(BaseHTTPRequestHandler):
    def _send_cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        if parsed.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self._send_cors()
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "app": "SpriteForge Studio", "engine": "PyAV"}).encode('utf-8'))
            return

        if parsed.path == '/api/frame':
            frame_idx = int(params.get('frame', ['0'])[0])
            bgr = engine.get_frame_bgr(frame_idx)
            if bgr is None:
                self.send_response(404)
                self._send_cors()
                self.end_headers()
                return

            # Кодирование в JPEG с качеством 92
            _, buf = cv2.imencode('.jpg', bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
            self.send_response(200)
            self.send_header('Content-Type', 'image/jpeg')
            self.send_header('Cache-Control', 'public, max-age=3600')
            self._send_cors()
            self.end_headers()
            self.wfile.write(buf.tobytes())
            return

        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        content_len = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_len) if content_len > 0 else b'{}'

        try:
            body = json.loads(post_data.decode('utf-8'))
        except Exception:
            body = {}

        if parsed.path == '/api/load_video':
            path = body.get('path', '')
            res = engine.load_video(path)
            self.send_response(200 if 'success' in res else 400)
            self.send_header('Content-Type', 'application/json')
            self._send_cors()
            self.end_headers()
            self.wfile.write(json.dumps(res).encode('utf-8'))
            return

        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        # Отключаем спам в терминале
        pass


def run_server(port=49221):
    server_address = ('127.0.0.1', port)
    httpd = HTTPServer(server_address, SpriteForgeRequestHandler)
    print(f"[SpriteForge Backend] Running on http://127.0.0.1:{port}", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 49221
    run_server(port)
