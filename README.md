# Toko Kita

Aplikasi web kasir, stok, dan laporan untuk toko kelontong atau toko madura. Backend Node.js dengan Express dan SQLite, tampilan JavaScript murni tanpa proses build, sehingga mudah dijalankan dan dirawat.

## Fitur
- Kasir cepat dengan pencarian, filter kategori, uang pas, dan kembalian otomatis
- Manajemen produk dan kategori, stok otomatis berkurang saat transaksi
- Peringatan stok menipis dan habis
- Riwayat transaksi dengan rincian barang
- Laporan omzet, modal, pengeluaran, laba kotor, dan laba bersih (hari ini, 7 hari, bulan ini)
- Manajemen pengguna dengan peran admin dan kasir
- Responsif untuk desktop, tablet, dan HP

## Menjalankan (butuh Node.js 20 atau lebih baru)
```bash
npm install
npm start
```
Buka http://localhost:3000. Saat pertama kali jalan, akun `admin` dibuat dan **password acaknya tampil sekali di terminal**, jadi simpan. Untuk menentukan sendiri password awal:
```bash
# Linux / macOS
ADMIN_PASSWORD="passwordkuat123" npm start
# Windows PowerShell
$env:ADMIN_PASSWORD="passwordkuat123"; npm start
```

## Menjalankan dengan Docker
```bash
cp .env.example .env      # lalu isi ADMIN_PASSWORD
docker compose up -d --build
```
Database tersimpan di volume Docker `toko-data`.

## Database
Database SQLite dibuat otomatis di `data/toko.db` saat server pertama kali jalan. Folder `data/` tidak ikut repo ini, jadi setiap orang yang memakai aplikasi ini memiliki database sendiri. **Backup:** jalankan `node backup.js` (di Windows klik dua kali `backup.bat`). Aman dilakukan saat server hidup, hasilnya ada di folder `backup/` (30 file terakhir disimpan). Salin folder itu ke flashdisk atau cloud secara rutin. Di Windows, `jalankan.bat` adalah cara cepat menjalankan aplikasi.

## Data contoh dan perintah bantu
```bash
node seed.js              # isi data contoh (barang, transaksi 14 hari, pengeluaran, akun kasir1)
node seed.js kosongkan    # hapus semua barang, transaksi, pengeluaran (akun tetap)
node seed.js kategori     # isi kategori otomatis untuk barang yang belum punya
node akun.js              # lihat daftar akun
node akun.js reset <username> <password-baru> [admin|kasir]   # buat atau reset akun
```
Akun contoh `kasir1` (password `kasir12345`) hanya untuk uji coba. **Hapus atau ganti passwordnya** sebelum dipakai sungguhan. Dengan Docker, awali perintahnya dengan `docker compose exec toko`.

## Pengaturan (environment variable)
| Nama | Fungsi | Bawaan |
|---|---|---|
| `PORT` | Port server | `3000` |
| `ADMIN_PASSWORD` | Password awal admin | acak |
| `DB_PATH` | Lokasi file database | `data/toko.db` |
| `COOKIE_SECURE` | `1` jika memakai HTTPS | otomatis di production |
| `TRUST_PROXY` | `1` jika di belakang reverse proxy | nonaktif |

## Keamanan
Password di-hash dengan bcrypt, sesi memakai cookie HttpOnly dan SameSite=Strict, login dibatasi percobaannya, semua query memakai parameter, dan harga serta stok selalu dihitung di server. Jika diakses lewat internet, **wajib pasang HTTPS** (misalnya Caddy atau Cloudflare Tunnel), ganti semua password bawaan, dan atur `COOKIE_SECURE=1`.

## Struktur
```
server.js        API dan server
public/          tampilan (index.html, app.css, app.js)
seed.js, akun.js skrip bantu
Dockerfile, docker-compose.yml
```