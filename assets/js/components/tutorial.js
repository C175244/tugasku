// Tutorial selangkah demi selangkah untuk pengguna baru: menjelaskan fungsi
// tombol di aplikasi dan alur utama (buat kelas, isi jadwal, tambah tugas,
// undang teman, jadikan admin). Bisa dilewati kapan saja.
import { el } from '../utils/dom.js';
import { STORAGE_KEYS } from '../utils/storageKeys.js';

const STEPS = [
  {
    title: 'Selamat datang di TugasKu!',
    body: [
      'TugasKu adalah aplikasi untuk mencatat tugas sekolah dan membagikannya ke teman sekelas, jadi tidak ada lagi tugas yang terlewat.',
      'Kenali dulu layarnya. Di bar paling atas ada nama halaman, ikon LONCENG (pengumuman penting dari developer), dan ikon bulan/matahari (ganti tema gelap atau terang).',
      'Di bar paling bawah ada 4 menu utama: BERANDA (tugas aktif), KELAS (daftar kelasmu), RIWAYAT (tugas selesai/lewat), dan PROFIL (pengaturan akun).',
      'Tekan "Berikutnya" untuk ikut tur singkatnya, atau "Lewati" kalau mau langsung pakai aplikasinya.',
    ],
  },
  {
    title: 'Beranda: pusat tugasmu',
    body: [
      'Beranda menampilkan semua tugas yang masih aktif dari setiap kelas yang kamu ikuti.',
      'Tugas dengan deadline paling dekat muncul paling atas, lengkap dengan label waktu seperti "hari ini" atau "2 hari lagi", supaya kamu tahu mana yang harus dikerjakan duluan.',
      'Ada juga ringkasan progres tugasmu dan tombol hijau "+" untuk menambah tugas baru (dibahas di langkah ke-5).',
    ],
  },
  {
    title: 'Cara membuat kelas',
    body: [
      'Buka tab KELAS di bar bawah, lalu tekan tombol "Buat kelas".',
      'Isi nama kelasmu, misalnya "X RPL 1", lalu simpan. Selesai!',
      'Sistem otomatis membuat KODE ROOM 6 karakter. Kode inilah kunci kelasmu — simpan baik-baik, nanti dipakai untuk mengundang teman.',
      'Kamu otomatis menjadi PEMILIK kelas. Pemilik punya wewenang penuh dan tidak bisa dikeluarkan oleh siapa pun.',
    ],
  },
  {
    title: 'Cara menambah jadwal pelajaran',
    body: [
      'Buka kelasmu dari tab Kelas, lalu cari bagian "Jadwal".',
      'Tambah jadwal: pilih HARI (Senin sampai Minggu), JAM mulai dan selesai, serta NAMA pelajarannya, misalnya "Matematika".',
      'Jadwal ini penting diisi dulu, karena saat membuat tugas kamu akan memilih pelajaran dari daftar jadwal ini.',
    ],
  },
  {
    title: 'Cara menambah tugas',
    body: [
      'Tekan tombol hijau "+" di Beranda, atau buka kelasmu lalu tambah tugas dari sana.',
      'Isi JUDUL tugas, pilih KELAS dan PELAJARAN, lalu tentukan tanggal dan jam DEADLINE-nya. Terakhir tekan simpan.',
      'Kamu juga bisa menambah lampiran/link dan komentar untuk informasi tambahan seperti halaman buku atau catatan guru.',
      'Begitu disimpan, tugas langsung terlihat oleh SEMUA anggota kelas — tidak perlu kirim satu-satu.',
    ],
  },
  {
    title: 'Cara menambah anggota kelas',
    body: [
      'Di halaman kelas ada kode room 6 karakter. Salin kode itu, lalu bagikan ke temanmu lewat chat atau media sosial.',
      'Temanmu tinggal buka tab KELAS, tekan "Gabung kelas", masukkan kodenya — langsung jadi anggota.',
      'Anggota baru otomatis bisa melihat jadwal pelajaran dan semua tugas di kelas itu.',
    ],
  },
  {
    title: 'Cara menjadikan orang lain admin',
    body: [
      'Hanya PEMILIK kelas yang bisa melakukan ini.',
      'Buka halaman kelas, lihat daftar anggota, lalu tekan tombol di samping nama teman yang kamu percaya.',
      'Pilih "Jadikan admin". Admin bisa membantu mengelola tugas, jadwal, dan anggota — cocok untuk ketua kelas atau wakilnya.',
      'Tenang, pemilik tetap level tertinggi: admin tidak bisa mengeluarkan atau mengubah pemilik.',
    ],
  },
  {
    title: 'Riwayat, pengumuman, dan profil',
    body: [
      'RIWAYAT berisi semua tugas yang sudah selesai atau sudah lewat deadline, jadi kamu bisa mengecek apa saja yang sudah dikerjakan.',
      'Ikon LONCENG di bar atas berisi pengumuman penting dari developer. Kalau popup-nya terlanjur ditutup, buka lagi lewat ikon ini kapan saja.',
      'PROFIL adalah tempat mengubah nama, foto profil, dan username, memasang atau mengganti password, serta tombol keluar akun.',
    ],
  },
  {
    title: 'Selesai, selamat belajar!',
    body: [
      'Itu tadi semua dasar-dasarnya. Tutorial ini bisa dibuka lagi kapan saja lewat Profil, tombol "Ulangi tutorial".',
      'Sekarang coba langsung: buat kelas pertamamu, isi jadwal pelajarannya, undang teman sekelas, lalu tambah tugas pertama. Semangat!',
    ],
  },
];

// Menampilkan overlay tutorial. onDone dipanggil saat ditutup (lewati/selesai).
export const showTutorial = (onDone = () => {}) => {
  let step = 0;
  const body = el('div', { class: 'stack' });
  const counter = el('p', { class: 'muted small' });
  const skip = el('button', {
    class: 'btn btn-soft',
    type: 'button',
  }, 'Lewati');
  const next = el('button', {
    class: 'btn btn-primary',
    type: 'button',
  }, 'Berikutnya');
  const close = () => {
    backdrop.remove();
    onDone();
  };
  skip.addEventListener('click', close);
  next.addEventListener('click', () => {
    if (step >= STEPS.length - 1) {
      close();
      return;
    }
    step += 1;
    paint();
  });
  const paint = () => {
    const current = STEPS[step];
    counter.textContent = `Langkah ${step + 1} dari ${STEPS.length}`;
    next.textContent = step === STEPS.length - 1 ? 'Selesai' : 'Berikutnya';
    body.replaceChildren(
      el('h2', {}, current.title),
      ...current.body.map((text) => el('p', { class: 'muted small' }, text)),
    );
  };
  const backdrop = el('div', { class: 'modal-backdrop' },
    el('div', {
      class: 'modal glass stack',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Tutorial TugasKu',
    },
    body,
    counter,
    el('div', { class: 'row' }, skip, next)));
  paint();
  document.body.append(backdrop);
};

// Menampilkan tutorial otomatis sekali per pengguna (untuk akun baru).
export const maybeShowTutorial = (userId) => {
  const key = STORAGE_KEYS.tutorial(userId);
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, 'true');
  showTutorial();
};
