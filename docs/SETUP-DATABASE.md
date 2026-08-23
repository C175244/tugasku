# Setup database Supabase dari HP

Ikuti langkah bernomor ini satu per satu. Jangan memasukkan
`service_role key` ke aplikasi.

## 1. Membuat project

1. Buka [supabase.com](https://supabase.com) dari browser HP dan daftar.
2. Tekan **New project**, pilih organisasi, lalu beri nama project.
3. Buat password database yang panjang dan simpan di pengelola password.
4. Pilih region **Singapore**, lalu tekan tombol untuk membuat project.
5. Tunggu sampai status project siap.
6. Buka **SQL Editor**, buat query baru, lalu buka
   `supabase/schema.sql` di GitHub.
7. Salin seluruh isi file itu, tempel ke SQL Editor, lalu tekan **Run**.
8. Jangan mengubah file `supabase/schema.sql` di repo. File itu adalah kontrak
   tabel, policy, RPC, dan bucket aplikasi.

## 2. Menyiapkan login email

1. Buka **Authentication → Providers → Email**.
2. Pastikan Email aktif.
3. Ada pilihan **Confirm email**. Jika aktif, pengguna harus menekan link
   konfirmasi sebelum bisa masuk.
4. Untuk percobaan pertama yang lebih mudah, matikan **Confirm email**, simpan,
   lalu hidupkan lagi nanti jika aplikasi sudah siap dipakai teman.
5. Jika pilihan tetap aktif, gunakan alamat email yang benar-benar bisa kamu
   buka untuk menekan link konfirmasi.

## 3. Membuat Google OAuth

1. Buka [Google Cloud Console](https://console.cloud.google.com/) dari HP.
2. Buat project Google baru atau pilih project yang sudah ada.
3. Buka **APIs & Services → OAuth consent screen**.
4. Pilih **External**.
5. Isi nama aplikasi, email dukungan, dan email kontak developer.
6. Pada scopes, gunakan data dasar akun (email dan profil) saja.
7. Tambahkan email kamu sendiri sebagai **Test user**, lalu simpan.
8. Buka **APIs & Services → Credentials → Create credentials →
   OAuth client ID**.
9. Pilih jenis **Web application**.
10. Pada **Authorized JavaScript origins**, tambahkan:
    `https://<username>.github.io`
    (tanpa nama repo di bagian ini).
11. Pada **Authorized redirect URIs**, tambahkan:
    `https://<PROJECT-REF>.supabase.co/auth/v1/callback`
12. Cari `<PROJECT-REF>` di Supabase pada **Settings → API → Project URL**.
    Contoh `https://abcxyz.supabase.co` berarti project ref-nya `abcxyz`.
13. Salin Client ID dan Client Secret dari Google Cloud.
14. Kembali ke Supabase, buka **Authentication → Providers → Google**, tempel
    kedua nilai itu, aktifkan provider, lalu simpan.
15. Akun Google dalam mode testing hanya bisa dipakai test user. Agar teman
    sekelas dapat login, aplikasi OAuth perlu dipublikasikan sesuai proses
    verifikasi Google.

## 4. Menyiapkan URL aplikasi

1. Di Supabase buka **Authentication → URL Configuration**.
2. Isi **Site URL** dengan:
   `https://<username>.github.io/tugasku/`
3. Tambahkan URL yang sama ke **Redirect URLs**.
4. Ganti `<username>` dengan username GitHub kamu dan pertahankan `/` terakhir.
5. Jika repo memakai nama berbeda, ganti `tugasku` dengan nama repo tersebut.

## 5. Memeriksa Storage dan mengambil key

1. Buka **Storage** dan pastikan bucket bernama `task-files` sudah ada.
2. Pastikan bucket itu **Private**, bukan Public.
3. Schema mengizinkan ukuran maksimum 50MB per file. Paket gratis Supabase
   menyediakan kira-kira 500MB database dan 1GB Storage; batas dapat berubah
   mengikuti kebijakan Supabase.
4. Buka **Settings → API**.
5. Salin **Project URL** dan **anon / public key**. Jangan salin
   `service_role key`.
6. Deploy aplikasi, buka halaman Setup, tempel dua nilai tersebut, lalu tekan
   **Simpan dan mulai**. Nilai ini tersimpan di browser HP itu.
7. Alternatifnya, edit `assets/js/config.js` di GitHub, lalu isi dua placeholder
   string di file tersebut. Anon key memang boleh ada di kode publik.

## 6. Menambah admin kedua

1. Minta orang tersebut membuat akun dan bergabung dengan kode room.
2. Buka kelas itu sebagai admin.
3. Pada daftar anggota, cari username orang tersebut.
4. Tekan **Jadikan admin**.
5. Beri tahu admin baru agar tidak menghapus atau mengubah jadwal sembarangan.

## 7. Project gratis yang berhenti sementara

1. Project Supabase gratis dapat dijeda setelah kira-kira satu minggu tidak
   aktif. Ini bukan berarti data langsung hilang.
2. Buka dashboard Supabase dan pilih project yang dijeda.
3. Tekan pilihan **Restore** atau **Resume project**, lalu tunggu sampai siap.
4. Coba buka aplikasi lagi setelah statusnya aktif.

## 8. Troubleshooting

1. **Invalid login credentials:** periksa email dan password, lalu pastikan
   kamu mendaftar di project Supabase yang sama.
2. **Email not confirmed:** tekan link di email konfirmasi, atau matikan
   **Confirm email** saat testing awal.
3. **row-level security policy:** biasanya akun belum menjadi anggota kelas,
   atau tindakan tersebut hanya boleh dilakukan admin.
4. **OAuth `redirect_uri_mismatch`:** cocokkan callback Google Cloud persis
   dengan URL `https://<PROJECT-REF>.supabase.co/auth/v1/callback`; origin
   GitHub Pages harus memakai domain tanpa nama repo.
5. **Upload ditolak karena file lebih dari 50MB:** kecilkan atau kompres file
   sebelum upload.
6. **Blank page setelah deploy:** cek nama file dan folder, termasuk huruf
   besar-kecil. Pastikan `index.html` ada di root, `.nojekyll` ikut ter-upload,
   dan buka Console jika browser menampilkannya.
