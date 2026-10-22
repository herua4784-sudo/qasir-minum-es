// ==========================================
// SERVICE WORKER — Qasir Minum.Es
// Tugasnya: simpan salinan "kerangka aplikasi" (HTML, ikon, pustaka React/Babel/dll)
// di HP, supaya aplikasi tetap bisa DIMUAT walau tanpa internet.
//
// PENTING: Panggilan ke server GAS (data produk, transaksi, dll) SENGAJA TIDAK
// PERNAH disimpan di sini — itu data hidup yang harus selalu terbaru, bukan versi
// lama yang "nyangkut". Menyimpan transaksi SAAT offline (supaya nanti otomatis
// terkirim begitu online) itu bagian terpisah (Lapisan berikutnya), belum ada di sini.
// ==========================================

// Naikkan angka versi ini (v1 -> v2 -> dst) SETIAP kali Index.html diperbarui,
// supaya HP pengguna otomatis unduh ulang versi terbaru, bukan versi lama yang
// ketinggalan tersimpan di cache.
const CACHE_NAME = 'qasir-minumes-v16';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// INSTALL — dipanggil sekali saat Service Worker pertama kali terpasang di HP.
// PENTING: tiap file disimpan SENDIRI-SENDIRI (bukan pakai cache.addAll yang
// sifatnya "semua-atau-tidak-sama-sekali"). Kalau satu file gagal diambil (misal
// belum sempat ke-upload atau namanya sedikit beda), file yang lain TETAP berhasil
// disimpan -- supaya aplikasi tetap punya sesuatu untuk ditampilkan saat offline.
self.addEventListener('install', (event) => {
  self.skipWaiting(); // langsung aktif, tidak perlu tunggu tab lama ditutup semua
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        APP_SHELL.map((url) =>
          fetch(url)
            .then((response) => {
              if (response && response.ok) {
                return cache.put(url, response);
              }
              console.warn('[SW] Gagal simpan (status ' + (response ? response.status : '?') + '):', url);
            })
            .catch((err) => {
              console.warn('[SW] Gagal ambil untuk disimpan ke cache:', url, err);
            })
        )
      );
    })
  );
});

// ACTIVATE — bersihkan cache versi lama supaya HP tidak menumpuk data usang.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// FETCH — setiap kali aplikasi minta sesuatu (halaman, gambar, script, atau data),
// permintaan itu lewat sini dulu.
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Panggilan ke server GAS (data produk/transaksi/dll) — JANGAN PERNAH di-cache.
  // Biarkan lewat langsung ke jaringan seperti biasa. Kalau lagi offline, panggilan
  // ini akan gagal secara alami (ditangani oleh runGoogleScript di aplikasi), belum
  // ada antrian otomatis di tahap ini.
  if (url.includes('script.google.com') || url.includes('script.googleusercontent.com')) {
    return;
  }

  // Method selain GET (misal kalau ada POST langsung ke halaman lain) dibiarkan
  // apa adanya, tidak dicampuri.
  if (event.request.method !== 'GET') {
    return;
  }

  // Untuk file aplikasi & pustaka CDN (React, Babel, Tailwind, ikon, dll):
  // strategi "tampilkan cache dulu (instan), sambil diam-diam ambil versi terbaru
  // di latar belakang untuk disimpan buat lain kali dibuka".
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const networkFetch = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse); // offline & tidak ada di cache -> biarkan gagal

      return cachedResponse || networkFetch;
    })
  );
});
