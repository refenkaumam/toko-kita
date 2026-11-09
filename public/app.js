const $ = s => document.querySelector(s), app = $('#app');
const rp = n => 'Rp' + Number(n).toLocaleString('id-ID');
const fmt = t => new Date(t).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const IC = {
  home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z', cart: 'M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.7a1 1 0 0 0 1-.8L20 8H6M9 20h.01M17 20h.01',
  box: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8', tag: 'M20 12l-8 8-9-9V3h8zM7.5 7.5h.01', layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6', chart: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16M21 21l-4.3-4.3', bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  menu: 'M3 6h18M3 12h18M3 18h18', plus: 'M12 5v14M5 12h14', x: 'M18 6L6 18M6 6l12 12', check: 'M20 6L9 17l-5-5',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9', chev: 'M15 18l-6-6 6-6', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6'
};
const RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
function countUp(el, to, f = String) { // angka naik halus
  if (RM || !to) { el.textContent = f(to); return; }
  const t0 = performance.now(), D = 800, step = t => { const k = Math.min((t - t0) / D, 1); el.textContent = f(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); };
  el.textContent = f(0); requestAnimationFrame(step);
}
// Semua teks dimasukkan lewat textContent (via append), jadi aman dari XSS. innerHTML hanya dipakai untuk ikon dan grafik buatan sendiri.
function h(t, p = {}, ...c) {
  const e = document.createElement(t);
  for (const [k, v] of Object.entries(p)) k.startsWith('on') ? e.addEventListener(k.slice(2), v) : k === 'class' ? e.className = v : k.includes('-') ? e.setAttribute(k, v) : e[k] = v;
  e.append(...c); return e;
}
const icon = n => h('span', { class: 'icw', innerHTML: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${IC[n]}"/></svg>` });
async function api(m, u, b) {
  let r;
  try { r = await fetch('/api' + u, { method: m, headers: { 'Content-Type': 'application/json', 'X-CSRF': '1' }, body: b ? JSON.stringify(b) : undefined }); }
  catch { throw new Error('Tidak bisa terhubung ke server. Pastikan server sedang berjalan.'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { if (r.status === 401 && u !== '/login' && u !== '/me') showLogin(); throw new Error(d.error || 'Terjadi kesalahan'); }
  return d;
}
const toast = (m, bad) => { const t = h('div', { class: 'toast' + (bad ? ' bad' : ''), role: 'status' }, m); document.body.append(t); setTimeout(() => t.classList.add('out'), 3200); setTimeout(() => t.remove(), 3500); };
const guard = f => async (...a) => { try { await f(...a); } catch (e) { toast(e.message, 1); } };

// ---------- komponen ----------
const emptyState = t => h('div', { class: 'empty' }, icon('box'), h('p', {}, t));
const skeleton = () => h('div', { class: 'page' }, h('div', { class: 'sk', style: 'height:32px;width:220px' }), h('div', { class: 'stats' }, ...[1, 2, 3, 4].map(() => h('div', { class: 'sk', style: 'height:84px' }))), h('div', { class: 'sk', style: 'height:260px' }));
const errState = e => h('div', { class: 'page' }, h('div', { class: 'card empty' }, icon('x'), h('b', {}, 'Data gagal dimuat'), h('p', {}, e.message || 'Terjadi kesalahan'), h('button', { class: 'btn pri', onclick: () => render() }, 'Muat ulang')));
const head = (t, sub, ...a) => h('div', { class: 'ph' }, h('div', {}, h('h1', {}, t), h('p', {}, sub)), h('div', { class: 'acts' }, ...a));
const field = (l, i) => h('label', { class: 'fld' }, h('span', {}, l), i);
const stockBadge = p => p.stock <= 0 ? h('span', { class: 'badge bad' }, 'Habis') : p.stock <= p.min_stock ? h('span', { class: 'badge warn' }, 'Menipis') : h('span', { class: 'badge ok' }, 'Aman');
function modal(title, ...kids) {
  const m = h('div', { class: 'ov', onclick: e => e.target === m && m.remove() },
    h('div', { class: 'dlg', role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'dh' }, h('b', {}, title), h('button', { class: 'btn sm', 'aria-label': 'Tutup', onclick: () => m.remove() }, icon('x'))), ...kids));
  const rm = m.remove.bind(m); m.remove = () => { m.classList.add('closing'); setTimeout(rm, 160); };
  document.body.append(m); return m;
}
const confirmBox = (msg, ok = 'Ya, lanjutkan') => new Promise(res => {
  const m = modal('Konfirmasi', h('p', {}, msg), h('div', { class: 'acts end' }, h('button', { class: 'btn', onclick: () => { m.remove(); res(false); } }, 'Batal'), h('button', { class: 'btn danger', onclick: () => { m.remove(); res(true); } }, ok)));
});
function dtable({ cols, rows, size = 8, q = '', empty = 'Tidak ada data', search = true }) {
  let sort = null, dir = 1, page = 0, term = q;
  const body = h('tbody'), pg = h('div', { class: 'pg' });
  const inp = h('input', { class: 'inp', type: 'search', placeholder: 'Cari di tabel', value: q, 'aria-label': 'Cari di tabel', oninput: e => { term = e.target.value; page = 0; draw(); } });
  const val = (c, x) => c.v ? c.v(x) : x[c.k];
  const head = h('tr', {}, ...cols.map(c => h('th', { class: c.sort === false ? '' : 's', onclick: () => { if (c.sort === false) return; dir = sort === c ? -dir : 1; sort = c; draw(); } }, c.l + (sort === c ? (dir > 0 ? ' ↑' : ' ↓') : ''))));
  function draw() {
    body.classList.remove('f'); void body.offsetWidth; body.classList.add('f');
    let r = rows.filter(x => !term || cols.some(c => c.sort !== false && String(val(c, x) ?? '').toLowerCase().includes(term.toLowerCase())));
    if (sort) r = [...r].sort((a, b) => { const A = val(sort, a), B = val(sort, b); return (A > B ? 1 : A < B ? -1 : 0) * dir; });
    const n = r.length, pages = Math.max(1, Math.ceil(n / size)); page = Math.min(page, pages - 1);
    head.replaceChildren(...cols.map(c => h('th', { class: c.sort === false ? '' : 's', onclick: () => { if (c.sort === false) return; dir = sort === c ? -dir : 1; sort = c; draw(); } }, c.l + (sort === c ? (dir > 0 ? ' ↑' : ' ↓') : ''))));
    body.replaceChildren(...(n ? r.slice(page * size, page * size + size).map(x => h('tr', {}, ...cols.map(c => h('td', {}, c.r ? c.r(x) : String(x[c.k] ?? ''))))) : [h('tr', {}, h('td', { colSpan: cols.length }, emptyState(term ? 'Tidak ada hasil untuk pencarian ini.' : empty)))]));
    pg.replaceChildren(h('small', {}, n + ' data'), h('div', { class: 'pgb' }, h('button', { class: 'btn sm', disabled: page < 1, 'aria-label': 'Halaman sebelumnya', onclick: () => { page--; draw(); } }, '‹'), h('small', {}, (page + 1) + ' / ' + pages), h('button', { class: 'btn sm', disabled: page >= pages - 1, 'aria-label': 'Halaman berikutnya', onclick: () => { page++; draw(); } }, '›')));
  }
  draw();
  return h('div', { class: 'card' }, ...(search ? [h('div', { class: 'tools' }, inp)] : []), h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, head), body)), pg);
}
function barChart(a) {
  const W = 420, H = 170, m = Math.max(...a.map(x => x.v), 1), bw = W / a.length;
  const lbl = x => { const d = new Date(x + 'T00:00'); return a.length > 8 ? d.getDate() : d.toLocaleDateString('id-ID', { weekday: 'short' }); };
  const el = h('div', { class: 'chart', innerHTML: `<svg viewBox="0 0 ${W} ${H + 24}" role="img" aria-label="Grafik penjualan">${a.map((x, i) => { const bh = Math.round(x.v / m * H); return `<g><rect data-v="${x.v}" data-l="${new Date(x.d + 'T00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}" x="${i * bw + bw * .18}" y="${H - bh}" width="${bw * .64}" height="${Math.max(bh, 3)}" rx="5" fill="${i === a.length - 1 ? '#059669' : '#a7f3d0'}"/><text x="${i * bw + bw / 2}" y="${H + 16}" text-anchor="middle" font-size="11" fill="#6b7280">${lbl(x.d)}</text></g>`; }).join('')}</svg>` }), tt = h('div', { class: 'tt' }); el.append(tt);
  const hover = e => { const r = e.target.closest && e.target.closest('rect'); if (!r) return tt.classList.remove('on'); const b = el.getBoundingClientRect(); tt.replaceChildren(h('small', {}, r.dataset.l), h('b', {}, rp(r.dataset.v))); tt.style.left = (e.clientX - b.left) + 'px'; tt.style.top = (e.clientY - b.top - 10) + 'px'; tt.classList.add('on'); };
  el.addEventListener('mousemove', hover); el.addEventListener('click', hover); el.addEventListener('mouseleave', () => tt.classList.remove('on'));
  return el;
}
const topList = a => { const m = Math.max(...a.map(t => t.qty), 1); return a.length ? a.map(t => h('div', { class: 'tl' }, h('div', { class: 'tn' }, h('span', {}, t.name), h('b', {}, t.qty + ' terjual')), h('div', { class: 'pb' }, h('i', { style: `width:${t.qty / m * 100}%` })))) : [emptyState('Belum ada penjualan.')]; };

// ---------- state & navigasi ----------
const PAGES = [['dashboard', 'Dashboard', 'home', 1], ['kasir', 'Kasir', 'cart'], ['produk', 'Produk', 'box'], ['kategori', 'Kategori', 'tag', 1], ['stok', 'Stok', 'layers'], ['transaksi', 'Transaksi', 'receipt'], ['laporan', 'Laporan', 'chart', 1], ['pengguna', 'Pengguna', 'users', 1]];
let me, route = '', range = 'today', pq = '', pcat = '', sf = 'all', tok = 0;
const rangeChips = () => h('div', { class: 'chips' }, ...[['today', 'Hari ini'], ['week', '7 hari'], ['month', 'Bulan ini']].map(([k, l]) => h('button', { class: 'chip' + (k === range ? ' on' : ''), onclick: () => { range = k; render(); } }, l)));
function go(k) { $('.shell')?.classList.remove('open'); if (location.hash === '#' + k) route = k, render(); else location.hash = k; }
function allowed() { return PAGES.filter(p => !p[3] || me.role === 'admin'); }
function onHash() {
  if (!me) return;
  const k = location.hash.slice(1); route = allowed().some(p => p[0] === k) ? k : (me.role === 'admin' ? 'dashboard' : 'kasir');
  document.querySelectorAll('.nav').forEach(b => b.classList.toggle('on', b.dataset.k === route)); moveInd();
  document.title = allowed().find(p => p[0] === route)[1] + ' | Toko Kita'; render();
}
function moveInd() {
  const b = $('.nav.on'), i = $('.ind'); if (!b || !i) return; const first = !i.dataset.p;
  if (first) i.style.transition = 'none';
  i.style.transform = `translateY(${b.offsetTop}px)`; i.style.height = b.offsetHeight + 'px';
  if (first) { void i.offsetHeight; i.style.transition = ''; i.dataset.p = 1; }
}
const miniPref = () => { try { return !!localStorage.getItem('mini'); } catch { return false; } };
function toggleMini() { const s = $('.shell'); s.classList.toggle('mini'); try { localStorage.setItem('mini', s.classList.contains('mini') ? '1' : ''); } catch {} }
async function refreshBell() {
  try { const n = (await api('GET', '/products')).filter(p => p.stock <= p.min_stock).length, d = $('#dot'); if (d) { d.textContent = n > 99 ? '99+' : n; d.hidden = !n; } } catch {}
}
function show(v, el) { v.replaceChildren(el); el.classList.add('enter'); scrollTo({ top: 0 }); }
async function render() {
  const v = $('#view'); if (!v) return; const my = ++tok;
  if (!v.firstChild) v.replaceChildren(skeleton()); else v.classList.add('busy'); // isi lama diredupkan, bukan langsung dihapus
  try { const el = await PAGEFN[route](); if (my === tok) { v.classList.remove('busy'); show(v, el); } }
  catch (e) { if (my === tok) { v.classList.remove('busy'); show(v, errState(e)); } }
  refreshBell();
}
async function logout() { await api('POST', '/logout').catch(() => {}); me = null; showLogin(); }

function showLogin() {
  const u = h('input', { class: 'inp lg', placeholder: 'Username', autocomplete: 'username', required: true }), p = h('input', { class: 'inp lg', type: 'password', placeholder: 'Password', autocomplete: 'current-password', required: true });
  const err = h('div', { class: 'err', role: 'alert', hidden: true }), btn = h('button', { class: 'btn pri lg' }, 'Masuk');
  const eye = h('button', { type: 'button', class: 'ib eye', 'aria-label': 'Tampilkan password', onclick: () => { p.type = p.type === 'password' ? 'text' : 'password'; } }, icon('eye'));
  app.replaceChildren(h('div', { class: 'auth' },
    h('section', { class: 'hero' }, h('div', { class: 'brand' }, h('i', {}, icon('cart')), h('b', {}, 'Toko Kita')),
      h('div', {}, h('h2', {}, 'Kasir cepat, stok terkontrol, laporan jelas.'), h('ul', {}, h('li', {}, 'Catat penjualan dalam hitungan detik'), h('li', {}, 'Stok berkurang otomatis setiap transaksi'), h('li', {}, 'Omzet dan laba bersih terlihat setiap hari')))),
    h('section', { class: 'fw' }, h('form', { onsubmit: async e => {
      e.preventDefault(); err.hidden = true; btn.disabled = true; btn.replaceChildren(h('span', { class: 'spin' }), 'Memproses');
      try { me = await api('POST', '/login', { username: u.value, password: p.value }); location.hash = ''; shell(); }
      catch (x) { err.textContent = x.message; err.hidden = false; btn.disabled = false; btn.textContent = 'Masuk'; }
    } }, h('h1', {}, 'Masuk ke Toko Kita'), h('p', {}, 'Gunakan akun yang diberikan pemilik toko.'), err, u, h('div', { class: 'pw' }, p, eye), btn))));
  u.focus();
}

function shell() {
  const gi = h('input', { class: 'inp', type: 'search', placeholder: 'Cari produk', 'aria-label': 'Cari produk' });
  const shellEl = h('div', { class: 'shell' + (miniPref() ? ' mini' : '') },
    h('aside', { class: 'side' }, h('div', { class: 'brand' }, h('i', {}, icon('cart')), h('b', {}, 'Toko Kita')),
      h('i', { class: 'ind' }), ...allowed().map(([k, l, ic]) => h('button', { class: 'nav', 'data-k': k, 'data-tip': l, onclick: () => go(k) }, icon(ic), h('span', { class: 'nl' }, l))),
      h('div', { class: 'grow' }), h('button', { class: 'nav tog', 'data-tip': 'Perluas atau ciutkan', onclick: toggleMini }, icon('chev'), h('span', { class: 'nl' }, 'Ciutkan menu'))),
    h('div', { class: 'scrim', onclick: () => shellEl.classList.remove('open') }),
    h('div', { style: 'min-width:0' },
      h('header', { class: 'bar' }, h('button', { class: 'ib menu', 'aria-label': 'Buka menu', onclick: () => shellEl.classList.toggle('open') }, icon('menu')),
        h('form', { class: 'gs', onsubmit: e => { e.preventDefault(); pq = gi.value; pcat = ''; gi.value = ''; go(me.role === 'admin' ? 'produk' : 'kasir'); } }, icon('search'), gi),
        h('div', { class: 'who' }, h('button', { class: 'ib', title: 'Stok menipis', 'aria-label': 'Notifikasi stok menipis', onclick: () => { sf = 'low'; go('stok'); } }, icon('bell'), h('span', { class: 'dot', id: 'dot', hidden: true })),
          h('span', { class: 'av' }, me.username[0].toUpperCase()), h('div', {}, h('b', {}, me.username), h('small', {}, me.role === 'admin' ? 'Admin' : 'Kasir')),
          h('button', { class: 'ib', title: 'Keluar', 'aria-label': 'Keluar', onclick: logout }, icon('logout')))),
      h('main', { id: 'view' })));
  app.replaceChildren(shellEl); onHash();
}

// ---------- halaman ----------
let seenDash = false;
async function pDashboard() {
  const d = await api('GET', '/dashboard'), first = !seenDash; seenDash = true;
  const stat = (l, v, ic, wn, f = String) => { const n = h('b', {}); countUp(n, v, f); return h('div', { class: 'card stat' + (wn ? ' wn' : '') }, h('div', { class: 'si' }, icon(ic)), h('div', {}, h('small', {}, l), n)); };
  return h('div', { class: 'page' + (first ? ' stag' : '') }, head('Dashboard', 'Ringkasan toko hari ini'),
    h('div', { class: 'stats' }, stat('Penjualan hari ini', d.omzet, 'chart', 0, rp), stat('Total transaksi', d.n, 'receipt'), stat('Estimasi keuntungan', d.profit, 'cart', 0, rp), stat('Jumlah produk', d.products, 'box'), stat('Stok menipis', d.low, 'layers', d.low > 0)),
    h('div', { class: 'g2' }, h('div', { class: 'card pad' }, h('h3', {}, 'Penjualan 7 hari terakhir'), barChart(d.weekly)), h('div', { class: 'card pad' }, h('h3', {}, 'Produk terlaris minggu ini'), ...topList(d.top))),
    h('div', {}, h('h3', {}, 'Transaksi terbaru'), dtable({ search: false, size: 5, empty: 'Belum ada transaksi hari ini.', rows: d.recent, cols: [
      { k: 'id', l: 'No', r: x => '#' + x.id }, { k: 'created_at', l: 'Waktu', r: x => fmt(x.created_at) }, { k: 'username', l: 'Kasir' }, { k: 'total', l: 'Total', r: x => h('b', {}, rp(x.total)) }] })));
}

async function pKasir() {
  const prods = await api('GET', '/products'), cart = new Map(), cats = [...new Set(prods.map(p => p.category).filter(Boolean))].sort(); let cat = '';
  const q = h('input', { class: 'inp lg', type: 'search', placeholder: 'Cari barang, tekan Enter untuk menambahkan', value: pq, 'aria-label': 'Cari barang' }); pq = '';
  const chips = h('div', { class: 'chips' }), grid = h('div', { class: 'pgrid' }), cartEl = h('aside', { class: 'card cart' });
  const bar = h('button', { class: 'cartbar', hidden: true, onclick: () => cartEl.scrollIntoView({ behavior: 'smooth' }) });
  const inCart = p => cart.get(p.id) || 0, find = id => prods.find(p => p.id === id);
  const matches = () => prods.filter(p => (!cat || p.category === cat) && p.name.toLowerCase().includes(q.value.trim().toLowerCase()));
  const total = () => [...cart].reduce((s, [id, n]) => s + find(id).price * n, 0);
  const add = p => { if (p.stock > inCart(p)) { cart.set(p.id, inCart(p) + 1); drawCart(); } else toast('Stok ' + p.name + ' sudah habis', 1); };
  function drawGrid() {
    chips.replaceChildren(...(cats.length ? ['', ...cats] : []).map(c => h('button', { class: 'chip' + (c === cat ? ' on' : ''), onclick: () => { cat = c; drawGrid(); } }, c || 'Semua')));
    const l = matches();
    grid.replaceChildren(...(l.length ? l.map(p => h('button', { class: 'pcard', disabled: p.stock <= inCart(p), onclick: () => add(p) }, h('b', {}, p.name), h('span', { class: 'pp' }, rp(p.price)), h('small', { class: p.stock <= p.min_stock ? 'lowtxt' : '' }, 'Stok ' + (p.stock - inCart(p))))) : [emptyState('Barang tidak ditemukan. Coba kata kunci atau kategori lain.')]));
  }
  function drawCart() {
    drawGrid();
    const t = total(), n = [...cart.values()].reduce((a, b) => a + b, 0);
    bar.replaceChildren(h('span', {}, n + ' barang di keranjang'), h('b', {}, rp(t))); bar.hidden = !n;
    if (!n) return cartEl.replaceChildren(h('div', { class: 'ch' }, h('h3', {}, 'Keranjang')), emptyState('Keranjang kosong. Ketuk barang untuk memulai transaksi.'));
    const pay = h('input', { class: 'inp lg', type: 'number', inputMode: 'numeric', placeholder: 'Uang diterima', min: 0, 'aria-label': 'Uang diterima' }), chg = h('div', { class: 'chg' });
    const btn = h('button', { class: 'btn pri lg', disabled: true, onclick: async () => {
      btn.disabled = true; btn.replaceChildren(h('span', { class: 'spin' }), 'Memproses');
      try {
        const r = await api('POST', '/sales', { items: [...cart].map(([id, qty]) => ({ id, qty })), pay: Number(pay.value) }); cart.clear(); bar.hidden = true;
        cartEl.replaceChildren(h('div', { class: 'ok-state' }, h('div', { class: 'okc' }, icon('check')), h('h3', {}, 'Transaksi berhasil'), h('small', {}, 'Kembalian'), h('b', { class: 'big' }, rp(r.change)), h('button', { class: 'btn pri lg', onclick: () => render() }, 'Transaksi baru')));
      } catch (e) { toast(e.message, 1); btn.disabled = false; btn.textContent = 'Bayar'; }
    } }, 'Bayar');
    const upd = () => { const v = Number(pay.value); chg.replaceChildren(h('span', {}, v >= t ? 'Kembalian' : 'Kurang'), h('b', { class: v >= t ? '' : 'neg' }, pay.value ? rp(Math.abs(v - t)) : '-')); btn.disabled = !(pay.value && v >= t); };
    pay.oninput = upd; upd();
    const quick = [t, Math.ceil(t / 5000) * 5000, Math.ceil(t / 10000) * 10000, 50000, 100000].filter((v, i, a) => v >= t && a.indexOf(v) === i).slice(0, 4);
    cartEl.replaceChildren(
      h('div', { class: 'ch' }, h('h3', {}, 'Keranjang'), h('button', { class: 'btn sm', onclick: async () => { if (await confirmBox('Kosongkan semua barang di keranjang?', 'Kosongkan')) { cart.clear(); drawCart(); } } }, 'Kosongkan')),
      ...[...cart].map(([id, c]) => { const p = find(id); return h('div', { class: 'ln' }, h('b', {}, p.name), h('div', { class: 'qty' },
        h('button', { 'aria-label': 'Kurangi', onclick: () => { c > 1 ? cart.set(id, c - 1) : cart.delete(id); drawCart(); } }, '−'), h('b', {}, String(c)), h('button', { 'aria-label': 'Tambah', disabled: c >= p.stock, onclick: () => { cart.set(id, c + 1); drawCart(); } }, '+')), h('small', {}, rp(p.price) + ' x ' + c + ' = ' + rp(p.price * c))); }),
      h('div', { class: 'tp' }, h('small', {}, 'Total'), h('b', {}, rp(t))), pay,
      h('div', { class: 'chips' }, ...quick.map(v => h('button', { class: 'chip', onclick: () => { pay.value = v; upd(); } }, v === t ? 'Uang pas' : rp(v)))), chg, btn);
  }
  q.oninput = drawGrid; q.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); const l = matches(); if (l[0]) add(l[0]); q.select(); } };
  const page = h('div', { class: 'page' }, head('Kasir', 'Cari barang lalu ketuk untuk menambahkan ke keranjang'), h('div', { class: 'pos' }, h('div', {}, q, chips, grid), cartEl), bar);
  drawCart(); setTimeout(() => q.focus(), 0); return page;
}

function prodForm(p = {}, cats = []) {
  const F = [['name', 'Nama barang', 'text'], ['category', 'Kategori', 'text'], ['cost', 'Harga modal (Rp)', 'number'], ['price', 'Harga jual (Rp)', 'number'], ['stock', 'Stok', 'number'], ['min_stock', 'Batas stok menipis', 'number']];
  const ins = Object.fromEntries(F.map(([k, l, t]) => [k, h('input', { class: 'inp', type: t, min: 0, maxLength: 80, required: k !== 'category', value: p[k] ?? (k === 'min_stock' ? 5 : ''), placeholder: k === 'category' ? 'Contoh: Minuman' : '' })]));
  ins.category.setAttribute('list', 'cats');
  const m = modal(p.id ? 'Ubah produk' : 'Tambah produk', h('form', { onsubmit: guard(async e => {
    e.preventDefault(); const b = {}; for (const [k] of F) b[k] = ['name', 'category'].includes(k) ? ins[k].value : Number(ins[k].value);
    p.id ? await api('PUT', '/products/' + p.id, b) : await api('POST', '/products', b); m.remove(); toast(p.id ? 'Perubahan disimpan' : 'Produk ditambahkan'); render();
  }) }, ...F.map(([k, l]) => field(l, ins[k])), h('datalist', { id: 'cats' }, ...cats.map(c => h('option', { value: c }))),
    h('div', { class: 'acts end' }, h('button', { type: 'button', class: 'btn', onclick: () => m.remove() }, 'Batal'), h('button', { class: 'btn pri' }, p.id ? 'Simpan perubahan' : 'Tambah produk'))));
}

async function pProduk() {
  const all = await api('GET', '/products'), adm = me.role === 'admin', cats = [...new Set(all.map(p => p.category).filter(Boolean))].sort();
  const rows = pcat ? all.filter(p => (p.category || 'Tanpa kategori') === pcat) : all, q = pq; pq = '';
  const cols = [
    { k: 'name', l: 'Nama barang', r: p => h('b', {}, p.name) },
    { k: 'category', l: 'Kategori', r: p => p.category ? h('span', { class: 'tag' }, p.category) : h('small', {}, '-') },
    ...(adm ? [{ k: 'cost', l: 'Modal', r: p => rp(p.cost) }] : []), { k: 'price', l: 'Harga jual', r: p => rp(p.price) },
    ...(adm ? [{ k: 'margin', l: 'Margin', v: p => p.price - p.cost, r: p => rp(p.price - p.cost) }] : []),
    { k: 'stock', l: 'Stok', r: p => h('span', { class: 'stk' }, String(p.stock), stockBadge(p)) },
    ...(adm ? [{ l: '', sort: false, r: p => h('div', { class: 'acts end' }, h('button', { class: 'btn sm', onclick: () => prodForm(p, cats) }, 'Ubah'),
      h('button', { class: 'btn sm danger-o', onclick: guard(async () => { if (await confirmBox(`Hapus "${p.name}" dari daftar produk? Riwayat transaksinya tetap tersimpan.`, 'Hapus produk')) { await api('DELETE', '/products/' + p.id); toast('Produk dihapus'); render(); } }) }, 'Hapus')) }] : [])];
  return h('div', { class: 'page' }, head('Produk', 'Kelola nama, kategori, harga, dan stok barang', ...(adm ? [h('button', { class: 'btn pri', onclick: () => prodForm({}, cats) }, icon('plus'), 'Tambah produk')] : [])),
    ...(pcat ? [h('div', { class: 'chips' }, h('button', { class: 'chip on', onclick: () => { pcat = ''; render(); } }, 'Kategori: ' + pcat + '  ✕'))] : []),
    dtable({ cols, rows, q, empty: 'Belum ada produk. Tambahkan produk pertama untuk mulai berjualan.' }));
}

async function pKategori() {
  const all = await api('GET', '/products'), m = new Map();
  for (const p of all) { const k = p.category || 'Tanpa kategori', c = m.get(k) || { name: k, n: 0, stock: 0, val: 0 }; c.n++; c.stock += p.stock; c.val += p.stock * p.cost; m.set(k, c); }
  return h('div', { class: 'page' }, head('Kategori', 'Kelompok barang dibuat otomatis dari kolom kategori di form produk'),
    dtable({ rows: [...m.values()], search: false, empty: 'Belum ada kategori. Isi kolom kategori saat menambah produk.', cols: [
      { k: 'name', l: 'Kategori', r: c => h('b', {}, c.name) }, { k: 'n', l: 'Jumlah produk' }, { k: 'stock', l: 'Total stok' }, { k: 'val', l: 'Nilai stok (modal)', r: c => rp(c.val) },
      { l: '', sort: false, r: c => h('div', { class: 'acts end' }, h('button', { class: 'btn sm', onclick: () => { pcat = c.name; go('produk'); } }, 'Lihat produk')) }] }));
}

async function pStok() {
  const all = await api('GET', '/products'), adm = me.role === 'admin';
  const st = p => p.stock <= 0 ? 'out' : p.stock <= p.min_stock ? 'low' : 'ok', cnt = k => all.filter(p => st(p) === k).length;
  const rows = all.filter(p => sf === 'all' || st(p) === sf);
  const cols = [{ k: 'name', l: 'Nama barang', r: p => h('b', {}, p.name) }, { k: 'category', l: 'Kategori', r: p => p.category || '-' }, { k: 'stock', l: 'Stok' }, { k: 'min_stock', l: 'Batas minimum' },
    { k: 'st', l: 'Status', v: p => p.stock - p.min_stock, r: stockBadge }, ...(adm ? [{ k: 'val', l: 'Nilai stok', v: p => p.stock * p.cost, r: p => rp(p.stock * p.cost) }, { l: '', sort: false, r: p => h('div', { class: 'acts end' }, h('button', { class: 'btn sm', onclick: () => prodForm(p, []) }, 'Ubah stok')) }] : [])];
  return h('div', { class: 'page' }, head('Stok', 'Pantau jumlah barang yang tersedia'),
    h('div', { class: 'chips' }, ...[['all', 'Semua (' + all.length + ')'], ['low', 'Menipis (' + cnt('low') + ')'], ['out', 'Habis (' + cnt('out') + ')']].map(([k, l]) => h('button', { class: 'chip' + (k === sf ? ' on' : ''), onclick: () => { sf = k; render(); } }, l))),
    dtable({ cols, rows, empty: sf === 'all' ? 'Belum ada barang.' : 'Tidak ada barang dengan status ini.' }));
}

async function saleDetail(r) {
  const it = await api('GET', '/sales/' + r.id), row = (a, b, c) => h('div', { class: 'dl' + (c ? ' tot' : '') }, h('span', {}, a), h('b', {}, b));
  modal('Transaksi #' + r.id, h('small', {}, fmt(r.created_at) + ', kasir ' + r.username), ...it.map(i => row(i.qty + ' x ' + i.name, rp(i.price * i.qty))), row('Total', rp(r.total), 1), row('Bayar', rp(r.pay)), row('Kembalian', rp(r.pay - r.total)));
}
async function pTransaksi() {
  const rows = await api('GET', '/sales?range=' + range);
  return h('div', { class: 'page' }, head('Transaksi penjualan', rows.length + ' transaksi, total ' + rp(rows.reduce((s, r) => s + r.total, 0))), rangeChips(),
    dtable({ rows, empty: 'Belum ada transaksi pada periode ini.', cols: [{ k: 'id', l: 'No', r: x => '#' + x.id }, { k: 'created_at', l: 'Waktu', r: x => fmt(x.created_at) }, { k: 'username', l: 'Kasir' }, { k: 'items', l: 'Jumlah barang' },
      { k: 'total', l: 'Total', r: x => h('b', {}, rp(x.total)) }, { l: '', sort: false, r: x => h('div', { class: 'acts end' }, h('button', { class: 'btn sm', onclick: guard(() => saleDetail(x)) }, 'Detail')) }] }));
}

async function pLaporan() {
  const [r, ex] = await Promise.all([api('GET', '/report?range=' + range), api('GET', '/expenses?range=' + range)]);
  const stat = (l, v, neg) => { const n = h('b', { class: neg ? 'neg' : '' }); countUp(n, v, rp); return h('div', { class: 'card stat' }, h('div', {}, h('small', {}, l), n)); };
  const addEx = () => {
    const note = h('input', { class: 'inp', required: true, maxLength: 100, placeholder: 'Contoh: Token listrik' }), amt = h('input', { class: 'inp', type: 'number', min: 1, required: true, placeholder: '0' });
    const m = modal('Catat pengeluaran', h('form', { onsubmit: guard(async e => { e.preventDefault(); await api('POST', '/expenses', { note: note.value, amount: Number(amt.value) }); m.remove(); toast('Pengeluaran dicatat'); render(); }) },
      field('Keterangan', note), field('Jumlah (Rp)', amt), h('div', { class: 'acts end' }, h('button', { type: 'button', class: 'btn', onclick: () => m.remove() }, 'Batal'), h('button', { class: 'btn pri' }, 'Catat pengeluaran'))));
  };
  return h('div', { class: 'page' }, head('Laporan keuangan', 'Omzet, modal, pengeluaran, dan keuntungan bersih'), rangeChips(),
    h('div', { class: 'stats' }, stat('Omzet', r.omzet), stat('Modal barang terjual', r.modal), stat('Laba kotor', r.laba_kotor, r.laba_kotor < 0), stat('Pengeluaran', r.pengeluaran), stat('Laba bersih', r.laba_bersih, r.laba_bersih < 0)),
    h('div', { class: 'g2' }, h('div', { class: 'card pad' }, h('h3', {}, 'Penjualan harian'), barChart(r.daily)), h('div', { class: 'card pad' }, h('h3', {}, 'Produk terlaris'), ...topList(r.top))),
    h('div', { class: 'ph' }, h('h3', { style: 'margin:0' }, 'Pengeluaran'), h('button', { class: 'btn pri', onclick: addEx }, icon('plus'), 'Catat pengeluaran')),
    dtable({ rows: ex, search: false, size: 6, empty: 'Belum ada pengeluaran pada periode ini.', cols: [{ k: 'created_at', l: 'Waktu', r: x => fmt(x.created_at) }, { k: 'note', l: 'Keterangan' }, { k: 'amount', l: 'Jumlah', r: x => rp(x.amount) },
      { l: '', sort: false, r: x => h('div', { class: 'acts end' }, h('button', { class: 'btn sm danger-o', onclick: guard(async () => { if (await confirmBox('Hapus catatan pengeluaran ini?', 'Hapus')) { await api('DELETE', '/expenses/' + x.id); toast('Catatan dihapus'); render(); } }) }, 'Hapus')) }] }));
}

async function pPengguna() {
  const rows = await api('GET', '/users');
  const addUser = () => {
    const u = h('input', { class: 'inp', required: true, pattern: '[a-z0-9_]{3,20}', placeholder: 'huruf kecil atau angka', autocomplete: 'off' }), p = h('input', { class: 'inp', type: 'password', required: true, minLength: 8, autocomplete: 'new-password', placeholder: 'Minimal 8 karakter' });
    const role = h('select', { class: 'inp' }, h('option', { value: 'kasir' }, 'Kasir'), h('option', { value: 'admin' }, 'Admin'));
    const m = modal('Tambah pengguna', h('form', { onsubmit: guard(async e => { e.preventDefault(); await api('POST', '/users', { username: u.value, password: p.value, role: role.value }); m.remove(); toast('Pengguna ditambahkan'); render(); }) },
      field('Username', u), field('Password', p), field('Peran', role), h('div', { class: 'acts end' }, h('button', { type: 'button', class: 'btn', onclick: () => m.remove() }, 'Batal'), h('button', { class: 'btn pri' }, 'Tambah pengguna'))));
  };
  const resetPw = x => {
    const p = h('input', { class: 'inp', type: 'password', required: true, minLength: 8, autocomplete: 'new-password', placeholder: 'Minimal 8 karakter' });
    const m = modal('Ganti password ' + x.username, h('form', { onsubmit: guard(async e => { e.preventDefault(); await api('PUT', '/users/' + x.id + '/password', { password: p.value }); m.remove(); toast('Password diganti'); }) },
      field('Password baru', p), h('div', { class: 'acts end' }, h('button', { type: 'button', class: 'btn', onclick: () => m.remove() }, 'Batal'), h('button', { class: 'btn pri' }, 'Simpan password'))));
  };
  return h('div', { class: 'page' }, head('Pengguna', 'Atur siapa saja yang bisa memakai aplikasi', h('button', { class: 'btn pri', onclick: addUser }, icon('plus'), 'Tambah pengguna')),
    dtable({ rows, search: false, empty: 'Belum ada pengguna.', cols: [{ k: 'username', l: 'Username', r: x => h('b', {}, x.username + (x.id === me.id ? ' (Anda)' : '')) }, { k: 'role', l: 'Peran', r: x => h('span', { class: 'badge ' + (x.role === 'admin' ? 'ok' : 'warn') }, x.role === 'admin' ? 'Admin' : 'Kasir') },
      { l: '', sort: false, r: x => h('div', { class: 'acts end' }, h('button', { class: 'btn sm', onclick: () => resetPw(x) }, 'Ganti password'),
        ...(x.id === me.id ? [] : [h('button', { class: 'btn sm danger-o', onclick: guard(async () => { if (await confirmBox(`Hapus pengguna "${x.username}"?`, 'Hapus pengguna')) { await api('DELETE', '/users/' + x.id); toast('Pengguna dihapus'); render(); } }) }, 'Hapus')])) }] }));
}

const PAGEFN = { dashboard: pDashboard, kasir: pKasir, produk: pProduk, kategori: pKategori, stok: pStok, transaksi: pTransaksi, laporan: pLaporan, pengguna: pPengguna };
addEventListener('hashchange', onHash);
(async () => { try { me = await api('GET', '/me'); shell(); } catch { showLogin(); } })();