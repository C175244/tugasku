# Keamanan TugasKu dengan bahasa sederhana

## 1. Apa yang dilindungi

1. Saat browser mengirim data ke Supabase, koneksinya memakai HTTPS/TLS.
   Orang di Wi-Fi yang sama tidak seharusnya bisa membaca isi lalu lintas.
2. Supabase mengenkripsi data saat disimpan (encryption at rest) pada Postgres
   dan Storage. Ini melindungi media penyimpanan server jika perangkat server
   dicuri.
3. Password ditangani Supabase Auth dan di-hash dengan bcrypt. TugasKu tidak
   pernah menyimpan password di tabel aplikasi, dan password tidak bisa dibaca
   kembali oleh aplikasi.

## 2. RLS adalah pagar utama

1. RLS (Row Level Security) adalah aturan database yang menentukan baris mana
   yang boleh dilihat atau diubah oleh setiap akun.
2. Contohnya, tabel `task_progress` memiliki `user_id`. Policy membatasi
   status selesai agar setiap orang hanya dapat membaca dan mengubah baris
   miliknya sendiri. Status hijau Bayu tidak bisa mengubah status merah Sinta.
3. Menyembunyikan tombol saja bukan keamanan. Policy RLS tetap menjadi batas
   yang sebenarnya.
4. Untuk memeriksa RLS semua tabel publik, buka SQL Editor dan jalankan:

```sql
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

5. Setiap baris tabel aplikasi harus menunjukkan `rowsecurity = true`.

## 3. Keamanan file dan anon key

1. Bucket `task-files` bersifat Private. File hanya dibuka dengan signed URL
   yang dibuat sementara, lalu URL tersebut kedaluwarsa.
2. Path file dimulai dengan ID kelas agar policy Storage bisa memeriksa anggota
   kelas.
3. Anon key boleh berada di JavaScript publik. Key itu hanya identitas akses
   publik, bukan password admin.
4. Dengan anon key saja, penyerang tetap tidak boleh membaca kelas yang bukan
   anggotanya, mengubah data admin, membaca progress milik orang lain, atau
   memperoleh file private tanpa policy dan signed URL yang sah.
5. Jangan pernah commit `service_role key`. Key itu melewati RLS dan memiliki
   hak sangat besar. Simpan hanya di lingkungan server yang aman.
6. Personal access token (PAT) Supabase juga merupakan rahasia. Jangan
   membagikan atau memasukkan PAT ke commit, screenshot, chat, atau
   `config.js`.

## 4. Jika key bocor

1. Jika `service_role key` pernah masuk GitHub, anggap key itu sudah bocor.
2. Buka pengaturan API Supabase dan rotasi/buat key baru.
3. Ganti anon key di halaman Setup atau `assets/js/config.js`.
4. Periksa commit lama dan hapus rahasia dari riwayat sesuai panduan GitHub.
5. Jangan mematikan RLS sebagai cara memperbaiki error.

Jika kamu pernah membuat personal access token Supabase untuk setup, segera
revoke token tersebut setelah selesai dipakai melalui pengaturan akun Supabase.
Buat token baru hanya saat benar-benar diperlukan, dan simpan di password
manager. Anon key frontend berbeda dari PAT: anon key memang dirancang untuk
berada di aplikasi publik, sedangkan PAT dan `service_role key` tidak boleh
berada di browser.

## 5. Kebiasaan aman

1. Aktifkan 2FA di akun GitHub melalui **Settings → Password and
   authentication → Two-factor authentication**.
2. Aktifkan 2FA di Supabase pada pengaturan akun.
3. Gunakan password unik untuk email dan database.
4. Jangan mengirim key lewat chat kelas atau memasukkannya ke screenshot.
5. Saat selesai memakai HP umum, keluar dari GitHub dan Supabase.

## 6. Kick, blokir, dan konsol developer

1. Kick kelas dicatat di tabel `class_bans` bersama alasannya. Pengguna yang
   dikeluarkan hanya bisa membaca catatan miliknya sendiri lewat RLS.
2. Kode join ulang disimpan di `class_rejoin_codes` tanpa policy publik;
   hanya fungsi RPC yang boleh membuat, membaca, dan menandainya terpakai.
   Kode hanya dibuat saat admin/owner/developer menekan tombol, berlaku 7
   hari, dan hangus setelah dipakai sekali.
3. Konsol developer (`developer.html`) tidak mengandalkan penyembunyian
   tampilan: semua datanya keluar dari fungsi `dev_*` yang memeriksa
   keanggotaan `app_developers` di database. Akun biasa mendapat hasil kosong.
4. Ban global ditegakkan di database lewat `assert_not_banned` pada pembuatan
   kelas, gabung kelas, dan trigger komentar, sehingga tetap berlaku walau
   pengguna mengakali tampilan.
5. Verifikasi anti-bot (Turnstile) wajib di halaman konsol developer dan hanya
   muncul di aplikasi utama saat aktivitas komentar tidak wajar. Pagar
   terakhir tetap di database: trigger membatasi 20 komentar per menit per
   akun, jadi spam terhenti walau captcha belum dikonfigurasi.
