Smart Parking - PWA (Progressive Web App) untuk Mobile
========================================================
Update: OTP dikirim gaya WhatsApp + notifikasi pop-up asli + UI netral
(tanpa jam/baterai/sinyal palsu) supaya enak dilihat di semua merk HP.

INI BUKAN FILE .APK. Environment ini tidak bisa compile APK asli karena
butuh Android SDK/Gradle dari server Google yang aksesnya diblokir di sini.
Sebagai gantinya ini PWA: web app yang BISA DIINSTAL ke HP seperti app biasa
(ikon di Home Screen, full-screen, jalan offline).

APA YANG BERUBAH DARI VERSI SEBELUMNYA:
1. OTP via WhatsApp (simulasi):
   - Setelah isi nomor HP, klik "Lanjut" -> sistem "mengirim" OTP.
   - Muncul notifikasi pop-up asli di HP (gaya pesan WhatsApp) berisi kode.
   - Di layar OTP juga ada bubble hijau ala WhatsApp yang nampilin kodenya,
     buat jaga-jaga kalau user belum kasih izin notifikasi.
   - (Catatan jujur: ini simulasi visual, bukan kirim WA sungguhan ke nomor
     asli — WA Business API perlu server & akses yang tidak tersedia di
     environment ini. Kalau nanti backend sudah ada, tinggal ganti fungsi
     sendOtpViaWhatsApp() di index.html supaya call API WA beneran.)

2. UI dibersihkan dari elemen palsu:
   - Baris jam/baterai/sinyal (status bar tiruan) DIHAPUS — HP kamu sudah
     punya status bar asli sendiri, jadi tidak akan bentrok tampilan gaya
     iPhone/Android tertentu. Tampilan jadi netral, enak dipakai di semua
     merk HP.
   - "Notch" hitam ala iPhone juga dihapus.
   - Ditambah padding "safe area" otomatis biar konten tidak ketiban
     notch/status bar di HP model apapun.

3. Notifikasi pop-up ASLI (bukan cuma tampil di menu Notifikasi dalam app):
   - Saat "Simulasikan: Kendaraan Ingin Keluar", "Pembayaran", dan
     "Gerbang terbuka" ditekan, aplikasi memicu Notification API asli.
   - Notifikasi ini muncul sebagai pop-up sistem (banner/tray) walau kamu
     lagi di Home Screen HP / app di-minimize — SELAMA app/tab masih
     berjalan di background (baru saja diminimize, browser belum
     benar-benar mematikannya).
   - Tap notifikasinya akan membuka app langsung ke layar terkait
     (misalnya notifikasi "Kendaraan Ingin Keluar" langsung ke layar
     Login PIN -> Persetujuan Keluar).
   - Wajib izinkan permission notifikasi saat pertama buka (tombol
     "Mulai" di splash screen akan minta izin ini).

   BATASAN JUJUR: kalau app sudah benar-benar ditutup total / HP dimatikan
   layarnya lama, notifikasi "server-push" yang tetap muncul butuh backend
   push server sungguhan (mis. Firebase Cloud Messaging) yang device-nya
   terdaftar — itu di luar batas prototype front-end ini. Yang sudah
   berjalan sekarang: notifikasi asli muncul selama app baru saja dibuka/
   di-background-kan, cukup untuk demo ke klien/stakeholder.

CARA INSTALL DI HP (Android/iOS, semua merk):
1. Upload folder ini ke hosting HTTPS apa saja — paling gampang:
   buka app.netlify.com/drop lalu drag & drop folder ini.
2. Buka link hasil hosting itu di Chrome (Android) atau Safari (iPhone).
3. Chrome: menu titik tiga -> "Install app" / "Tambah ke layar Utama".
   Safari (iOS): tombol Share -> "Add to Home Screen".
4. Ikon "Smart Parking" muncul di Home Screen, buka full-screen tanpa
   address bar seperti app native.
5. Izinkan permission notifikasi saat diminta di layar awal ("Mulai").

OPSI COBA CEPAT VIA WIFI LOKAL (tanpa hosting):
1. Di komputer, masuk folder ini lalu jalankan:
     python3 -m http.server 8000
2. Di HP (WiFi sama), buka: http://<IP-komputer>:8000/index.html
3. Lakukan "Add to Home Screen" dari menu browser.

CATATAN:
- Membuka index.html langsung dari file:// tetap bisa dilihat tampilannya,
  tapi "Install/Add to Home Screen", notifikasi pop-up, dan offline cache
  butuh diakses lewat http:// atau https://.
- Kalau butuh .apk asli (native Android) untuk upload ke Play Store, langkah
  selanjutnya: bungkus PWA ini pakai Bubblewrap / PWABuilder.com / Capacitor
  — itu perlu dijalankan di komputer kamu sendiri (butuh Android SDK). Bilang
  aja kalau mau saya siapkan source project-nya.

Isi folder:
- index.html   -> seluruh aplikasi (semua screen + logic)
- manifest.json -> metadata PWA (nama, ikon, warna tema)
- sw.js         -> service worker (offline cache + handle klik notifikasi)
- icons/        -> ikon app (192x192, 512x512)
