// Data contoh untuk uji coba. Jalankan: node seed.js   (hentikan server dulu)
//   node seed.js force      -> tambah lagi walau sudah ada barang
//   node seed.js kosongkan  -> hapus SEMUA barang, transaksi & pengeluaran (akun admin tetap)
const Database = require('better-sqlite3'), bcrypt = require('bcryptjs');
const db = new Database(process.env.DB_PATH || 'data/toko.db');
db.pragma('foreign_keys = ON');
const arg = process.argv[2];

if (arg === 'kosongkan') {
  db.exec("delete from sale_items; delete from sales; delete from expenses; delete from products; delete from users where username='kasir1'");
  console.log('Selesai: semua barang, transaksi, dan pengeluaran dihapus. Akun admin tetap ada.'); process.exit();
}
if (db.prepare('select count(*) n from products').get().n > 0 && arg !== 'force' && arg !== 'kategori') {
  console.log('Sudah ada barang di database, seed dibatalkan. Pakai "node seed.js force" jika tetap mau menambah.'); process.exit();
}

// nama | modal | harga jual | stok awal | batas menipis  (yang paling laris ada di atas)
const P = `Indomie Goreng|2700|3500|120|20
Indomie Soto|2600|3300|80|20
Mie Sedaap Goreng|2700|3500|60|15
Aqua 600 ml|2800|4000|72|12
Teh Pucuk Harum 350 ml|3000|4000|48|10
Kopi Kapal Api Sachet|1200|1500|150|30
Kopi Good Day Sachet|1400|2000|100|20
Beras 1 kg|13000|15000|60|10
Gula Pasir 1 kg|16000|18000|40|8
Minyak Goreng 1 L|16500|18500|36|8
Telur Ayam 1 kg|26000|29000|25|6
Rokok Filter 12 batang|22000|24000|50|10
Susu Kental Manis Frisian|11000|13000|24|6
Teh Celup Sariwangi|4000|5000|30|8
Coca-Cola 390 ml|3800|5000|36|8
Sprite 390 ml|3800|5000|36|8
Susu UHT Ultra 250 ml|5000|6500|30|8
Roti Tawar Sari Roti|13000|15500|10|4
Biskuit Roma Kelapa|8500|10000|24|6
Chiki Balls|1500|2000|60|12
Permen Kopiko|300|500|200|40
Sabun Mandi Lifebuoy|3000|4000|30|6
Sampo Sunsilk Sachet|400|500|120|30
Detergen Rinso Sachet|1000|1500|80|20
Sabun Cuci Piring Sunlight Sachet|800|1000|60|15
Pasta Gigi Pepsodent|7500|9000|18|5
Tepung Terigu 1 kg|11000|13500|20|5
Garam Dapur|2500|3500|30|8
Kecap Manis ABC Sachet|1500|2000|60|15
Gas LPG 3 kg|20000|24000|8|5
Tisu Saku|5000|7000|20|5
Baterai ABC AA|5000|7000|12|5
Korek Api|2000|3000|40|10`.split('\n').map(l => { const [name, cost, price, stock, min_stock] = l.split('|'); return { name, cost: +cost, price: +price, stock: +stock, min_stock: +min_stock }; });

const catOf = n => /Indomie|Mie /.test(n) ? 'Mi instan' : /Aqua|Teh Pucuk|Coca|Sprite|UHT/.test(n) ? 'Minuman' : /Kopi|Teh Celup|Kental/.test(n) ? 'Kopi dan teh' : /Beras|Gula|Minyak|Telur|Tepung|Garam|Kecap/.test(n) ? 'Sembako' : /Rokok|Korek/.test(n) ? 'Rokok' : /Sabun|Sampo|Rinso|Sunlight|Pepsodent|Tisu/.test(n) ? 'Kebersihan' : /Roti|Roma|Chiki|Permen/.test(n) ? 'Makanan ringan' : 'Lainnya';
if (arg === 'kategori') {
  const u = db.prepare("update products set category=? where id=? and category=''");
  for (const p of db.prepare('select id,name from products').all()) u.run(catOf(p.name), p.id);
  console.log('Kategori terisi otomatis untuk barang yang belum punya kategori.'); process.exit();
}
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const now = Date.now(), DAY = 864e5;

db.transaction(() => {
  db.prepare('insert or ignore into users(username,hash,role) values(?,?,?)').run('kasir1', bcrypt.hashSync('kasir12345', 12), 'kasir');
  const users = db.prepare('select id from users').all().map(u => u.id);
  const insP = db.prepare('insert into products(name,price,cost,stock,min_stock,category) values(?,?,?,?,?,?)');
  for (const p of P) p.id = insP.run(p.name, p.price, p.cost, p.stock, p.min_stock, catOf(p.name)).lastInsertRowid;

  const insS = db.prepare('insert into sales(total,pay,user_id,created_at) values(?,?,?,?)');
  const insI = db.prepare('insert into sale_items values(?,?,?,?,?,?)');
  let count = 0;
  for (let d = 13; d >= 0; d--) {
    const trx = rnd(9, 20);
    for (let i = 0; i < trx; i++) {
      const items = new Map();
      for (let k = rnd(1, 4); k > 0; k--) {
        const p = P[Math.floor(P.length * Math.random() ** 2)]; // barang di atas lebih sering terjual
        const q = Math.min(rnd(1, 3), p.stock - (items.get(p) || 0));
        if (q > 0) items.set(p, (items.get(p) || 0) + q);
      }
      if (!items.size) continue;
      let total = 0; for (const [p, q] of items) { total += p.price * q; p.stock -= q; }
      const pay = [total, Math.ceil(total / 5000) * 5000, Math.ceil(total / 10000) * 10000, 50000, 100000].filter(v => v >= total)[rnd(0, 2)];
      const id = insS.run(total, pay, users[rnd(0, users.length - 1)], now - d * DAY - rnd(0, 13 * 3600e3)).lastInsertRowid;
      for (const [p, q] of items) insI.run(id, p.id, p.name, p.price, p.cost, q);
      count++;
    }
  }
  const upd = db.prepare('update products set stock=? where id=?'); for (const p of P) upd.run(p.stock, p.id);

  const insE = db.prepare('insert into expenses(note,amount,created_at) values(?,?,?)');
  [['Listrik (token)', 100000, 12], ['Upah jaga toko', 150000, 9], ['Plastik kresek', 25000, 7], ['Air galon & kebersihan', 18000, 5], ['Parkir & keamanan', 20000, 3], ['Gas dapur', 24000, 1]]
    .forEach(([n, a, d]) => insE.run(n, a, now - d * DAY - rnd(0, 3600e3)));
  console.log(`Selesai: ${P.length} barang, ${count} transaksi (14 hari), 6 pengeluaran, akun kasir1 (password: kasir12345).`);
})();