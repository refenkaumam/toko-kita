const fs = require('fs'), crypto = require('crypto');
const express = require('express'), helmet = require('helmet'), rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs'), Database = require('better-sqlite3');

fs.mkdirSync('data', { recursive: true });
const db = new Database(process.env.DB_PATH || 'data/toko.db');
db.pragma('journal_mode = WAL'); db.pragma('foreign_keys = ON');
db.exec(`
create table if not exists users(id integer primary key, username text unique not null, hash text not null, role text not null check(role in('admin','kasir')));
create table if not exists sessions(token text primary key, user_id integer not null references users(id) on delete cascade, expires integer not null);
create table if not exists products(id integer primary key, name text not null, price integer not null, cost integer not null default 0, stock integer not null default 0, min_stock integer not null default 5, active integer not null default 1);
create table if not exists sales(id integer primary key, total integer not null, pay integer not null, user_id integer not null, created_at integer not null);
create table if not exists sale_items(sale_id integer not null references sales(id), product_id integer not null, name text not null, price integer not null, cost integer not null, qty integer not null);
create table if not exists expenses(id integer primary key, note text not null, amount integer not null, created_at integer not null);
create index if not exists idx_sales_time on sales(created_at);
`);

try { db.exec("alter table products add column category text not null default ''"); } catch {} // migrasi database lama
const PROD = process.env.NODE_ENV === 'production';
const SECURE = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === '1' : PROD; // set COOKIE_SECURE=1 jika sudah memakai HTTPS
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const DUMMY = bcrypt.hashSync('dummy-password', 12); // samakan waktu respon agar username tidak bisa ditebak

if (!db.prepare('select 1 from users').get()) {
  const pw = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
  db.prepare('insert into users(username,hash,role) values(?,?,?)').run('admin', bcrypt.hashSync(pw, 12), 'admin');
  console.log(`Akun admin dibuat -> username: admin | password: ${pw} (segera simpan, tidak ditampilkan lagi)`);
}

const app = express();
app.set('trust proxy', process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : false);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: { directives: { ...helmet.contentSecurityPolicy.getDefaultDirectives(), 'upgrade-insecure-requests': null } } }));
app.use(express.json({ limit: '50kb' }));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  // Header kustom tidak bisa dikirim lintas-situs tanpa CORS -> penangkal CSRF (ditambah cookie SameSite=Strict)
  if (req.method !== 'GET' && req.get('x-csrf') !== '1') return res.status(403).json({ error: 'Permintaan ditolak' });
  next();
});
app.use(express.static('public', { maxAge: '1h' }));

const bad = (res, m = 'Data tidak valid') => res.status(400).json({ error: m });
const int = (v, min = 0, max = 1e9) => Number.isInteger(v) && v >= min && v <= max;

function auth(role) {
  return (req, res, next) => {
    const t = (req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith('sid='))?.slice(4);
    const u = t && db.prepare('select u.id,u.username,u.role from sessions s join users u on u.id=s.user_id where s.token=? and s.expires>?').get(sha(t), Date.now());
    if (!u) return res.status(401).json({ error: 'Silakan login' });
    if (role && u.role !== role) return res.status(403).json({ error: 'Tidak diizinkan' });
    req.user = u; next();
  };
}

app.post('/api/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, message: { error: 'Terlalu banyak percobaan, coba lagi nanti' } }), (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || password.length > 200) return bad(res);
  const u = db.prepare('select * from users where username=?').get(username.trim().toLowerCase());
  const ok = bcrypt.compareSync(password, u ? u.hash : DUMMY);
  if (!u || !ok) return res.status(401).json({ error: 'Username atau password salah' });
  const t = crypto.randomBytes(32).toString('base64url');
  db.prepare('delete from sessions where expires<?').run(Date.now());
  db.prepare('insert into sessions values(?,?,?)').run(sha(t), u.id, Date.now() + 12 * 3600e3);
  res.setHeader('Set-Cookie', `sid=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${SECURE ? '; Secure' : ''}`);
  res.json({ username: u.username, role: u.role });
});
app.post('/api/logout', auth(), (req, res) => {
  const t = req.headers.cookie.split(/;\s*/).find(c => c.startsWith('sid='))?.slice(4);
  db.prepare('delete from sessions where token=?').run(sha(t));
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  res.json({ ok: true });
});
app.get('/api/me', auth(), (req, res) => res.json(req.user));

// ---- Produk ----
const validProd = b => b && typeof b.name === 'string' && b.name.trim() && b.name.length <= 80 && int(b.price, 1) && int(b.cost) && int(b.stock) && int(b.min_stock) && (b.category === undefined || (typeof b.category === 'string' && b.category.length <= 40));
app.get('/api/products', auth(), (req, res) => {
  const cols = req.user.role === 'admin' ? 'id,name,category,price,cost,stock,min_stock' : 'id,name,category,price,stock,min_stock';
  res.json(db.prepare(`select ${cols} from products where active=1 order by name`).all());
});
app.post('/api/products', auth('admin'), (req, res) => {
  const b = req.body; if (!validProd(b)) return bad(res);
  db.prepare('insert into products(name,price,cost,stock,min_stock,category) values(?,?,?,?,?,?)').run(b.name.trim(), b.price, b.cost, b.stock, b.min_stock, (b.category || '').trim());
  res.json({ ok: true });
});
app.put('/api/products/:id', auth('admin'), (req, res) => {
  const b = req.body; if (!validProd(b)) return bad(res);
  db.prepare('update products set name=?,price=?,cost=?,stock=?,min_stock=?,category=? where id=?').run(b.name.trim(), b.price, b.cost, b.stock, b.min_stock, (b.category || '').trim(), Number(req.params.id));
  res.json({ ok: true });
});
app.delete('/api/products/:id', auth('admin'), (req, res) => {
  db.prepare('update products set active=0 where id=?').run(Number(req.params.id)); // soft delete, riwayat tetap aman
  res.json({ ok: true });
});

// ---- Penjualan (harga selalu diambil dari database, bukan dari browser) ----
const sell = db.transaction((uid, items, pay) => {
  let total = 0; const rows = [];
  for (const it of items) {
    const p = db.prepare('select * from products where id=? and active=1').get(it.id);
    if (!p) throw new Error('Barang tidak ditemukan');
    if (p.stock < it.qty) throw new Error(`Stok ${p.name} tidak cukup`);
    db.prepare('update products set stock=stock-? where id=?').run(it.qty, p.id);
    total += p.price * it.qty; rows.push([p, it.qty]);
  }
  if (pay < total) throw new Error('Uang kurang');
  const id = db.prepare('insert into sales(total,pay,user_id,created_at) values(?,?,?,?)').run(total, pay, uid, Date.now()).lastInsertRowid;
  for (const [p, q] of rows) db.prepare('insert into sale_items values(?,?,?,?,?,?)').run(id, p.id, p.name, p.price, p.cost, q);
  return { id, total, change: pay - total };
});
app.post('/api/sales', auth(), (req, res) => {
  const { items, pay } = req.body || {};
  if (!Array.isArray(items) || !items.length || items.length > 100 || !int(pay) || !items.every(i => int(i.id, 1) && int(i.qty, 1, 10000))) return bad(res);
  try { res.json(sell(req.user.id, items, pay)); } catch (e) { bad(res, e.message); }
});

// ---- Laporan & pengguna ----
function rangeStart(r) {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (r === 'week') d.setDate(d.getDate() - 6);
  if (r === 'month') d.setDate(1);
  return d.getTime();
}
function daily(s) {
  const m = Object.fromEntries(db.prepare("select strftime('%Y-%m-%d',created_at/1000,'unixepoch','localtime') d, sum(total) v from sales where created_at>=? group by d").all(s).map(r => [r.d, r.v]));
  const out = [], end = new Date();
  for (const t = new Date(s); t <= end; t.setDate(t.getDate() + 1)) {
    const k = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
    out.push({ d: k, v: m[k] || 0 });
  }
  return out;
}
app.get('/api/dashboard', auth('admin'), (req, res) => {
  const s = rangeStart('today'), w = rangeStart('week');
  const t = db.prepare('select count(*) n, coalesce(sum(total),0) omzet from sales where created_at>=?').get(s);
  const profit = db.prepare('select coalesce(sum((price-cost)*qty),0) v from sale_items i join sales x on x.id=i.sale_id where x.created_at>=?').get(s).v;
  const c = db.prepare('select count(*) products, coalesce(sum(stock<=min_stock),0) low from products where active=1').get();
  const top = db.prepare('select name, sum(qty) qty from sale_items i join sales x on x.id=i.sale_id where x.created_at>=? group by name order by qty desc limit 5').all(w);
  const recent = db.prepare('select s.id,s.total,s.created_at,u.username from sales s join users u on u.id=s.user_id order by s.id desc limit 8').all();
  res.json({ ...t, profit, ...c, weekly: daily(w), top, recent });
});
app.get('/api/report', auth('admin'), (req, res) => {
  const s = rangeStart(req.query.range);
  const t = db.prepare('select count(*) n, coalesce(sum(total),0) omzet from sales where created_at>=?').get(s);
  const modal = db.prepare('select coalesce(sum(cost*qty),0) v from sale_items i join sales x on x.id=i.sale_id where x.created_at>=?').get(s).v;
  const pengeluaran = db.prepare('select coalesce(sum(amount),0) v from expenses where created_at>=?').get(s).v;
  const top = db.prepare('select name, sum(qty) qty from sale_items i join sales x on x.id=i.sale_id where x.created_at>=? group by name order by qty desc limit 5').all(s);
  const low = db.prepare('select name,stock from products where active=1 and stock<=min_stock order by stock limit 20').all();
  res.json({ ...t, modal, pengeluaran, laba_kotor: t.omzet - modal, laba_bersih: t.omzet - modal - pengeluaran, daily: daily(s), top, low });
});

// ---- Riwayat transaksi (admin: semua, kasir: miliknya sendiri) ----
app.get('/api/sales', auth(), (req, res) => {
  res.json(db.prepare(`select s.id,s.total,s.pay,s.created_at,u.username,(select sum(qty) from sale_items where sale_id=s.id) items
    from sales s join users u on u.id=s.user_id where s.created_at>=? and (?=1 or s.user_id=?) order by s.id desc limit 200`)
    .all(rangeStart(req.query.range), req.user.role === 'admin' ? 1 : 0, req.user.id));
});
app.get('/api/sales/:id', auth(), (req, res) => {
  const id = Number(req.params.id), s = db.prepare('select user_id from sales where id=?').get(id);
  if (!s || (req.user.role !== 'admin' && s.user_id !== req.user.id)) return res.status(404).json({ error: 'Tidak ditemukan' });
  res.json(db.prepare('select name,price,qty from sale_items where sale_id=?').all(id));
});

// ---- Pengeluaran ----
app.get('/api/expenses', auth('admin'), (req, res) =>
  res.json(db.prepare('select id,note,amount,created_at from expenses where created_at>=? order by id desc limit 100').all(rangeStart(req.query.range))));
app.post('/api/expenses', auth('admin'), (req, res) => {
  const { note, amount } = req.body || {};
  if (typeof note !== 'string' || !note.trim() || note.length > 100 || !int(amount, 1)) return bad(res);
  db.prepare('insert into expenses(note,amount,created_at) values(?,?,?)').run(note.trim(), amount, Date.now());
  res.json({ ok: true });
});
app.delete('/api/expenses/:id', auth('admin'), (req, res) => {
  db.prepare('delete from expenses where id=?').run(Number(req.params.id)); res.json({ ok: true });
});

const validPw = p => typeof p === 'string' && p.length >= 8 && p.length <= 200;
app.get('/api/users', auth('admin'), (req, res) => res.json(db.prepare('select id,username,role from users order by id').all()));
app.post('/api/users', auth('admin'), (req, res) => {
  const { username, password, role } = req.body || {};
  if (typeof username !== 'string' || !/^[a-z0-9_]{3,20}$/.test(username) || !validPw(password) || !['admin', 'kasir'].includes(role || 'kasir')) return bad(res, 'Username 3-20 huruf kecil/angka, password minimal 8 karakter');
  try { db.prepare('insert into users(username,hash,role) values(?,?,?)').run(username, bcrypt.hashSync(password, 12), role || 'kasir'); res.json({ ok: true }); }
  catch { bad(res, 'Username sudah dipakai'); }
});
app.put('/api/users/:id/password', auth('admin'), (req, res) => {
  const id = Number(req.params.id);
  if (!validPw(req.body && req.body.password)) return bad(res, 'Password minimal 8 karakter');
  db.prepare('update users set hash=? where id=?').run(bcrypt.hashSync(req.body.password, 12), id);
  db.prepare('delete from sessions where user_id=?').run(id); res.json({ ok: true });
});
app.delete('/api/users/:id', auth('admin'), (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return bad(res, 'Tidak bisa menghapus akun yang sedang dipakai');
  if (db.prepare('select count(*) n from sales where user_id=?').get(id).n) return bad(res, 'Pengguna ini punya riwayat transaksi, cukup ganti passwordnya');
  db.prepare('delete from users where id=?').run(id); res.json({ ok: true });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Tidak ditemukan' }));
app.use((err, req, res, next) => { console.error(err.message); res.status(err.status === 400 ? 400 : 500).json({ error: 'Terjadi kesalahan' }); });
app.listen(process.env.PORT || 3000, () => console.log('Toko Kita jalan di port', process.env.PORT || 3000));