import base64
import json
import os
import re
import secrets
import sqlite3
import threading
import time
import urllib.parse
import urllib.request
import uuid
from contextlib import closing
from datetime import datetime
from functools import wraps

from flask import (Flask, Response, abort, jsonify, redirect, render_template,
                   request, send_from_directory)

import recognizer

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, "data")
UPLOADS = os.path.join(DATA, "uploads")
os.makedirs(UPLOADS, exist_ok=True)
DB_PATH = os.path.join(DATA, "parkir.db")

ADMIN_USER = os.environ.get("ADMIN_USER", "admin")
ADMIN_PASS = os.environ.get("ADMIN_PASS", "admin")
AUTO_VERIFY = os.environ.get("AUTO_VERIFY", "0") == "1"  # 1 = tanpa verifikasi STNK (hanya uji coba)
FACE_MATCH_MAX = float(os.environ.get("FACE_MATCH_MAX", "0.5"))   # <= ini: orang sama
FACE_ALERT_MIN = float(os.environ.get("FACE_ALERT_MIN", "0.6"))   # >= ini: orang beda -> ALARM
ALERT_WEBHOOK_URL = os.environ.get("ALERT_WEBHOOK_URL", "")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")
PUBLIC_URL = os.environ.get("PUBLIC_URL", "http://localhost:5000")
DEDUP_SECONDS = 12

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 12 * 1024 * 1024

STATUS_LABEL = {
    "INSIDE": "Di dalam",
    "DONE": "Sudah keluar",
    "REVIEW": "Perlu dicek",
    "ALERT": "ALARM: pengendara beda",
    "HELD": "Ditahan",
}
OPEN_STATUSES = ("INSIDE", "REVIEW", "ALERT", "HELD")


# ---------- database ----------
def query(sql, args=(), one=False):
    with closing(sqlite3.connect(DB_PATH)) as con:
        con.row_factory = sqlite3.Row
        rows = con.execute(sql, args).fetchall()
    return (rows[0] if rows else None) if one else rows


def execute(sql, args=()):
    with closing(sqlite3.connect(DB_PATH)) as con:
        cur = con.execute(sql, args)
        con.commit()
        return cur.lastrowid


def init_db():
    with closing(sqlite3.connect(DB_PATH)) as con:
        con.executescript(
            """
            CREATE TABLE IF NOT EXISTS vehicles(
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              plate TEXT UNIQUE NOT NULL,
              owner_name TEXT NOT NULL,
              phone TEXT,
              stnk_photo TEXT NOT NULL,
              verified INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions(
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
              plate TEXT NOT NULL,
              entry_time TEXT NOT NULL,
              entry_photo TEXT,
              entry_face TEXT,
              exit_time TEXT,
              exit_photo TEXT,
              exit_face TEXT,
              status TEXT NOT NULL,
              face_distance REAL,
              note TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_sessions_plate ON sessions(plate, status);
            """
        )
        cols = {r[1] for r in con.execute("PRAGMA table_info(sessions)")}
        for c in ("entry_face", "exit_face"):  # migrasi dari versi sebelumnya
            if c not in cols:
                con.execute(f"ALTER TABLE sessions ADD COLUMN {c} TEXT")
        con.commit()


# ---------- util ----------
PLATE_RE = re.compile(r"^([A-Z]{1,2})(\d{1,4})([A-Z]{0,3})$")


def normalize_plate(s):
    return re.sub(r"[^A-Z0-9]", "", (s or "").upper())


def valid_plate(p):
    return bool(PLATE_RE.match(p))


def pretty_plate(p):
    m = PLATE_RE.match(p or "")
    return " ".join(g for g in m.groups() if g) if m else (p or "")


app.jinja_env.filters["plate"] = pretty_plate


def now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def image_ext(data):
    if data[:3] == b"\xff\xd8\xff":
        return "jpg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def save_image(data):
    ext = image_ext(data)
    if not ext:
        return None
    name = f"{datetime.now():%Y%m%d-%H%M%S}-{uuid.uuid4().hex[:8]}.{ext}"
    with open(os.path.join(UPLOADS, name), "wb") as f:
        f.write(data)
    return name


def upath(name):
    return os.path.join(UPLOADS, name)


def media_url(name):
    return f"/media/{name}" if name else None


def request_image():
    """Ambil gambar dari multipart 'image' atau dataURL di JSON. Return bytes atau None."""
    if request.files.get("image"):
        return request.files["image"].read()
    j = request.get_json(silent=True) or {}
    s = j.get("image")
    if isinstance(s, str) and "," in s:
        try:
            return base64.b64decode(s.split(",", 1)[1])
        except Exception:
            return None
    return None


def param(name):
    j = request.get_json(silent=True) or {}
    return request.form.get(name) or j.get(name)


def need_auth(fn):
    @wraps(fn)
    def wrapper(*a, **k):
        auth = request.authorization
        ok = (
            auth
            and secrets.compare_digest(auth.username or "", ADMIN_USER)
            and secrets.compare_digest(auth.password or "", ADMIN_PASS)
        )
        if not ok:
            return Response("Login petugas diperlukan", 401,
                            {"WWW-Authenticate": 'Basic realm="Petugas parkir"'})
        return fn(*a, **k)

    return wrapper


def get_session(sid):
    return query("SELECT * FROM sessions WHERE id=?", (sid,), one=True)


def get_vehicle(vid):
    return query("SELECT * FROM vehicles WHERE id=?", (vid,), one=True)


# ---------- notifikasi alarm ----------
def notify_alert(s, vehicle, dist):
    text = (f"ALARM PARKIR: motor {pretty_plate(s['plate'])} ({vehicle['owner_name']}) mau keluar dengan "
            f"pengendara BERBEDA dari yang masuk pukul {s['entry_time']}. Cek {PUBLIC_URL}/riwayat")
    payload = {
        "event": "rider_mismatch", "session_id": s["id"], "plate": pretty_plate(s["plate"]),
        "owner": vehicle["owner_name"], "phone": vehicle["phone"], "entry_time": s["entry_time"],
        "face_distance": dist, "text": text, "url": PUBLIC_URL + "/riwayat",
    }

    def run():
        print("[ALARM]", text, flush=True)
        try:
            if ALERT_WEBHOOK_URL:
                req = urllib.request.Request(ALERT_WEBHOOK_URL, data=json.dumps(payload).encode(),
                                             headers={"Content-Type": "application/json"})
                urllib.request.urlopen(req, timeout=8).read()
            if TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID:
                data = urllib.parse.urlencode({"chat_id": TELEGRAM_CHAT_ID, "text": text}).encode()
                urllib.request.urlopen(
                    f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage", data=data, timeout=8).read()
        except Exception as e:
            print("[ALARM] gagal kirim notifikasi:", e, flush=True)

    threading.Thread(target=run, daemon=True).start()


# ---------- pendaftaran (publik) ----------
@app.get("/")
def home():
    return render_template("register.html", active="daftar", form={})


@app.post("/daftar")
def daftar():
    form = {k: (request.form.get(k) or "").strip() for k in ("plate", "owner_name", "phone")}
    plate = normalize_plate(form["plate"])

    def fail(msg):
        return render_template("register.html", active="daftar", form=form, msg=msg, tone="bad"), 400

    if not valid_plate(plate):
        return fail("Format plat tidak dikenali. Contoh: L 1234 AB")
    if not form["owner_name"]:
        return fail("Nama pemilik wajib diisi.")
    f = request.files.get("stnk")
    data = f.read() if f else b""
    if not data:
        return fail("Foto STNK wajib diunggah.")
    photo = save_image(data)
    if not photo:
        return fail("File STNK harus berupa foto (JPG, PNG, atau WebP).")
    if query("SELECT id FROM vehicles WHERE plate=?", (plate,), one=True):
        return fail("Plat ini sudah terdaftar. Hubungi petugas kalau perlu mengubah data.")
    execute(
        "INSERT INTO vehicles(plate, owner_name, phone, stnk_photo, verified, created_at) VALUES(?,?,?,?,?,?)",
        (plate, form["owner_name"], form["phone"], photo, 1 if AUTO_VERIFY else 0, now()),
    )
    msg = (f"Plat {pretty_plate(plate)} terdaftar. "
           + ("Sudah aktif." if AUTO_VERIFY else "Menunggu verifikasi STNK oleh petugas."))
    return render_template("register.html", active="daftar", form={}, msg=msg, tone="ok")


# ---------- gerbang ----------
@app.get("/gerbang")
@need_auth
def gerbang():
    return render_template("gate.html", active="gerbang")


_recent = {}


def scan_reply(result, message, plate=None, vehicle=None, session=None, **extra):
    body = {"result": result, "message": message, "plate": pretty_plate(plate) if plate else None}
    if vehicle:
        body["owner"] = vehicle["owner_name"]
    if session:
        body["session_id"] = session["id"]
        body["entry_time"] = session["entry_time"]
        body["entry_photo"] = media_url(session["entry_face"] or session["entry_photo"])
    body.update(extra)
    return jsonify(body)


def finish_exit(s, vehicle, dist, photo, no_compare_note=None):
    """Putuskan hasil keluar dari jarak wajah masuk vs keluar (dist None = tidak bisa dibandingkan)."""
    plate = s["plate"]
    face_photo = photo if dist is not None else None
    url = media_url(photo)

    if dist is not None and dist <= FACE_MATCH_MAX:
        execute("UPDATE sessions SET status='DONE', exit_time=?, exit_photo=COALESCE(?, exit_photo), "
                "exit_face=COALESCE(?, exit_face), face_distance=?, note=NULL WHERE id=?",
                (now(), photo, face_photo, dist, s["id"]))
        return scan_reply("exit_ok", "Plat dan pengendara cocok. Silakan keluar.", plate, vehicle,
                          get_session(s["id"]), exit_photo=url, distance=dist)

    # ALARM: wajah jelas beda, atau sesi ini sudah pernah diberi alarm (alarm tidak bisa turun sendiri)
    if (dist is not None and dist >= FACE_ALERT_MIN) or s["status"] == "ALERT":
        note = ("Pengendara BERBEDA dari yang masuk" if dist is not None
                else "Sesi beralarm: wajah keluar tidak terbaca")
        execute("UPDATE sessions SET status='ALERT', exit_photo=COALESCE(?, exit_photo), "
                "exit_face=COALESCE(?, exit_face), face_distance=?, note=? WHERE id=?",
                (photo, face_photo, dist, note, s["id"]))
        if s["status"] != "ALERT":
            notify_alert(s, vehicle, dist)
        return scan_reply("alert", "TAHAN MOTOR. Pengendara berbeda dari yang masuk. Panggil petugas.",
                          plate, vehicle, get_session(s["id"]), exit_photo=url, distance=dist)

    note = "Wajah mirip tapi belum pasti" if dist is not None else (no_compare_note or "Wajah tidak bisa dibandingkan otomatis")
    execute("UPDATE sessions SET status='REVIEW', exit_photo=COALESCE(?, exit_photo), "
            "exit_face=COALESCE(?, exit_face), face_distance=?, note=? WHERE id=?",
            (photo, face_photo, dist, note, s["id"]))
    return scan_reply("exit_review", f"{note}. Petugas cek foto masuk dan keluar.", plate, vehicle,
                      get_session(s["id"]), exit_photo=url, distance=dist)


@app.post("/api/scan")
@need_auth
def api_scan():
    mode = (param("mode") or "").lower()
    if mode not in ("in", "out"):
        return jsonify(result="error", message="mode harus 'in' atau 'out'"), 400

    data = request_image()
    if data and not image_ext(data):
        return jsonify(result="error", message="gambar tidak valid"), 400

    manual = normalize_plate(param("plate"))
    if manual:
        plate = manual
    elif data:
        plate, _conf = recognizer.read_plate(data)
        plate = normalize_plate(plate)
    else:
        plate = ""
    if not plate:
        return jsonify(result="no_plate", message="Plat belum terbaca")
    if not valid_plate(plate):
        return jsonify(result="no_plate", message=f"Bacaan '{plate}' bukan format plat")

    key = (mode, plate)  # cegah frame beruntun memproses plat yang sama berkali-kali
    if not manual and time.time() - _recent.get(key, 0) < DEDUP_SECONDS:
        return jsonify(result="ignored", message="sudah diproses")
    _recent[key] = time.time()

    vehicle = query("SELECT * FROM vehicles WHERE plate=?", (plate,), one=True)
    if not vehicle:
        return scan_reply("unregistered", "Plat belum terdaftar. Arahkan ke petugas.", plate)
    if not vehicle["verified"] and not AUTO_VERIFY:
        return scan_reply("unverified", "STNK belum diverifikasi petugas.", plate, vehicle)

    open_s = query(
        f"SELECT * FROM sessions WHERE plate=? AND status IN ({','.join('?' * len(OPEN_STATUSES))}) ORDER BY id DESC",
        (plate, *OPEN_STATUSES), one=True,
    )
    photo = save_image(data) if data else None
    face_lib = recognizer.face_available()

    # ---- masuk ----
    if mode == "in":
        if open_s:
            return scan_reply("already_inside",
                              "Motor ini tercatat masih di dalam. Panggil petugas.", plate, vehicle, open_s)
        face_found = False
        if photo:
            # tanpa library wajah, foto masuk disimpan apa adanya untuk dicek petugas nanti
            face_found = recognizer.has_face(upath(photo)) if face_lib else True
        sid = execute(
            "INSERT INTO sessions(vehicle_id, plate, entry_time, entry_photo, entry_face, status) VALUES(?,?,?,?,?,?)",
            (vehicle["id"], plate, now(), photo, photo if face_found else None, "INSIDE"),
        )
        s = get_session(sid)
        if face_lib and not face_found:
            return scan_reply("entered", "Silakan masuk. Hadapkan wajah ke kamera untuk direkam.",
                              plate, vehicle, s, next="face", face_mode="in")
        return scan_reply("entered", "Silakan masuk.", plate, vehicle, s)

    # ---- keluar ----
    if not open_s:
        return scan_reply("no_entry", "Tidak ada catatan masuk untuk plat ini.", plate, vehicle)
    if open_s["status"] == "HELD":
        return scan_reply("held", "Ditahan petugas. Hubungi petugas.", plate, vehicle, open_s)
    if not open_s["entry_face"]:
        return finish_exit(open_s, vehicle, None, photo, "Wajah saat masuk tidak terekam")
    if not face_lib:
        return finish_exit(open_s, vehicle, None, photo, "Pembanding wajah otomatis tidak aktif")

    dist = None
    if photo:
        dist = recognizer.face_distance(upath(open_s["entry_face"]), upath(photo))
    if dist is None:  # wajah belum terlihat di frame plat -> minta scan wajah
        return scan_reply("need_face", "Hadapkan wajah ke kamera untuk dicocokkan.", plate, vehicle,
                          open_s, next="face", face_mode="out")
    return finish_exit(open_s, vehicle, dist, photo)


@app.post("/api/sessions/<int:sid>/face")
@need_auth
def api_face(sid):
    """Langkah scan wajah: merekam wajah saat masuk (mode=in) atau mencocokkan saat keluar (mode=out)."""
    s = get_session(sid)
    if not s or s["status"] == "DONE":
        return jsonify(result="error", message="sesi tidak ditemukan atau sudah selesai"), 404
    vehicle = get_vehicle(s["vehicle_id"])
    mode = (param("mode") or "").lower()
    if mode not in ("in", "out"):
        return jsonify(result="error", message="mode harus 'in' atau 'out'"), 400

    if param("giveup"):
        if mode == "out":
            return finish_exit(s, vehicle, None, None, "Wajah keluar tidak terbaca kamera")
        return jsonify(result="face_skipped", message="Wajah masuk belum terekam. Petugas akan cek saat keluar.")

    data = request_image()
    if not data or not image_ext(data):
        return jsonify(result="error", message="gambar tidak valid"), 400
    photo = save_image(data)
    path = upath(photo)
    face_lib = recognizer.face_available()

    def no_face():
        os.remove(path)
        return jsonify(result="no_face", message="Wajah belum terlihat. Hadapkan wajah, buka visor helm.")

    if mode == "in":
        if s["status"] != "INSIDE":
            os.remove(path)
            return jsonify(result="error", message="sesi tidak dalam status masuk"), 400
        if s["entry_face"]:
            os.remove(path)
            return jsonify(result="face_saved", message="Wajah masuk sudah terekam.",
                           plate=pretty_plate(s["plate"]), owner=vehicle["owner_name"])
        if face_lib and not recognizer.has_face(path):
            return no_face()
        execute("UPDATE sessions SET entry_face=? WHERE id=?", (photo, sid))
        return jsonify(result="face_saved", message="Wajah masuk terekam.",
                       plate=pretty_plate(s["plate"]), owner=vehicle["owner_name"], entry_photo=media_url(photo))

    # mode == out
    if s["status"] == "HELD":
        os.remove(path)
        return scan_reply("held", "Ditahan petugas. Hubungi petugas.", s["plate"], vehicle, s)
    if not s["entry_face"]:
        return finish_exit(s, vehicle, None, photo, "Wajah saat masuk tidak terekam")
    if not face_lib:
        return finish_exit(s, vehicle, None, photo, "Pembanding wajah otomatis tidak aktif")
    dist = recognizer.face_distance(upath(s["entry_face"]), path)
    if dist is None:
        return no_face()
    return finish_exit(s, vehicle, dist, photo)


# ---------- alarm & keputusan petugas ----------
@app.get("/api/alerts")
@need_auth
def api_alerts():
    rows = query("SELECT s.id, s.plate, s.entry_time, s.note, v.owner_name FROM sessions s "
                 "JOIN vehicles v ON v.id=s.vehicle_id WHERE s.status='ALERT' ORDER BY s.id DESC")
    return jsonify(count=len(rows), alerts=[
        {"id": r["id"], "plate": pretty_plate(r["plate"]), "owner": r["owner_name"],
         "entry_time": r["entry_time"], "note": r["note"]} for r in rows])


@app.post("/riwayat/<int:sid>/putuskan")
@need_auth
def putuskan(sid):
    aksi = param("aksi")
    s = get_session(sid)
    if not s or s["status"] not in ("REVIEW", "HELD", "ALERT") or aksi not in ("izinkan", "tahan"):
        abort(400)
    if aksi == "izinkan":
        tag = "disetujui petugas setelah alarm" if s["status"] == "ALERT" else "disetujui petugas"
        execute("UPDATE sessions SET status='DONE', exit_time=?, note=? WHERE id=?",
                (now(), ((s["note"] or "") + " | " + tag).strip(" |"), sid))
    else:
        execute("UPDATE sessions SET status='HELD' WHERE id=?", (sid,))
    if request.is_json:
        return jsonify(ok=True)
    return redirect("/riwayat")


# ---------- riwayat & kendaraan (petugas) ----------
@app.get("/riwayat")
@need_auth
def riwayat():
    rows = query(
        "SELECT s.*, v.owner_name FROM sessions s JOIN vehicles v ON v.id=s.vehicle_id ORDER BY s.id DESC LIMIT 300")
    return render_template("riwayat.html", active="riwayat", rows=rows, labels=STATUS_LABEL)


@app.get("/kendaraan")
@need_auth
def kendaraan():
    rows = query("SELECT * FROM vehicles ORDER BY verified ASC, id DESC")
    return render_template("kendaraan.html", active="kendaraan", rows=rows)


@app.post("/kendaraan/<int:vid>/verifikasi")
@need_auth
def verifikasi(vid):
    v = get_vehicle(vid)
    if not v:
        abort(404)
    execute("UPDATE vehicles SET verified=? WHERE id=?", (0 if v["verified"] else 1, vid))
    return redirect("/kendaraan")


@app.get("/media/<path:name>")
@need_auth
def media(name):
    return send_from_directory(UPLOADS, name)


init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), debug=False)
