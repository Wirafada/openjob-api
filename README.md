# OpenJob RESTful API V2 — Revisi Struktur Submission

Paket berisi dua aplikasi Node.js independen: `openjob_api` dan
`openjob_consumer`. Setiap aplikasi memiliki package.json, package-lock.json,
.env.example, serta konfigurasi lokal sendiri. Tidak ada impor file antarfolder.
API/publisher dan consumer bertukar pesan melalui RabbitMQ; keduanya terhubung
ke database PostgreSQL OpenJob yang sama untuk mengambil data lamaran.

## Kebutuhan

Gunakan Node.js 22 atau versi lebih baru yang memenuhi engines dependensi,
PostgreSQL, Redis, RabbitMQ, dan SMTP yang dapat digunakan.
Jalankan semua perintah dari folder aplikasi yang disebutkan.
Untuk PowerShell yang memblokir npm.ps1, gunakan `npm.cmd` sebagai pengganti `npm`.

## 1. Konfigurasi dan instalasi

- Salin `openjob_api/.env.example` menjadi `openjob_api/.env`.
- Salin `openjob_consumer/.env.example` menjadi `openjob_consumer/.env`.
- Isi PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE pada kedua aplikasi
  agar menunjuk database yang sama; buat database terlebih dahulu jika belum ada.
- Isi RABBITMQ_HOST, RABBITMQ_PORT, RABBITMQ_USER, RABBITMQ_PASSWORD,
  RABBITMQ_QUEUE pada kedua aplikasi dengan koneksi dan antrean yang sama.
- Isi MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASSWORD, MAIL_FROM dan MAIL_SECURE
  pada consumer dengan akun SMTP milik Anda.
- Isi ACCESS_TOKEN_KEY dan REFRESH_TOKEN_KEY pada API dengan secret sendiri.
- Isi REDIS_HOST dan REDIS_PORT pada API. Aktifkan Redis dan RabbitMQ.
- Jalankan `npm ci` masing-masing di folder `openjob_api` dan `openjob_consumer`.

Jika memakai konfigurasi proyek lama, salin nilai variabel yang relevan ke masing-
masing .env. Secret token API sebaiknya tetap memakai nilai lama untuk pengujian
lanjutan dengan token yang sama. Jangan unggah .env asli.

## 2. Migrasi — hanya di openjob_api

```sh
npm run migrate up
```

Pada revisi timestamp ini WAJIB gunakan database baru, sesuai MULAI_DI_SINI.txt.
Riwayat migrasi database lama menggunakan nama berbeda; jangan menjalankan
file migrasi revisi ini pada database lama. Database lama tetap disimpan.
Consumer memakai tabel yang dibuat oleh migrasi API, termasuk notification_deliveries.
Jangan menjalankan dua set migrasi pada database yang sama.

## 3. Jalankan di tiga terminal

Terminal 1, folder `openjob_api`:

```sh
npm run start:dev
```

Terminal 2, folder `openjob_api`:

```sh
npm run start:publisher
```

Terminal 3, folder `openjob_consumer`:

```sh
npm start
```

Publisher adalah bagian dari aplikasi API yang meneruskan transactional outbox.
Consumer berjalan sebagai proyek terpisah. Hentikan consumer lama dari proyek
sebelumnya agar pesan tidak diambil oleh proses lama selama pengujian revisi.

## Alur notifikasi

POST /applications menyimpan lamaran dan notification_outbox dalam satu transaksi.
Publisher mengirim JSON yang hanya berisi application_id ke antrean durable.
Consumer mengambil identitas pelamar dan pemilik lowongan dari PostgreSQL,
lalu mengirim email kepada pemilik lowongan (jobs.created_by).
Isi email memuat nama dan email pelamar, serta tanggal melamar.
Pesan gagal permanen dipindahkan ke antrean berakhiran .failed.

## Pengujian

Jalankan collection V2 dengan environment sesuai PORT API. Dokumen diuji manual
sesuai panduan kelas. Upload menerima MIME application/pdf, isi diawali %PDF-,
file tidak kosong, maksimal 5 * 1024 * 1024 byte. Berkas tersimpan di
openjob_api/uploads/documents; direktori dibuat otomatis saat upload.

Hasil 421/421 berasal dari run pengguna sebelum pemisahan. Routes, validator,
middleware, utilitas cache, server, publisher, dan isi consumer
pada revisi ini dipertahankan dari ZIP pengguna.
File migrasi dibuat ulang melalui CLI asli dengan timestamp otomatis; definisi
skema sama, ekspor diseragamkan ke CommonJS. Lihat MIGRATION_GENERATION.log. Full run setelah pemisahan
masih perlu dijalankan dengan layanan pengguna.
Untuk tes email, pertahankan lamaran dan lowongan sampai consumer memprosesnya;
cleanup collection yang terlalu cepat dapat membuat lamaran tidak ditemukan.
Koneksi SMTP berhasil tidak dengan sendirinya membuktikan email diterima pemilik.

## Pengemasan

Unggah ZIP ini sebagai satu submission. Di dalamnya terdapat kedua aplikasi.
Jangan sertakan node_modules, .env asli, atau dokumen pribadi hasil upload.
