const $ = (s) => document.querySelector(s);
const video = $('#video');
const canvas = document.createElement('canvas');
const FACE_TRIES = 12;
let mode = 'in', busy = false, timer = null;
let locked = false;      // menunggu keputusan petugas
let faceTask = null;     // {sid, mode, tries, base}
let currentSession = null;

async function startCam() {
  try {
    video.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } } });
  } catch (e) {
    setPanel('warn', 'Kamera tidak bisa dibuka', { message: 'Pakai input plat manual, atau jalankan cctv_worker.py untuk CCTV. Kamera browser butuh https atau localhost.' });
  }
}

function frame() {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.85);
}

async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
}

function setMode(m) {
  mode = m;
  $('#m-in').classList.toggle('on', m === 'in');
  $('#m-out').classList.toggle('on', m === 'out');
  $('#m-in').setAttribute('aria-pressed', m === 'in');
  $('#m-out').setAttribute('aria-pressed', m === 'out');
  locked = false;
  faceTask = null;
  setPanel('idle', 'Arahkan plat ke kamera', {});
}

function setPanel(tone, status, o) {
  $('#panel').className = 'result ' + tone;
  $('#status').textContent = status;
  const p = $('#rplate');
  p.hidden = !o.plate;
  p.textContent = o.plate || '';
  $('#rowner').textContent = o.owner ? 'Pemilik: ' + o.owner : '';
  $('#rmsg').textContent = o.message || '';
  $('#photos').hidden = !(o.entry_photo || o.exit_photo);
  $('#pin').src = o.entry_photo || '';
  $('#pout').src = o.exit_photo || '';
  currentSession = o.decide ? o.session_id : null;
  $('#decide').hidden = !o.decide;
}

const TONE = {
  entered: ['ok', 'Silakan masuk'],
  face_saved: ['ok', 'Wajah masuk terekam'],
  face_skipped: ['warn', 'Wajah belum terekam'],
  exit_ok: ['ok', 'Cocok, silakan keluar'],
  exit_review: ['warn', 'Tahan, cek petugas'],
  alert: ['alarm', 'ALARM: pengendara berbeda!'],
  need_face: ['warn', 'Scan wajah'],
  already_inside: ['warn', 'Sudah tercatat di dalam'],
  held: ['warn', 'Ditahan petugas'],
  unregistered: ['bad', 'Plat belum terdaftar'],
  unverified: ['bad', 'STNK belum diverifikasi'],
  no_entry: ['bad', 'Tidak ada catatan masuk'],
};

function handle(res) {
  const [tone, label] = TONE[res.result] || ['idle', res.result];
  const decide = ['exit_review', 'alert', 'held'].includes(res.result);
  setPanel(tone, label, { ...res, decide });
  locked = decide;
  if (res.result === 'alert' && window.pollAlerts) window.pollAlerts();
  if (res.next === 'face' && res.session_id) {
    faceTask = { sid: res.session_id, mode: res.face_mode || mode, tries: 0, base: { plate: res.plate, owner: res.owner, entry_photo: res.entry_photo } };
    setTimeout(faceLoop, 400);
  }
}

async function faceLoop() {
  const t = faceTask;
  if (!t) return;
  if (!video.videoWidth || t.tries >= FACE_TRIES) return endFace();
  t.tries++;
  setPanel('warn', 'Scan wajah', { ...t.base, message: `Hadapkan wajah ke kamera, buka visor helm (${t.tries}/${FACE_TRIES})` });
  try {
    const res = await post(`/api/sessions/${t.sid}/face`, { mode: t.mode, image: frame() });
    if (res.result === 'no_face') return setTimeout(faceLoop, 1000);
    faceTask = null;
    handle({ ...t.base, ...res });
  } catch (e) {
    faceTask = null;
    setPanel('bad', 'Server tidak terjangkau', { message: String(e) });
  }
}

async function endFace() {
  const t = faceTask;
  faceTask = null;
  try {
    handle({ ...t.base, ...(await post(`/api/sessions/${t.sid}/face`, { mode: t.mode, giveup: true })) });
  } catch (e) {
    setPanel('bad', 'Server tidak terjangkau', { message: String(e) });
  }
}

async function scan(manualPlate) {
  if (busy || faceTask || (locked && !manualPlate)) return;
  if (!manualPlate && !video.videoWidth) return;
  busy = true;
  try {
    const body = { mode };
    if (manualPlate) body.plate = manualPlate;
    if (video.videoWidth) body.image = frame();
    const res = await post('/api/scan', body);
    if (res.result === 'ignored') return;
    if (res.result === 'no_plate') {
      if (manualPlate) setPanel('bad', 'Plat tidak dikenali', { message: res.message });
      return;
    }
    if (res.result === 'error') return setPanel('bad', 'Gagal', { message: res.message });
    handle(res);
  } catch (e) {
    setPanel('bad', 'Server tidak terjangkau', { message: String(e) });
  } finally {
    busy = false;
  }
}

function applyAuto() {
  clearInterval(timer);
  if ($('#auto').checked) timer = setInterval(() => scan(), 1500);
}

$('#m-in').onclick = () => setMode('in');
$('#m-out').onclick = () => setMode('out');
$('#scan').onclick = () => scan();
$('#auto').onchange = applyAuto;
$('#manual').onsubmit = (e) => {
  e.preventDefault();
  const v = $('#plate').value.trim();
  if (v) { scan(v); $('#plate').value = ''; }
};
$('#decide').addEventListener('click', async (e) => {
  const aksi = e.target.dataset.a;
  if (!aksi) return;
  if (aksi === 'lanjut') { locked = false; return setPanel('idle', 'Arahkan plat ke kamera', {}); }
  if (!currentSession) return;
  const r = await fetch(`/riwayat/${currentSession}/putuskan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aksi }) });
  locked = false;
  setPanel(aksi === 'izinkan' ? 'ok' : 'warn', aksi === 'izinkan' ? 'Diizinkan keluar' : 'Motor ditahan', { message: r.ok ? '' : 'Gagal menyimpan keputusan' });
  if (window.pollAlerts) window.pollAlerts();
});

startCam();
applyAuto();
