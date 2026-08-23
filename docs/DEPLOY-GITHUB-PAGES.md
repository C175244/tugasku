# Deploy TugasKu ke GitHub Pages dari HP

## 1. Membuat dan mengisi repository

1. Buka GitHub dari browser HP dan buat repository baru, misalnya `tugasku`.
2. Jika repo sudah punya README bawaan, boleh pertahankan atau ganti dengan
   README dari folder ini.
3. Buka repo, tekan **Add file → Upload files**.
4. Upload semua file dan folder, termasuk `.nojekyll`, `assets`, `docs`,
   `supabase`, `tools`, dan `index.html`.
5. Gulir ke bawah, isi pesan singkat, lalu tekan **Commit changes** ke branch
   `main`.

## 2. Mengaktifkan Pages

1. Buka tab **Settings** repository.
2. Pilih **Pages** di menu kiri.
3. Pada **Build and deployment**, pilih **Deploy from a branch**.
4. Pilih branch `main` dan folder `/ (root)`.
5. Tekan **Save**.
6. Tunggu sekitar 1–3 menit. GitHub akan menampilkan link situs.
7. Buka `https://<username>.github.io/tugasku/` dan ganti placeholder
   username sesuai akunmu.

## 3. Mengedit dari HP

1. Buka file di GitHub, lalu tekan ikon pensil.
2. Ubah bagian kecil yang diperlukan saja.
3. Gulir ke bawah dan tekan **Commit changes**.
4. Tunggu deployment Pages selesai sebelum mengecek hasilnya.
5. Jika perubahan belum terlihat, lakukan hard refresh dari menu browser.
   Mode samaran juga bisa membantu karena cache browser HP.
6. Nama file dan folder peka huruf besar-kecil. `TaskCard.js` dan `taskCard.js`
   dianggap dua file berbeda; jangan mengubah kapitalisasi import secara asal.

## 4. Setelah situs online

1. Masukkan Project URL dan anon key di halaman Setup.
2. Jika Google login dipakai, masukkan alamat Pages yang tepat ke Site URL dan
   Redirect URLs Supabase.
3. Jangan menaruh `service_role key` di file aplikasi.
4. Jika halaman putih, periksa Actions/Pages untuk status deployment, lalu
   pastikan `index.html` ada di root dan semua path import memakai kapitalisasi
   yang sama.
