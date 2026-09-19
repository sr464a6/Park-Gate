// Alarm pengendara berbeda: banner merah + sirine di semua halaman petugas.
(() => {
  let ctx = null, siren = null, muted = false, lastCount = 0;

  const bar = document.createElement('div');
  bar.className = 'alarm-bar';
  bar.hidden = true;
  bar.setAttribute('role', 'alert');
  const msg = document.createElement('span');
  msg.className = 'alarm-msg';
  const hint = document.createElement('small');
  const mute = document.createElement('button');
  mute.type = 'button';
  mute.textContent = 'Bisukan';
  const link = document.createElement('a');
  link.href = '/riwayat';
  link.textContent = 'Buka riwayat';
  bar.append(msg, hint, mute, link);
  document.body.prepend(bar);

  function prime() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* tanpa suara */ }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }
  document.addEventListener('click', prime);
  document.addEventListener('keydown', prime);

  function startSiren() {
    if (!ctx || ctx.state !== 'running' || siren) return;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'square';
    gain.gain.value = 0.12;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    let hi = false;
    const t = setInterval(() => { hi = !hi; osc.frequency.value = hi ? 880 : 620; }, 400);
    osc.frequency.value = 620;
    siren = { osc, t };
  }
  function stopSiren() {
    if (!siren) return;
    clearInterval(siren.t);
    try { siren.osc.stop(); } catch (e) { /* sudah berhenti */ }
    siren = null;
  }

  mute.onclick = () => { muted = true; stopSiren(); mute.hidden = true; };

  function render(d) {
    if (d.count === 0) {
      bar.hidden = true;
      stopSiren();
      lastCount = 0;
      if (document.title.startsWith('(ALARM) ')) document.title = document.title.slice(8);
      return;
    }
    if (d.count > lastCount) { muted = false; mute.hidden = false; }
    lastCount = d.count;
    const a = d.alerts[0];
    msg.textContent = `ALARM: motor ${a.plate} (${a.owner}) dibawa pengendara yang berbeda dari saat masuk` +
      (d.count > 1 ? ` (+${d.count - 1} lainnya)` : '');
    bar.hidden = false;
    if (!document.title.startsWith('(ALARM) ')) document.title = '(ALARM) ' + document.title;
    prime();
    const silent = !ctx || ctx.state !== 'running';
    hint.textContent = silent ? 'Klik di mana saja untuk mengaktifkan suara.' : '';
    if (!muted) startSiren(); else stopSiren();
  }

  async function poll() {
    try {
      const r = await fetch('/api/alerts');
      if (r.ok) render(await r.json());
    } catch (e) { /* server sementara tidak terjangkau */ }
  }
  window.pollAlerts = poll;
  poll();
  setInterval(poll, 4000);
})();
