// Tur interaktif TugasKu: tooltip yang mengarah ke elemen nyata di layar.
// Hanya elemen yang disorot (dan tombol di tooltip) yang bisa dipencet.
// Urutannya runtut mengikuti alur penggunaan nyata.
import { el } from '../utils/dom.js';
import { STORAGE_KEYS } from '../utils/storageKeys.js';

// Satu langkah tur:
// - sel        : selector elemen yang disorot & hanya itu yang bisa dipencet
// - position   : 'top' | 'bottom' | 'center' — posisi tooltip rel ke elemen
// - advance    : true bila klik elemen itulah yang melanjutkan (tanpa tombol
//                Berikutnya di tooltip)
// - toHash     : pindah ke halaman ini sebelum mencari elemen
// - confirmed  : bila true, tur menunggu klik elemen, bukan tombol
const STEPS = [
  {
    title: '🎉 Selamat datang di TugasKu!',
    body: 'Ikuti tur singkat ini. Setiap langkah hanya SATU bagian layar yang kamu pencet — yang lain digelapkan. Selesaikan supaya langsung paham semua fiturnya. Mau langsung pakai? Tekan "Lewati". Tinggal 13 langkah.',
    position: 'center',
  },
  {
    sel: '.topbar .icon-btn[aria-label="Notifikasi dari developer"]',
    title: 'Lonceng — Pengumuman',
    body: 'Ikon LONCENG di bar atas ini berisi semua pengumuman penting dari developer aplikasi (misal fitur baru atau perbaikan bug). Klik ikonnya untuk membukanya.',
    position: 'bottom',
    advance: true,
    toHash: '#/pengumuman',
  },
  {
    sel: '.shell .panel.glass h1',
    title: 'Halaman Pengumuman',
    body: 'Di halaman ini setiap pengumuman menampilkan PENGIRIM (developer), WAKTU & TANGGAL dikirim, dan ISI pesannya. Kalau kosong, berarti belum ada pengumuman. Sekarang keluar dari halaman ini — di pojok kiri atas ada tombol ‹ kembali. Klik tombolnya.',
    position: 'bottom',
    advance: true,
    toHash: '#/dashboard',
  },
  {
    sel: '.topbar .icon-btn[aria-label="Ganti tema"]',
    title: 'Ikon Tema',
    body: 'Ikon bulan/matahari di bar atas ini mengganti tampilan aplikasi antara gelap dan terang. Coba klik untuk merasakannya.',
    position: 'bottom',
    advance: true,
  },
  {
    sel: '.bottom-nav [data-nav="kelas"]',
    title: 'Menu Kelas',
    body: 'Menu KELAS di bar bawah ini pintu masuk semua kelas yang kamu ikuti. Klik untuk membukanya.',
    position: 'top',
    advance: true,
    toHash: '#/kelas',
  },
  {
    sel: '.row button.btn-soft',
    title: 'Tombol "Gabung"',
    body: 'Tombol GABUNG ini untuk masuk ke kelas temanmu pakai kode room. Klik untuk melihat formulirnya.',
    position: 'bottom',
    advance: true,
  },
  {
    sel: '.modal-backdrop input',
    title: 'Kolom Kode Room',
    body: 'Di kolom ini kamu mengetik KODE ROOM 6 karakter yang dibagikan temanmu. Misalnya "ABC123". Kalau sudah, tekan tombol Gabung. Sekarang tutup formulir ini — klik tombol × di pojok kanan atas formulir.',
    position: 'bottom',
    advance: true,
  },
  {
    sel: '.row button.btn-primary',
    title: 'Tombol "+ Buat"',
    body: 'Sekarang cara membuat kelasmu sendiri. Klik tombol + BUAT ini.',
    position: 'bottom',
    advance: true,
  },
  {
    sel: '.modal-backdrop input',
    title: 'Nama Kelas',
    body: 'Ketik nama kelasmu di sini, misalnya "XI IPA 1". Setelah itu tekan Buat kelas — sistem otomatis membuatkan KODE ROOM 6 karakter yang nanti kamu bagikan ke teman. Kamu langsung jadi PEMILIK. Tutup formulir ini dengan tombol ×.',
    position: 'bottom',
    advance: true,
  },
  {
    title: 'Isi Jadwal Pelajaran',
    body: 'Sudah punya kelas? Buka kelasnya, di dalamnya ada bagian JADWAL. Pilih HARI (Senin–Minggu), ISI JAM mulai & selesai, dan NAMA PELAJARAN (contoh: Matematika). Jadwal ini penting diisi, karena saat menambah tugas nanti kamu memilih pelajaran dari daftar ini.',
    position: 'center',
  },
  {
    sel: '.bottom-nav [data-nav="dashboard"]',
    title: 'Menu Beranda',
    body: 'Klik menu BERANDA untuk kembali ke halaman tugas.',
    position: 'top',
    advance: true,
    toHash: '#/dashboard',
  },
  {
    sel: 'a.btn[href="#/tugas/baru"]',
    title: 'Tombol Tambah Tugas',
    body: 'Tombol "+ Tambah tugas" ini untuk menambah tugas baru. Klik untuk melihat formulirnya.',
    position: 'bottom',
    advance: true,
    toHash: '#/tugas/baru',
  },
  {
    sel: '#task-form, .shell form',
    title: 'Formulir Tugas',
    body: 'Di formulir ini: ketik JUDUL tugas (misal: "Bikin presentasi"), pilih KELAS, pilih PELAJARAN (yang sudah kamu isi di jadwal tadi), lalu tentukan TANGGAL & JAM DEADLINE. Semua anggota kelas langsung melihatnya. Tutup formulir ini dan kembali dengan tombol kembali (†) di atas.',
    position: 'center',
    advance: true,
    toHash: '#/dashboard',
  },
  {
    title: 'Undang Teman & Jadikan Admin',
    body: 'Di halaman kelas ada kode room 6 karakter. Salin kodenya, kirim ke temanmu. Temanmu buka tab Kelas → tombol Gabung → masukkan kodenya. Untuk menjadikan teman sebagai ADMIN: hanya PEMILIK kelas yang bisa — buka daftar anggota, tekan tombol di samping namanya, pilih "Jadikan admin". Admin bisa membantu mengelola tugas dan jadwal.',
    position: 'center',
  },
  {
    sel: '.bottom-nav [data-nav="riwayat"]',
    title: 'Menu Riwayat',
    body: 'Menu RIWAYAT berisi tugas yang sudah selesai atau sudah lewat deadline — jadi kamu bisa cek kembali pekerjaanmu. Klik untuk melihatnya.',
    position: 'top',
    advance: true,
    toHash: '#/riwayat',
  },
  {
    sel: '.bottom-nav [data-nav="profil"]',
    title: 'Menu Profil',
    body: 'Terakhir, menu PROFIL untuk mengatur akunmu: nama, foto, username, password, dan pengaturan keamanan (daftar perangkat yang sedang login). Klik untuk membukanya.',
    position: 'top',
    advance: true,
    toHash: '#/profil',
  },
  {
    title: '✅ Selesai! Selamat belajar',
    body: 'Kamu sudah mengenal seluruh TugasKu. Sekarang langsung praktik: buat kelas pertamamu → isi jadwal pelajarannya → undang teman sekelas → tambah tugas pertama. Tur ini bisa dibuka ulang kapan saja lewat Profil → "Ulangi tutorial". Semangat!',
    position: 'center',
  },
];

let active = null;

const end = () => {
  if (!active) return;
  const { overlay, panel, tooltip, cleanup } = active;
  cleanup?.();
  overlay.remove();
  panel.remove();
  tooltip.remove();
  document.querySelector('.tour-target')?.classList.remove('tour-target');
  active = null;
};

// Memposisikan tooltip relatif ke elemen target.
const placeTooltip = (target, tooltip, position) => {
  if (!target || position === 'center') {
    tooltip.style.left = '50%';
    tooltip.style.top = '50%';
    tooltip.style.transform = 'translate(-50%, -50%)';
    return;
  }
  const rect = target.getBoundingClientRect();
  const tw = Math.min(360, window.innerWidth - 24);
  tooltip.style.width = `${tw}px`;
  const twActual = tooltip.offsetWidth || tw;
  const th = tooltip.offsetHeight || 180;
  const gap = 14;
  let left = rect.left + rect.width / 2 - twActual / 2;
  left = Math.max(8, Math.min(window.innerWidth - twActual - 8, left));
  tooltip.style.left = `${left}px`;
  tooltip.style.transform = '';
  if (position === 'bottom') {
    tooltip.style.top = `${rect.bottom + gap}px`;
  } else if (position === 'top') {
    tooltip.style.top = `${rect.top - th - gap}px`;
  } else {
    tooltip.style.top = `${rect.top - th / 2 + rect.height / 2}px`;
    tooltip.style.left = `${rect.right + gap}px`;
  }
};

const paintStep = (index) => {
  const { overlay, panel, tooltip } = active;
  const step = STEPS[index];
  document.querySelector('.tour-target')?.classList.remove('tour-target');

  let target = step.sel ? document.querySelector(step.sel) : null;
  active.target = target;
  if (target) {
    target.classList.add('tour-target');
    // Gulir ke elemen supaya terlihat di layar.
    target.scrollIntoView({ block: 'center', behavior: 'auto' });
  }

  const canAdvanceByClick = Boolean(step.advance && target);
  const isLast = index === STEPS.length - 1;

  panel.style.display = 'none';
  tooltip.replaceChildren(
    el('div', { class: 'tour-caret' }),
    el('h3', {}, step.title),
    el('p', { class: 'tour-body' }, step.body),
    el('p', { class: 'tour-meta' }, `Langkah ${index + 1} dari ${STEPS.length}`),
    el('div', { class: 'tour-actions' },
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

  placeTooltip(target, tooltip, step.position);
};

const go = (index) => {
  if (index >= STEPS.length) { end(); return; }
  const step = STEPS[index];
  if (step.toHash) location.hash = step.toHash;
  active.index = index;
  setTimeout(() => paintStep(index), 180);
};

export const showTutorial = (onDone = () => {}) => {
  if (active) return;
  const overlay = el('div', { class: 'tour-overlay' });
  const panel = el('div'); // disembunyikan, hanya jadi penampung
  const tooltip = el('div', { class: 'tour-tooltip glass stack' });
  document.body.append(overlay, panel, tooltip);

  const onClick = (event) => {
    const target = active.target;
    const inTooltip = tooltip.contains(event.target);
    const onTarget = target && target.contains(event.target);
    if (inTooltip) return;
    if (onTarget) {
      const step = STEPS[active.index];
      if (step?.advance) setTimeout(() => go(active.index + 1), 220);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };
  const onResize = () => {
    if (!active) return;
    placeTooltip(active.target, tooltip, STEPS[active.index].position);
  };
  document.addEventListener('click', onClick, true);
  window.addEventListener('resize', onResize);

  active = {
    overlay,
    panel,
    tooltip,
    target: null,
    index: 0,
    cleanup: () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('resize', onResize);
    },
  };
  paintStep(0);
};

export const maybeShowTutorial = (userId) => {
  const key = STORAGE_KEYS.tutorial(userId);
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, 'true');
  showTutorial();
};
