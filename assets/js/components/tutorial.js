// Tur interaktif aplikasi: masing-masing langkah MENUNJUK satu elemen nyata
// di layar (disorot, elemen lain gelap dan tidak bisa dipencet), lalu
// pengguna benar-benar memencet elemen itu untuk melanjut. Pengguna bisa
// "Lewati" kapan saja. Untuk pengguna baru, tur ini otomatis muncul.
import { el } from '../utils/dom.js';
import { STORAGE_KEYS } from '../utils/storageKeys.js';

// Satu langkah tur: apa yang ditunjuk (selector), judul, penjelasan.
const STEPS = [
  {
    sel: null,
    title: 'Selamat datang di TugasKu!',
    body: 'Ini tur singkat, langkah demi langkah. Setiap langkah akan menyorot SATU bagian layar — hanya bagian itu yang bisa kamu pencet; yang lain gelap sementara. Ikuti sampai selesai supaya paham semua fiturnya, atau tekan "Lewati" untuk langsung pakai.',
  },
  {
    sel: '.topbar .icon-btn[aria-label="Notifikasi dari developer"]',
    title: 'Ikon lonceng — Pengumuman',
    body: 'Ikon LONCENG di bar atas ini tempat semua pengumuman penting dari developer. Kalau ada popup pengumuman dan terlanjur kamu tutup, klik lonceng ini untuk membacanya lagi kapan saja. Coba klik sekarang — halaman Pengumuman akan terbuka.',
    advanceOnClick: true,
  },
  {
    sel: '.topbar .icon-btn[aria-label="Ganti tema"]',
    title: 'Ikon bulan/matahari — Ganti tema',
    body: 'Di samping lonceng ada ikon bulan/matahari. Fungsinya mengganti tema aplikasi: gelap atau terang. Coba klik — lihat tampilannya berubah.',
    advanceOnClick: true,
  },
  {
    sel: '.bottom-nav [data-nav="kelas"]',
    title: 'Menu Kelas — tempat mengelola kelasmu',
    body: 'Sekarang lihat bar paling bawah. Menu KELAS ini pintu masuk semua kelas yang kamu ikuti. Klik untuk membukanya.',
    advanceOnClick: true,
    toHash: '#/kelas',
  },
  {
    sel: null,
    title: 'Cara membuat kelas baru',
    body: 'Di halaman Kelas, cari tombol "Buat kelas". Isi nama kelasmu (misalnya "X RPL 1") lalu simpan. Otomatis dibuatkan KODE ROOM 6 karakter — itu kunci untuk mengundang teman. Kamu langsung jadi PEMILIK kelas.',
  },
  {
    sel: null,
    title: 'Cara menambah jadwal pelajaran',
    body: 'Setelah kelas dibuat, buka kelasnya. Di dalamnya ada bagian JADWAL — pilih hari, jam mulai-selesai, dan nama pelajaran (contoh: Matematika). Jadwal ini penting, karena saat buat tugas kamu memilih pelajaran dari sini.',
  },
  {
    sel: 'a[href="#/tugas/baru"]',
    title: 'Tombol tambah tugas',
    body: 'Tombol "+ Tambah tugas" ini untuk menambah tugas. Klik — akan terbuka formulir: isi judul tugas, pilih kelas & pelajaran, tentukan tanggal dan jam deadline. Semua anggota kelas langsung melihatnya. Kalau sedang tidak ingin buat, tutup formulirnya dan lanjut tur.',
    advanceOnClick: true,
    toHash: '#/tugas/baru',
  },
  {
    sel: null,
    title: 'Cara menambah anggota kelas',
    body: 'Di halaman kelas ada kode room 6 karakter. Salin kodenya, kirim ke temanmu. Temanmu buka tab KELAS, tekan "Gabung kelas", masukkan kodenya — langsung jadi anggota dan bisa melihat semua tugas.',
  },
  {
    sel: null,
    title: 'Cara menjadikan teman sebagai admin',
    body: 'Hanya PEMILIK kelas yang bisa. Buka halaman kelas, di daftar anggota tekan tombol di samping nama temanmu, pilih "Jadikan admin". Admin bisa bantu mengelola tugas, jadwal, dan anggota — cocok untuk ketua/wakil kelas. Pemilik tetap yang tertinggi.',
  },
  {
    sel: '.bottom-nav [data-nav="riwayat"]',
    title: 'Menu Riwayat — arsip tugas',
    body: 'Menu RIWAYAT berisi semua tugas yang sudah selesai atau sudah lewat deadline, jadi kamu bisa cek kembali pekerjaanmu. Klik untuk melihatnya.',
    advanceOnClick: true,
    toHash: '#/riwayat',
  },
  {
    sel: '.bottom-nav [data-nav="profil"]',
    title: 'Menu Profil — akunmu',
    body: 'Menu PROFIL untuk ubah nama, foto profil, username, pasang/ganti password, dan keluar akun. Klik untuk membukanya.',
    advanceOnClick: true,
    toHash: '#/profil',
  },
  {
    sel: null,
    title: 'Selesai — selamat belajar!',
    body: 'Kamu sudah tahu semua dasar TugasKu. Sekarang langsung praktik: buat kelas pertama, isi jadwal pelajarannya, undang teman sekelas, lalu tambah tugas pertama. Tur ini bisa dibuka ulang kapan saja lewat Profil, tombol "Ulangi tutorial". Semangat!',
  },
];

let active = null;

const end = () => {
  if (!active) return;
  const { overlay, target, cleanup } = active;
  cleanup?.();
  overlay.remove();
  if (target) target.classList.remove('tour-target');
  active = null;
};

// Membuat langkah: highlight elemen (jika ada), tampilkan panel teks.
const paintStep = (index) => {
  const { overlay, panel } = active;
  const step = STEPS[index];
  // Bersihkan sorotan langkah sebelumnya.
  const prev = document.querySelector('.tour-target');
  if (prev) prev.classList.remove('tour-target');

  let target = null;
  if (step.sel) target = document.querySelector(step.sel);
  active.target = target;
  if (target) target.classList.add('tour-target');

  panel.replaceChildren(
    el('h2', {}, step.title),
    el('p', { class: 'muted small' }, step.body),
    el('p', { class: 'muted small' }, `Langkah ${index + 1} dari ${STEPS.length}`),
    el('div', { class: 'row' },
      el('button', {
        class: 'btn btn-soft',
        type: 'button',
        onclick: () => { end(); },
      }, 'Lewati'),
      !step.advanceOnClick && el('button', {
        class: 'btn btn-primary',
        type: 'button',
        onclick: () => go(index + 1),
      }, index === STEPS.length - 1 ? 'Selesai' : 'Berikutnya'),
    ),
  );
  overlay.replaceChildren(panel);
};

const go = (index) => {
  if (index >= STEPS.length) { end(); return; }
  const step = STEPS[index];
  if (step.toHash) location.hash = step.toHash;
  active.index = index;
  // Beri waktu halaman berganti sebelum mencari elemen target.
  setTimeout(() => paintStep(index), 120);
};

// Memulai tur. onDone dipanggil saat ditutup.
export const showTutorial = (onDone = () => {}) => {
  if (active) return;
  const overlay = el('div', { class: 'tour-overlay' });
  const panel = el('div', { class: 'tour-panel glass stack' });
  overlay.append(panel);

  // Blok semua klik di aplikasi kecuali pada elemen target tur / panel.
  const onClick = (event) => {
    const target = active.target;
    const inPanel = panel.contains(event.target);
    const onTarget = target && target.contains(event.target);
    if (inPanel) return; // tombol Lewati/Berikutnya boleh
    if (onTarget) {
      // Biarkan elemen bekerja, lalu lanjut ke langkah berikutnya.
      const step = STEPS[active.index];
      if (step?.advanceOnClick) setTimeout(() => go(active.index + 1), 60);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };
  document.addEventListener('click', onClick, true);

  active = {
    overlay,
    panel,
    target: null,
    index: 0,
    cleanup: () => document.removeEventListener('click', onClick, true),
  };
  document.body.append(overlay);
  paintStep(0);
};

// Tampilkan otomatis sekali per pengguna (untuk akun baru).
export const maybeShowTutorial = (userId) => {
  const key = STORAGE_KEYS.tutorial(userId);
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, 'true');
  showTutorial();
};
