"""Pembaca plat (ANPR) dan pembanding wajah.

Semuanya opsional. Kalau library-nya belum dipasang, fungsi mengembalikan None
dan sistem jatuh ke input plat manual / cek petugas.
"""
import os
import re

MIN_CONF = float(os.environ.get("PLATE_MIN_CONF", "0.5"))

_alpr = None
_alpr_tried = False


def _get_alpr():
    global _alpr, _alpr_tried
    if not _alpr_tried:
        _alpr_tried = True
        try:
            from fast_alpr import ALPR
            _alpr = ALPR()
        except Exception as e:  # library belum dipasang / model gagal diunduh
            print("[recognizer] pembaca plat otomatis tidak aktif:", e)
    return _alpr


def read_plate(image_bytes):
    """Return (teks_plat, confidence) atau (None, 0.0)."""
    alpr = _get_alpr()
    if alpr is None:
        return None, 0.0
    try:
        import cv2
        import numpy as np

        img = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            return None, 0.0
        best = (None, 0.0)
        for r in alpr.predict(img):
            o = r.ocr
            if o is None or not o.text:
                continue
            c = o.confidence
            c = float(sum(c) / len(c)) if isinstance(c, (list, tuple)) else float(c)
            if c > best[1]:
                best = (re.sub(r"[^A-Z0-9]", "", o.text.upper()), c)
        return best if best[1] >= MIN_CONF else (None, 0.0)
    except Exception as e:
        print("[recognizer] gagal baca plat:", e)
        return None, 0.0


_face_lib = None
_face_tried = False


def _face():
    global _face_lib, _face_tried
    if not _face_tried:
        _face_tried = True
        try:
            import face_recognition
            _face_lib = face_recognition
        except ImportError:
            print("[recognizer] pembanding wajah tidak aktif (face_recognition belum dipasang)")
    return _face_lib


def face_available():
    return _face() is not None


def has_face(path):
    """True/False ada wajah di foto; None kalau library wajah tidak ada."""
    fr = _face()
    if fr is None:
        return None
    try:
        return bool(fr.face_encodings(fr.load_image_file(path)))
    except Exception as e:
        print("[recognizer] gagal deteksi wajah:", e)
        return False


def face_distance(path_a, path_b):
    """Jarak wajah dua foto (makin kecil makin mirip; <=0.5 dianggap orang sama).
    None kalau library tidak ada atau wajah tidak terdeteksi di salah satu foto (mis. pakai helm)."""
    fr = _face()
    if fr is None:
        return None
    try:
        a = fr.face_encodings(fr.load_image_file(path_a))
        b = fr.face_encodings(fr.load_image_file(path_b))
        if not a or not b:
            return None
        return float(fr.face_distance([a[0]], b[0])[0])
    except Exception as e:
        print("[recognizer] gagal bandingkan wajah:", e)
        return None
