"""Kirim frame dari kamera CCTV (RTSP) ke server, termasuk langkah scan wajah.

Contoh:
  python cctv_worker.py rtsp://user:pass@192.168.1.10/stream in
  python cctv_worker.py rtsp://user:pass@192.168.1.11/stream out
Butuh: pip install opencv-python-headless requests
"""
import os
import sys
import time

import cv2
import requests

if len(sys.argv) < 3 or sys.argv[2] not in ("in", "out"):
    sys.exit("Pemakaian: python cctv_worker.py <url-rtsp> <in|out>")

SRC, MODE = sys.argv[1], sys.argv[2]
SERVER = os.environ.get("SERVER", "http://127.0.0.1:5000")
AUTH = (os.environ.get("ADMIN_USER", "admin"), os.environ.get("ADMIN_PASS", "admin"))
INTERVAL = float(os.environ.get("INTERVAL", "1.0"))
FACE_TRIES = 12


def jpg(frame):
    return cv2.imencode(".jpg", frame)[1].tobytes()


def post(path, data, frame=None):
    files = {"image": ("frame.jpg", jpg(frame), "image/jpeg")} if frame is not None else None
    return requests.post(SERVER + path, data=data, files=files, auth=AUTH, timeout=10).json()


def face_step(sid, mode):
    """Kirim frame terbaru sampai wajah terbaca, atau menyerah (jadi cek petugas)."""
    for _ in range(FACE_TRIES):
        ok, frame = cap.read()
        if ok:
            r = post(f"/api/sessions/{sid}/face", {"mode": mode}, frame)
            if r.get("result") != "no_face":
                return r
        time.sleep(1)
    return post(f"/api/sessions/{sid}/face", {"mode": mode, "giveup": "1"})


def show(r):
    print(time.strftime("%H:%M:%S"), MODE, r.get("plate"), r.get("result"), r.get("message"), flush=True)
    if r.get("result") == "alert":
        print("!!! ALARM: pengendara berbeda. Cek /riwayat !!!", flush=True)


cap = cv2.VideoCapture(SRC)
last = 0.0
while True:
    ok, frame = cap.read()
    if not ok:
        print("stream putus, sambung ulang...")
        cap.release()
        time.sleep(2)
        cap = cv2.VideoCapture(SRC)
        continue
    if time.time() - last < INTERVAL:
        continue
    last = time.time()
    try:
        r = post("/api/scan", {"mode": MODE}, frame)
        if r.get("result") in ("no_plate", "ignored"):
            continue
        show(r)
        if r.get("next") == "face" and r.get("session_id"):
            show(face_step(r["session_id"], r.get("face_mode", MODE)))
    except Exception as e:
        print("gagal kirim:", e)
