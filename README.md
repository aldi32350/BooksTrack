# 📚 Books Track

Aplikasi pencatat bacaan untuk orang yang suka lupa sedang membaca buku apa dan sampai halaman berapa.
Berjalan 100% di browser (HTML + CSS + JavaScript murni), tanpa server, tanpa akun — cocok untuk GitHub Pages.

## Fitur
- **Dirancang untuk HP**: tab bar bawah, tombol **+ Catat** besar di tengah, form muncul dari bawah layar
- **Catat dalam 2 ketukan**: tekan +, geser halaman dengan tombol −/+ atau +5/+10/+20/+50, lalu Simpan
- **Bisa dipasang di layar utama HP** (PWA) dan tetap jalan tanpa internet
- **Rak buku** dengan status: Sedang Dibaca, Ingin Dibaca, Selesai, Ditunda, Berhenti (DNF)
- **Kartu "Sedang dibaca"** di atas: update halaman sekali klik, plus kapan terakhir dibaca
- **Pengingat otomatis** jika buku yang sedang dibaca belum dicatat selama N hari, dan jika buku pinjaman mendekati tanggal kembali
- **Detail buku lengkap**: judul, penulis, format (fisik/e-book/audiobook), halaman, tanggal mulai/selesai, genre, tag, penerbit, tahun, ISBN, bahasa, sumber/lokasi buku, tanggal kembali, sampul, rating, ulasan
- **Cari otomatis** data & sampul buku dari Open Library (judul atau ISBN)
- **Sesi membaca**: tanggal, halaman dari–sampai, durasi (ada timer), lokasi, mood, catatan
- **Catatan per halaman** dan **kutipan favorit**
- **Perhitungan otomatis**: progres %, kecepatan baca (hlm/jam), perkiraan sisa waktu, lama membaca
- **Statistik**: buku selesai per tahun & bulan, halaman per hari (14 hari), streak membaca, total waktu, genre favorit, target harian & tahunan
- **Ekspor/Impor** JSON (cadangan & pindah perangkat), ekspor CSV (Excel)
- Mode gelap/terang, responsif di HP, pintasan keyboard `N` (tambah buku) dan `C` (catat bacaan) di desktop

> Data disimpan di `localStorage` browser masing-masing pengguna. Gunakan **Lainnya → Ekspor cadangan** secara berkala sebagai cadangan.

## Menjalankan di localhost
Butuh Python (sudah terpasang di Windows kamu):

```bash
python -m http.server 5500
```

Lalu buka http://localhost:5500

## Deploy ke GitHub Pages
1. Buat repository baru di GitHub, misalnya `books-track` (Public).
2. Di folder proyek ini:

```bash
git init
git add .
git commit -m "Books Track"
git branch -M main
git remote add origin https://github.com/USERNAME/books-track.git
git push -u origin main
```

3. Di GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, pilih `main` dan folder `/ (root)`, klik **Save**.
4. Tunggu 1–2 menit, aplikasi tersedia di `https://USERNAME.github.io/books-track/`.

## Custom domain
1. Di **Settings → Pages → Custom domain**, isi domain kamu (misalnya `books.domainkamu.com`) lalu **Save**. GitHub otomatis membuat file `CNAME` di repo.
2. Atur DNS di penyedia domain:
   - **Subdomain** (`books.domainkamu.com`): buat record `CNAME` → `USERNAME.github.io`
   - **Domain utama** (`domainkamu.com`): buat 4 record `A` →
     `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
     (opsional `AAAA`: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`)
3. Setelah DNS aktif (bisa beberapa menit sampai 24 jam), centang **Enforce HTTPS**.

> Catatan: data `localStorage` terikat ke alamat situs. Jika pindah dari `github.io` ke custom domain, ekspor JSON dulu lalu impor di alamat baru.

## Struktur file
```
index.html   — tampilan
style.css    — gaya
app.js       — logika aplikasi
sw.js        — service worker (mode offline)
manifest.webmanifest, icon.svg — agar bisa dipasang di HP
.nojekyll    — agar GitHub Pages menyajikan file apa adanya
```
