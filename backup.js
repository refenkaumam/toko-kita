// Backup database dengan aman (boleh dijalankan saat server hidup). Hasil: folder backup/toko-TANGGAL.db
// Menyimpan 30 backup terakhir. Jalankan: node backup.js
const Database = require('better-sqlite3'), fs = require('fs'), path = require('path');
const src = process.env.DB_PATH || 'data/toko.db';
if (!fs.existsSync(src)) { console.log('Database belum ada di ' + src); process.exit(1); }
fs.mkdirSync('backup', { recursive: true });
const p = n => String(n).padStart(2, '0'), d = new Date();
const name = `toko-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.db`;
const db = new Database(src);
db.backup(path.join('backup', name)).then(() => {
  const old = fs.readdirSync('backup').filter(f => /^toko-.*\.db$/.test(f)).sort().slice(0, -30);
  old.forEach(f => fs.unlinkSync(path.join('backup', f)));
  console.log('Backup berhasil: backup/' + name + ' (disimpan maksimal 30 file terakhir)');
}).catch(e => { console.log('Backup gagal: ' + e.message); process.exit(1); });
