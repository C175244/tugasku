// Tur interaktif aplikasi, LANGKAH DEMI LANGKAH secara berurutan. Setiap
// langkah menyorot SATU elemen nyata di layar (yang lain digelapkan dan
// tidak bisa dipencet), dan pengguna memencet elemen itu untuk melanjut.
// Bila elemen tidak ditemukan (misalnya halaman masih memuat), tur
// menawarkan tombol "Berikutnya" supaya tidak macet.
import { el } from '../utils/dom.js';
import { STORAGE_KEYS } from '../utils/storageKeys.js';

// Urutan langkah. Field:
// - sel        : CSS selector elemen yang disorot (null = langkah teks saja)
// - advance    : true bila klik elemen itulah yang melanjutkan tur
// - toHash     : pindah ke halaman ini saat masuk langkah
const STEPS = [
  {
    title: 'Selamat datang di TugasKu!',
    body: 'Ini panduan langkah demi langkah. Setiap langkah akan menyorot SATU bagian layar — hanya bagian itu (dan tombol Lewati/Berikutnya) yang bisa kamu pencet. Ikuti terus sampai selesai supaya paham semuanya. Mau langsung pakai? Tekan "Lewati".',
  },
  {
    sel: '.topbar .icon-btn[aria-label="Notifikasi dari developer"]',
    title: '1. Ikon lonceng — Notifikasi',
    body: 'Ini ikon LONCENG di bar atas. Isinya semua pengumuman penting dari developer aplikasi. Coba KLIK ikonnya sekarang.',
    advance: true,
    toHash: '#/pengumuman',
  },
  {
    sel: '.panel.glass h1, .shell h1',
    title: '2. Ini halaman Pengumuman',
    body: 'Di halaman ini tiap pesan menampilkan ISI pesan, SIAPA yang mengirim (developer), dan KAPAN dikirimnya (waktu & tanggalnya). Kalau kosong, berarti belum ada pengumuman. Sekarang kita keluar dari halaman ini — klik tombol kembali (‹) di pojok kiri atas.',
  },
  {
    sel: '.topbar .icon-btn[aria-label="Kembali"]',
    title: '3. Tombol kembali',
    body: 'Klik tombol ‹ ini untuk kembali ke halaman sebelumnya.',
    advance: true,
    toHash: '#/dashboard',
  },
  {
    sel: '.topbar .icon-btn[aria-label="Ganti tema"]',
    title: '4. Ikon tema',
    body: 'Ikon bulan/matahari ini mengganti tema aplikasi antara gelap dan terang. Coba klik — lihat tampilannya berubah.',
    advance: true,
  },
  {
    sel: '.bottom-nav [data-nav="kelas"]',
    title: '5. Menu Kelas',
    body: 'Sekarang lihat bar paling bawah. Klik menu KELAS untuk membuka halaman kelasmu.',
    advance: true,
    toHash: '#/kelas',
  },
  {
    sel: '.btn.btn-soft[type="button"]:last-of-type, .row .btn.btn-soft',
    title: '6. Tombol Gabung',
    body: 'Tombol GABUNG ini untuk masuk ke kelas temanmu pakai kode room. Coba klik — akan terbuka formulirnya.',
    advance: true,
  },
  {
    sel: '.modal-backdrop input',
    title: '7. Kolom kode room',
    body: 'Di sinilah kamu mengetik KODE ROOM 6 karakter yang dibagikan temanmu. Kalau sudah diisi, tekan Gabung. Sekarang klik kolomnya untuk lanjut.',
    advance: true,
  },
  {
    sel: '.modal-backdrop .icon-btn[aria-label="Tutup"]',
    title: '8. Tombol tutup (×)',
    body: 'Tombol × ini menutup formulir tanpa menyimpan apa pun. Klik untuk menutupnya.',
    advance: true,
  },
  {
    sel: '.btn.btn-primary[type="button"]',
    title: '9. Tombol Buat kelas',
    body: 'Sekarang cara membuat kelasmu sendiri: klik tombol + BUAT ini.',
    advance: true,
  },
  {
    sel: '.modal-backdrop input',
    title: '10. Nama kelas',
    body: 'Ketik nama kelasmu di kolom ini, misalnya "XI IPA 1", lalu tekan tombol Buat kelas. Sistem otomatis membuatkan KODE ROOM 6 karakter — itu yang nanti kamu bagikan ke teman. Klik kolomnya untuk lanjut (tidak perlu benar-benar membuat sekarang).',
    advance: true,
  },
  {
    sel: '.modal-backdrop .icon-btn[aria-label="Tutup"]',
    title: '11. Tutup formulir',
    body: 'Klik × untuk menutup formulirnya.',
    advance: true,
  },
  {
    title: '12. Jadwal pelajaran',
    body: 'Setelah kelas dibuat, buka kelasnya. Di dalamnya ada bagian JADWAL — pilih hari, jam mulai-selesai, dan nama pelajarannya (contoh: Matematika). Jadwal ini penting diisi, karena saat menambah tugas kamu memilih pelajaran dari daftar ini.',
  },
  {
    sel: '.bottom-nav [data-nav="dashboard"]',
    title: '13. Menu Beranda',
    body: 'Klik menu BERANDA untuk kembali ke halaman tugas.',
    advance: true,
    toHash: '#/dashboard',
  },
  {
    sel: 'a[href="#/tugas/baru"]',
    title: '14. Tombol tambah tugas',
    body: 'Tombol "+ Tambah tugas" ini untuk menambah tugas: isi judul, pilih kelas & pelajaran, tentukan deadline. Semua anggota kelas langsung melihatnya. Klik untuk melihat formulirnya (tidak perlu benar-benar membuat).',
    advance: true,
    toHash: '#/tugas/baru',
  },
  {
    title: '15. Undang anggota & jadikan admin',
    body: 'Di halaman kelas ada kode room 6 karakter — salin dan kirim ke teman; temanmu gabung lewat tombol Gabung tadi. Untuk menjadikan teman ADMIN: hanya PEMILIK kelas yang bisa — buka daftar anggota, tekan tombol di samping namanya, pilih "Jadikan admin". Admin bisa membantu mengelola tugas dan jadwal.',
  },
  {
    sel: '.bottom-nav [data-nav="riwayat"]',
    title: '16. Menu Riwayat',
    body: 'Menu RIWAYAT berisi tugas yang sudah selesai atau lewat deadline. Klik untuk melihatnya.',
    advance: true,
    toHash: '#/riwayat',
  },
  {
    sel: '.bottom-nav [data-nav="profil"]',
    title: '17. Menu Profil',
    body: 'Terakhir, menu PROFIL untuk mengatur akunmu: nama, foto, username, password, dan pengaturan keamanan. Klik untuk membukanya.',
    advance: true,
    toHash: '#/profil',
  },
  {
    title: 'Selesai — selamat belajar!',
    body: 'Kamu sudah mengenal semua fitur TugasKu. Sekarang praktikkan: buat kelas pertamamu, isi jadwal pelajarannya, undang teman sekelas, lalu tambah tugas pertama. Tur ini bisa dibuka ulang kapan saja lewat Profil → "Ulangi tutorial". Semangat!',
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

const paintStep = (index) => {
  const { overlay, panel } = active;
  const step = STEPS[index];
  const prev = document.querySelector('.tour-target');
  if (prev) prev.classList.remove('tour-target');

  let target = step.sel ? document.querySelector(step.sel) : null;
  active.target = target;
  if (target) target.classList.add('tour-target');

  // Kalau elemennya tidak ketemu, jangan kunci pengguna — tawarkan lanjut.
  const canAdvanceByClick = Boolean(step.advance && target);
  const isLast = index === STEPS.length - 1;

  panel.replaceChildren(
    el('h2', {}, step.title),
    el('p', { class: 'muted small' }, step.body),
    !canAdvanceByClick && !isLast && el('p', { class: 'muted small' },
      '(Elemen tidak terlihat di layar ini — lanjutkan saja.)'),
    el('p', { class: 'muted small' }, `Langkah ${index + 1} dari ${STEPS.length}`),
    el('div', { class: 'row' },
      el('button', {
        class: 'btn btn-soft',
        type: 'button',
        onclick: () => end(),
      }, 'Lewati'),
      !canAdvanceByClick && el('button', {
        class: 'btn btn-primary',
        type: 'button',
        onclick: () => go(index + 1),
      }, isLast ? 'Selesai' : 'Berikutnya'),
    ),
  );
  overlay.replaceChildren(panel);
};

const go = (index) => {
  if (index >= STEPS.length) { end(); return; }
  const step = STEPS[index];
  if (step.toHash) location.hash = step.toHash;
  active.index = index;
  // Beri waktu halaman/modal berganti sebelum mencari elemen target.
  setTimeout(() => paintStep(index), 180);
};

export const showTutorial = (onDone = () => {}) => {
  if (active) return;
  const overlay = el('div', { class: 'tour-overlay' });
  const panel = el('div', { class: 'tour-panel glass stack' });
  overlay.append(panel);

  const onClick = (event) => {
    const target = active.target;
    const inPanel = panel.contains(event.target);
    const onTarget = target && target.contains(event.target);
    if (inPanel) return;
    if (onTarget) {
      const step = STEPS[active.index];
      if (step?.advance) setTimeout(() => go(active.index + 1), 150);
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

export const maybeShowTutorial = (userId) => {
  const key = STORAGE_KEYS.tutorial(userId);
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, 'true');
  showTutorial();
};
