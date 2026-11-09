// Lihat daftar akun:            node akun.js
// Buat / reset password akun:   node akun.js reset <username> <password-baru> [admin|kasir]
const Database = require('better-sqlite3'), bcrypt = require('bcryptjs');
const db = new Database(process.env.DB_PATH || 'data/toko.db');
const [cmd, user, pw, role] = process.argv.slice(2);

if (!cmd) {
  console.table(db.prepare('select id, username, role from users').all());
  console.log('Buat/reset akun: node akun.js reset <username> <password-baru> [admin|kasir]');
} else if (cmd === 'reset') {
  if (!/^[a-z0-9_]{3,20}$/.test(user || '') || !pw || pw.length < 8) {
    console.log('Username 3-20 huruf kecil/angka, password minimal 8 karakter.'); process.exit(1);
  }
  const ex = db.prepare('select id from users where username=?').get(user);
  if (ex) {
    db.prepare('update users set hash=? where id=?').run(bcrypt.hashSync(pw, 12), ex.id);
    db.prepare('delete from sessions where user_id=?').run(ex.id);
    console.log(`Password "${user}" berhasil diganti.`);
  } else {
    const r = role === 'admin' ? 'admin' : 'kasir';
    db.prepare('insert into users(username,hash,role) values(?,?,?)').run(user, bcrypt.hashSync(pw, 12), r);
    console.log(`Akun "${user}" (${r}) berhasil dibuat.`);
  }
} else console.log('Perintah tidak dikenal.');
