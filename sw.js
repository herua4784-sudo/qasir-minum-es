// ==========================================
// SERVICE WORKER — Qasir Minum.Es
// Tugasnya: simpan salinan "kerangka aplikasi" (HTML, ikon) DAN pustaka dari internet
// (React, Babel, ikon Font Awesome, Cropper) di tablet, supaya aplikasi tetap bisa
// DIBUKA kapan saja, termasuk saat tidak ada internet sama sekali.
//
// CATATAN PENTING: pustaka dari situs lain (unpkg, cdnjs) dimuat halaman tanpa izin
// CORS sehingga jawabannya "buram" dan TIDAK BISA disimpan oleh penangan fetch biasa.
// Karena itu pustaka-pustaka itu diunduh OLEH service worker sendiri (mode CORS, yang
// diizinkan server CDN) dan disimpan di cache dengan alamat aslinya. Saat halaman
// meminta alamat yang sama, jawaban diambil dari cache.
//
// Panggilan ke server GAS (data produk, transaksi, dll) SENGAJA TIDAK pernah disimpan
// di sini; penyimpanan data offline ditangani di dalam aplikasi (IndexedDB).
// ==========================================

// Naikkan angka versi ini SETIAP kali Index.html diperbarui, supaya tablet otomatis
// mengunduh versi terbaru.
const CACHE_NAME = 'qasir-minumes-v39';

// File milik aplikasi sendiri
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Pustaka dari internet yang WAJIB ada supaya aplikasi bisa tampil
const CDN_ASSETS = [
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-brands-400.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.1/cropper.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.1/cropper.min.js'
];

const MATCH_OPTS = { ignoreVary: true };

// Simpan satu file kalau belum ada. Mengembalikan true kalau sekarang sudah tersimpan.
async function cacheOne(cache, url, asCors) {
  if (await cache.match(url, MATCH_OPTS)) return true;
  try {
    const response = await fetch(url, asCors ? { mode: 'cors', credentials: 'omit' } : {});
    if (response && response.ok) {
      await cache.put(url, response);
      return true;
    }
    console.warn('[SW] Gagal simpan (status ' + (response ? response.status : '?') + '):', url);
  } catch (err) {
    console.warn('[SW] Gagal ambil untuk disimpan ke cache:', url, err);
  }
  return false;
}

// Lengkapi semua yang belum tersimpan. Aman dipanggil berulang (yang sudah ada dilewati),
// jadi kalau saat pemasangan internetnya buruk, file yang kurang dilengkapi di lain waktu.
async function ensureAll() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all([
    ...APP_SHELL.map((u) => cacheOne(cache, u, false)),
    ...CDN_ASSETS.map((u) => cacheOne(cache, u, true))
  ]);
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(ensureAll());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => ensureAll())
  );
});

// Halaman meminta "lengkapi cache" setiap kali aplikasi dibuka online.
self.addEventListener('message', (event) => {
  if (event.data === 'ensure') event.waitUntil(ensureAll());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = request.url;

  // Server GAS: biarkan lewat langsung, tidak pernah disimpan.
  if (url.includes('script.google.com') || url.includes('script.googleusercontent.com')) return;
  if (request.method !== 'GET') return;

  // Membuka aplikasi (halaman): tampilkan salinan tersimpan dulu; kalau tidak ada dan
  // offline, pakai index.html tersimpan (alamat dengan tambahan ?... tetap dikenali).
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = (await cache.match(request, { ignoreSearch: true, ignoreVary: true }))
        || (await cache.match('./index.html', MATCH_OPTS))
        || (await cache.match('./', MATCH_OPTS));
      const refresh = fetch(request).then((res) => {
        if (res && res.status === 200) cache.put('./index.html', res.clone());
        return res;
      });
      if (cached) {
        refresh.catch(() => {}); // pembaruan diam-diam; gagal tidak masalah
        return cached;
      }
      return refresh;
    })());
    return;
  }

  // File lain (pustaka, ikon, gambar): cache dulu, sambil diam-diam perbarui di latar.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, MATCH_OPTS);
    const network = fetch(request).then((res) => {
      if (res && res.status === 200) cache.put(request, res.clone());
      return res;
    });
    if (cached) {
      network.catch(() => {});
      return cached;
    }
    return network;
  })());
});
