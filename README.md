# TugasKu

TugasKu adalah aplikasi web sederhana untuk Bayu dan teman sekelasnya. Kamu
bisa mencatat tugas, jadwal, deadline, lampiran, dan obrolan kelas dari HP.
Semua kode berjalan sebagai file HTML, CSS, dan JavaScript biasa.

## Versi live

Database Supabase dan GitHub Pages sudah aktif. Kamu bisa langsung membuka
aplikasi di [c175244.github.io/tugasku](https://c175244.github.io/tugasku/)
dan membuat akun baru. Halaman Setup tidak perlu diisi lagi untuk penggunaan
aplikasi live karena konfigurasi publiknya sudah ada di `assets/js/config.js`.

## Fitur lengkap

1. Masuk dengan Google, email/password, atau magic link.
2. Buat kelas dengan kode room enam karakter atau bergabung ke kelas teman.
3. Kelola anggota dengan peran admin dan anggota.
4. Simpan jadwal Minggu sampai Sabtu, termasuk guru dan jam pelajaran.
5. Buat tugas dengan mata pelajaran, tipe, tingkat kesulitan, dan prioritas.
6. Pilih deadline tanggal tertentu atau deadline sampai pelajaran berikutnya.
7. Tandai tugas selesai secara pribadi tanpa mengubah status teman.
8. Lihat countdown hari, jam, menit, dan detik.
9. Filter dan urutkan tugas; pilihan terakhir disimpan di browser.
10. Unggah foto, video, dan berkas lain ke bucket private.
11. Tampilkan tugas mendatang di Beranda dan tugas lama di Riwayat.
12. Tulis komentar di kelas atau di detail tugas.
13. Terima perubahan tugas, jadwal, komentar, dan lampiran secara real-time.
14. Ganti tema terang/gelap dan pasang aplikasi sebagai PWA.

## Mulai cepat dalam tiga langkah

1. Buka [aplikasi live TugasKu](https://c175244.github.io/tugasku/).
2. Tekan **Daftar**, lalu masukkan username, email, dan password. Konfirmasi
   email sedang dimatikan agar akun baru bisa langsung dipakai.
3. Buat kelas, bagikan kode room kepada teman, lalu mulai membuat tugas.

Kalau kamu ingin membuat salinan project dengan Supabase sendiri, ikuti
[panduan setup database](docs/SETUP-DATABASE.md) dan
[panduan deploy](docs/DEPLOY-GITHUB-PAGES.md). Kamu tidak perlu menempelkan
anon key ke halaman Setup pada project live ini.

## Struktur file

```text
index.html
manifest.webmanifest
favicon.svg
.nojekyll
assets/
  css/
    variables.css  base.css  glass.css  layout.css  components.css  themes.css
  js/
    main.js  config.js  supabaseClient.js  router.js  store.js  theme.js
    realtime.js
    api/          # pembungkus akses tabel dan RPC Supabase
    components/   # komponen UI kecil yang bisa dipakai ulang
    utils/        # DOM aman, tanggal, format, dan localStorage
    views/        # halaman hash route
docs/
  SETUP-DATABASE.md
  DEPLOY-GITHUB-PAGES.md
  KEAMANAN.md
supabase/
  schema.sql
  cron-cleanup.sql
tools/
  check.mjs
  preview.html
package.json
```

`tools/preview.html` adalah halaman preview offline untuk melihat semua view
dengan data contoh tanpa perlu membuat project Supabase terlebih dahulu.

## Teknologi

HTML, CSS, dan JavaScript ES modules tanpa build step, bundler, atau npm
runtime. Supabase JS v2.45.4 dimuat dari URL CDN yang dipatok. Router memakai
hash agar aman dipakai di GitHub Pages.

## Panduan lanjutan

1. [Setup database dan Google OAuth](docs/SETUP-DATABASE.md)
2. [Deploy dan edit dari HP](docs/DEPLOY-GITHUB-PAGES.md)
3. [Keamanan dan rotasi key](docs/KEAMANAN.md)
