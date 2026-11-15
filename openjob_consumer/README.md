# OpenJob Consumer

Lihat ../README.md untuk instalasi lengkap.

`npm ci` → konfigurasi .env → `npm start`.
Aplikasi ini memiliki seluruh dependensi dan konfigurasi sendiri.
Database disiapkan melalui migrasi pada openjob_api; koneksi PG dan RabbitMQ
harus sesuai dengan API. Kredensial MAIL diisi pada .env consumer.
