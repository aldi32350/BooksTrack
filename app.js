/* Books Track — semua data disimpan di localStorage perangkat */
'use strict';

const STORE_KEY = 'bookstrack:v1';
const THEME_KEY = 'bookstrack:theme';
const STATUS = { reading: 'Sedang dibaca', want: 'Ingin dibaca', finished: 'Selesai', paused: 'Ditunda', dnf: 'Berhenti' };
const FORMAT = { physical: 'Buku fisik', ebook: 'E-book', audiobook: 'Audiobook' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const DEFAULT_SETTINGS = { goalDaily: 20, goalYearly: 12, remindDays: 3 };

/* ---------- State ---------- */
let state = load();
const ui = { view: 'home', status: 'all', search: '', sort: 'updated', detailId: null, detailTab: 'sessions', editingId: null, logId: null };

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return { books: Array.isArray(s.books) ? s.books : [], settings: { ...DEFAULT_SETTINGS, ...(s.settings || {}) } };
    }
  } catch (e) { console.warn('Gagal memuat data', e); }
  return { books: [], settings: { ...DEFAULT_SETTINGS } };
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch { toast('⚠ Gagal menyimpan — penyimpanan browser penuh atau diblokir'); }
}

/* ---------- Helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const toISO = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const today = () => toISO(new Date());
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const getBook = (id) => state.books.find((b) => b.id === id);
const touch = (b) => { b.updatedAt = new Date().toISOString(); };
const stars = (n) => '★'.repeat(n || 0) + '☆'.repeat(5 - (n || 0));

function fmtDate(iso, withYear = true) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return withYear ? `${d} ${MONTHS[m - 1]} ${y}` : `${d} ${MONTHS[m - 1]}`;
}
function relDays(iso) {
  if (!iso) return 'belum pernah';
  const d = daysBetween(iso, today());
  if (d <= 0) return 'hari ini';
  if (d === 1) return 'kemarin';
  if (d < 7) return `${d} hari lalu`;
  if (d < 30) return `${Math.floor(d / 7)} minggu lalu`;
  if (d < 365) return `${Math.floor(d / 30)} bulan lalu`;
  return `${Math.floor(d / 365)} tahun lalu`;
}
function pct(b) {
  if (b.status === 'finished') return 100;
  if (!b.totalPages) return 0;
  return Math.min(100, Math.round(((b.currentPage || 0) / b.totalPages) * 100));
}
function lastActivity(b) {
  const dates = (b.sessions || []).map((s) => s.date).filter(Boolean).sort();
  return dates[dates.length - 1] || b.startDate || (b.updatedAt || '').slice(0, 10);
}
function pagesOf(s) { return Math.max(0, (s.toPage || 0) - (s.fromPage || 0)); }

function hueOf(str) { let h = 0; for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
// sampul: gambar di atas placeholder teks berwarna; jika gambar gagal dimuat, placeholder terlihat
function cover(b) {
  const h = hueOf(b.title + (b.author || ''));
  const style = `--cv:linear-gradient(150deg,hsl(${h} 38% 42%),hsl(${(h + 25) % 360} 45% 24%))`;
  const img = b.cover ? `<img src="${esc(b.cover)}" alt="" loading="lazy" onerror="this.remove()" style="position:absolute;inset:0">` : '';
  return `<div class="cover" style="${style}"><div class="ph">${esc(b.title)}</div>${img}</div>`;
}
function statusPill(s) { return `<span class="status-pill st-${s}">${STATUS[s]}</span>`; }

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}
function haptic(ms = 10) { try { navigator.vibrate && navigator.vibrate(ms); } catch {} }

/* ---------- Theme ---------- */
function applyTheme(t) {
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  $$('#themeSeg button').forEach((b) => b.classList.toggle('active', b.dataset.themeSet === (t || 'auto')));
}
let savedTheme = null; try { savedTheme = localStorage.getItem(THEME_KEY); } catch {}
applyTheme(savedTheme);
function setTheme(t) { try { t === 'auto' ? localStorage.removeItem(THEME_KEY) : localStorage.setItem(THEME_KEY, t); } catch {} applyTheme(t === 'auto' ? null : t); }
$('#themeBtn').addEventListener('click', () => {
  const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  setTheme(cur === 'dark' ? 'light' : 'dark');
});
$$('#themeSeg button').forEach((b) => b.addEventListener('click', () => setTheme(b.dataset.themeSet)));

/* ---------- Navigation ---------- */
function showView(v) {
  ui.view = v;
  $$('.tab-item').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
  $$('.view').forEach((s) => s.classList.toggle('active', s.id === 'view-' + v));
  window.scrollTo({ top: 0 });
  render();
}
$$('.tab-item').forEach((b) => b.addEventListener('click', () => showView(b.dataset.view)));
document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-goto]');
  if (go) { if (go.dataset.status) setStatusFilter(go.dataset.status); showView(go.dataset.goto); }
  const add = e.target.closest('[data-action="add"]');
  if (add) { closeAll(); openBookForm(); }
});
function render() {
  if (ui.view === 'home') renderHome();
  if (ui.view === 'library') renderLibrary();
  if (ui.view === 'stats') renderStats();
  if (ui.view === 'settings') renderSettings();
}

/* ---------- Sheets ---------- */
function openSheet(d) { if (!d.open) d.showModal(); }
function closeAll() { $$('dialog[open]').forEach((d) => d.close()); }
$$('dialog').forEach((d) => {
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); }); // klik area gelap
  d.addEventListener('close', () => { document.body.style.overflow = ''; });
  d.addEventListener('cancel', () => {});
});
document.addEventListener('click', (e) => { const c = e.target.closest('[data-close]'); if (c) c.closest('dialog').close(); });

/* ---------- HOME ---------- */
function greeting() {
  const h = new Date().getHours();
  return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 19 ? 'Selamat sore' : 'Selamat malam';
}
function pagesByDay() {
  const m = {};
  state.books.forEach((b) => (b.sessions || []).forEach((s) => { m[s.date] = (m[s.date] || 0) + pagesOf(s); }));
  return m;
}
function streak(byDay) {
  let n = 0; const d = new Date();
  if (!byDay[toISO(d)]) d.setDate(d.getDate() - 1); // belum membaca hari ini tidak memutus streak
  while (byDay[toISO(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

function renderHome() {
  const now = new Date();
  $('#todayLabel').textContent = `${DAYS[now.getDay()]}, ${fmtDate(today())}`;
  $('#greeting').textContent = greeting() + ' 👋';

  const byDay = pagesByDay();
  const pagesToday = byDay[today()] || 0;
  const goal = state.settings.goalDaily || 0;
  const ratio = goal ? Math.min(1, pagesToday / goal) : (pagesToday ? 1 : 0);
  const C = 2 * Math.PI * 34;
  const st = streak(byDay);
  const year = String(now.getFullYear());
  const doneYear = state.books.filter((b) => b.status === 'finished' && (b.finishDate || '').startsWith(year)).length;
  const t1 = !goal ? `${pagesToday} halaman hari ini`
    : pagesToday >= goal ? 'Target hari ini tercapai! 🎉'
    : pagesToday ? `${goal - pagesToday} halaman lagi` : 'Belum membaca hari ini';
  $('#todayCard').innerHTML = `
    <div class="ring">
      <svg viewBox="0 0 84 84"><circle class="track" cx="42" cy="42" r="34"/><circle class="val" cx="42" cy="42" r="34" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - ratio)}"/></svg>
      <div class="ring-label"><b>${pagesToday}</b><small>${goal ? '/ ' + goal + ' hlm' : 'hlm'}</small></div>
    </div>
    <div class="today-info">
      <div class="t1">${t1}</div>
      <div class="t2">${goal ? 'Target harian ' + goal + ' halaman' : 'Atur target di menu Lainnya'}</div>
      <div class="today-stats">
        <div><b>${st} 🔥</b>hari beruntun</div>
        <div><b>${doneYear}${state.settings.goalYearly ? '/' + state.settings.goalYearly : ''}</b>buku ${year}</div>
      </div>
    </div>`;

  renderReminder();

  const reading = state.books.filter((b) => b.status === 'reading').sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const list = $('#readingList');
  if (!state.books.length) {
    list.innerHTML = `<div class="empty"><div class="ic">📚</div><h3>Mulai catat bacaanmu</h3>
      <p>Tambahkan buku yang sedang kamu baca. Setelah itu cukup tekan tombol <b>+</b> setiap selesai membaca.</p>
      <button class="btn primary" data-action="add">+ Tambah buku pertama</button></div>`;
  } else if (!reading.length) {
    list.innerHTML = `<div class="empty"><div class="ic">📖</div><h3>Tidak ada buku yang sedang dibaca</h3>
      <p>Pilih buku dari rak atau tambahkan yang baru.</p><button class="btn primary" data-action="add">+ Tambah buku</button></div>`;
  } else {
    list.innerHTML = reading.map((b) => {
      const p = pct(b);
      const left = b.totalPages ? Math.max(0, b.totalPages - (b.currentPage || 0)) : null;
      return `<div class="read-card" data-id="${b.id}">
        <div class="read-top" data-open>
          ${cover(b)}
          <div class="read-meta">
            <div class="ttl">${esc(b.title)}</div>
            <div class="aut">${esc(b.author || 'Penulis tidak diketahui')}</div>
            <div class="last">Terakhir dibaca ${relDays(lastActivity(b))}</div>
          </div>
        </div>
        <div class="read-progress">
          <div class="row"><span>Halaman <b>${b.currentPage || 0}</b>${b.totalPages ? ' / ' + b.totalPages : ''}</span><span><b>${p}%</b>${left != null ? ' · sisa ' + left : ''}</span></div>
          <div class="progress"><span style="width:${p}%"></span></div>
        </div>
        <div class="read-actions">
          <button class="btn primary" data-log>✎ Catat bacaan</button>
          <button class="btn sq" data-open aria-label="Detail">Detail</button>
        </div>
      </div>`;
    }).join('');
  }
  $$('.read-card', list).forEach((c) => {
    $$('[data-open]', c).forEach((x) => (x.onclick = () => openDetail(c.dataset.id)));
    $('[data-log]', c).onclick = () => openLog(c.dataset.id);
  });

  const want = state.books.filter((b) => b.status === 'want').sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  $('#upNextWrap').classList.toggle('hidden', !want.length);
  $('#upNext').innerHTML = want.slice(0, 12).map((b) => `<div class="shelf-item" data-id="${b.id}">${cover(b)}<div class="ttl">${esc(b.title)}</div></div>`).join('');
  $$('#upNext .shelf-item').forEach((el) => (el.onclick = () => openDetail(el.dataset.id)));
}

function renderReminder() {
  const limit = state.settings.remindDays || 3;
  const msgs = [];
  state.books.forEach((b) => {
    if (b.status === 'reading') {
      const d = daysBetween(lastActivity(b), today());
      if (d >= limit) msgs.push(['⏰', `Sudah <b>${d} hari</b> kamu tidak mencatat <b>${esc(b.title)}</b>. Masih lanjut? Catat sampai halaman berapa.`]);
    }
    if (b.returnDate && b.status !== 'finished') {
      const d = daysBetween(today(), b.returnDate);
      if (d <= 3) msgs.push(['📅', `<b>${esc(b.title)}</b> ${d < 0 ? `terlambat dikembalikan ${-d} hari` : d === 0 ? 'harus dikembalikan hari ini' : `harus dikembalikan ${d} hari lagi`}.`]);
    }
  });
  $('#reminder').innerHTML = msgs.slice(0, 3).map(([i, m]) => `<div class="alert"><span class="ic">${i}</span><div>${m}</div></div>`).join('');
}

/* ---------- LIBRARY ---------- */
function setStatusFilter(s) {
  ui.status = s;
  $$('#statusChips .chip-btn').forEach((x) => x.classList.toggle('active', x.dataset.status === s));
}
$$('#statusChips .chip-btn').forEach((c) => c.addEventListener('click', () => { setStatusFilter(c.dataset.status); renderLibrary(); }));
$('#searchInput').addEventListener('input', (e) => { ui.search = e.target.value.trim().toLowerCase(); renderLibrary(); });
$('#sortSelect').addEventListener('change', (e) => { ui.sort = e.target.value; renderLibrary(); });

function renderLibrary() {
  const counts = { all: state.books.length };
  Object.keys(STATUS).forEach((k) => (counts[k] = state.books.filter((b) => b.status === k).length));
  $$('[data-count]').forEach((el) => (el.textContent = counts[el.dataset.count] || ''));

  let list = state.books.filter((b) => ui.status === 'all' || b.status === ui.status);
  if (ui.search) list = list.filter((b) => [b.title, b.author, b.genre, (b.tags || []).join(' '), b.isbn, b.publisher].join(' ').toLowerCase().includes(ui.search));
  const sorters = {
    updated: (a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''),
    added: (a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''),
    title: (a, b) => a.title.localeCompare(b.title, 'id'),
    author: (a, b) => (a.author || '').localeCompare(b.author || '', 'id'),
    progress: (a, b) => pct(b) - pct(a),
    rating: (a, b) => (b.rating || 0) - (a.rating || 0),
  };
  list.sort(sorters[ui.sort]);
  $('#resultCount').textContent = `${list.length} buku`;

  const el = $('#bookList');
  if (!state.books.length) {
    el.innerHTML = `<div class="empty"><div class="ic">📚</div><h3>Rak masih kosong</h3><p>Tambahkan buku yang sedang atau ingin kamu baca.</p><button class="btn primary" data-action="add">+ Tambah buku</button></div>`;
    return;
  }
  if (!list.length) { el.innerHTML = `<div class="empty"><div class="ic">🔍</div><h3>Tidak ditemukan</h3><p>Coba kata kunci atau filter lain.</p></div>`; return; }
  el.innerHTML = list.map((b) => {
    const p = pct(b);
    let sub = statusPill(b.status);
    if (b.status === 'reading' || b.status === 'paused') sub += `<div class="progress thin"><span style="width:${p}%"></span></div><span>${p}%</span>`;
    else if (b.status === 'finished') sub += b.rating ? `<span class="stars">${stars(b.rating)}</span>` : `<span>${fmtDate(b.finishDate)}</span>`;
    return `<div class="book-row" data-id="${b.id}" tabindex="0">${cover(b)}
      <div class="info"><div class="ttl">${esc(b.title)}</div><div class="aut">${esc(b.author || 'Penulis tidak diketahui')}</div><div class="sub">${sub}</div></div>
      <span class="chev">›</span></div>`;
  }).join('');
  $$('.book-row', el).forEach((r) => {
    r.onclick = () => openDetail(r.dataset.id);
    r.onkeydown = (e) => { if (e.key === 'Enter') openDetail(r.dataset.id); };
  });
}

/* ---------- FAB / pick ---------- */
$('#fabBtn').addEventListener('click', () => {
  haptic();
  const reading = state.books.filter((b) => b.status === 'reading').sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  if (!state.books.length) return openBookForm();
  if (reading.length === 1) return openLog(reading[0].id);
  const others = state.books.filter((b) => b.status === 'paused' || b.status === 'want').slice(0, 5);
  const items = [...reading, ...others];
  $('#pickList').innerHTML = items.length ? items.map((b) => `<button class="pick-item" data-id="${b.id}">${cover(b)}
      <div class="info"><div class="ttl">${esc(b.title)}</div><div class="pg">${b.status === 'reading' ? `Hlm ${b.currentPage || 0}${b.totalPages ? ' / ' + b.totalPages : ''} · ${pct(b)}%` : STATUS[b.status]}</div></div>
      <span class="go">Catat ›</span></button>`).join('')
    : '<p class="muted small">Belum ada buku yang sedang dibaca.</p>';
  $$('#pickList .pick-item').forEach((x) => (x.onclick = () => { $('#pickSheet').close(); openLog(x.dataset.id); }));
  openSheet($('#pickSheet'));
});

/* ---------- QUICK LOG ---------- */
const logSheet = $('#logSheet');
const logForm = $('#logForm');
const logPage = $('#logPage');
let timer = { start: null, acc: 0, iv: null };

function openLog(id) {
  const b = getBook(id); if (!b) return;
  ui.logId = id;
  logForm.reset();
  $('#logBook').innerHTML = `${cover(b)}<div><div class="ttl">${esc(b.title)}</div><div class="aut">${esc(b.author || '')}</div></div>`;
  logForm.date.value = today();
  logForm.fromPage.value = b.currentPage || 0;
  logPage.value = b.currentPage || 0;
  logPage.max = b.totalPages || '';
  logForm.mood.value = '';
  $$('#moodRow button').forEach((x) => x.classList.remove('active'));
  $('.more', logForm).open = false;
  resetTimer();
  updateLogSub();
  openSheet(logSheet);
}
function updateLogSub() {
  const b = getBook(ui.logId); if (!b) return;
  const from = num(logForm.fromPage.value) ?? (b.currentPage || 0);
  const to = num(logPage.value) ?? 0;
  const diff = to - from;
  const p = b.totalPages ? Math.min(100, Math.round((to / b.totalPages) * 100)) : null;
  $('#logSub').innerHTML = diff > 0
    ? `<b>+${diff} halaman</b> dibaca${p != null ? ` · ${p}% dari ${b.totalPages}` : ''}`
    : `Sebelumnya di halaman ${from}${b.totalPages ? ' dari ' + b.totalPages : ''}`;
}
function setLogPage(v) {
  const b = getBook(ui.logId);
  v = Math.max(0, v);
  if (b?.totalPages) v = Math.min(b.totalPages, v);
  logPage.value = v; updateLogSub(); haptic(5);
}
logPage.addEventListener('input', updateLogSub);
logPage.addEventListener('focus', () => logPage.select());
logForm.fromPage.addEventListener('input', updateLogSub);
$$('.step-btn').forEach((x) => (x.onclick = () => setLogPage((num(logPage.value) || 0) + +x.dataset.step)));
$$('.quick-adds [data-add]').forEach((x) => (x.onclick = () => setLogPage((num(logPage.value) || 0) + +x.dataset.add)));
$('.quick-adds [data-finish]').onclick = () => {
  const b = getBook(ui.logId);
  if (!b?.totalPages) return toast('Isi total halaman buku dulu di menu Edit');
  setLogPage(b.totalPages);
};
$$('#moodRow button').forEach((x) => (x.onclick = () => {
  const on = !x.classList.contains('active');
  $$('#moodRow button').forEach((y) => y.classList.remove('active'));
  x.classList.toggle('active', on);
  logForm.mood.value = on ? x.dataset.mood : '';
}));

function resetTimer() { clearInterval(timer.iv); timer = { start: null, acc: 0, iv: null }; $('#timerDisplay').textContent = '00:00'; const t = $('#timerBtn'); t.textContent = '▶ Timer'; t.classList.remove('running'); }
const elapsed = () => timer.acc + (timer.start ? Date.now() - timer.start : 0);
function renderTimer() {
  const s = Math.floor(elapsed() / 1000), h = Math.floor(s / 3600);
  const mmss = [Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, '0')).join(':');
  $('#timerDisplay').textContent = h ? `${h}:${mmss}` : mmss;
  logForm.minutes.value = Math.max(1, Math.round(elapsed() / 60000));
}
$('#timerBtn').addEventListener('click', () => {
  const t = $('#timerBtn');
  if (timer.start) {
    timer.acc += Date.now() - timer.start; timer.start = null; clearInterval(timer.iv);
    t.textContent = '▶ Lanjut'; t.classList.remove('running');
  } else {
    timer.start = Date.now(); timer.iv = setInterval(renderTimer, 1000); renderTimer();
    t.textContent = '⏸ Jeda'; t.classList.add('running');
  }
});
logSheet.addEventListener('close', () => clearInterval(timer.iv));

logForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const b = getBook(ui.logId); if (!b) return;
  const from = num(logForm.fromPage.value) ?? (b.currentPage || 0);
  let to = num(logPage.value);
  if (to == null) return toast('Isi halaman terakhir yang kamu baca');
  if (b.totalPages) to = Math.min(to, b.totalPages);
  const minutes = num(logForm.minutes.value);
  const note = logForm.note.value.trim();
  if (to === from && !minutes && !note) return toast('Halaman belum berubah — geser angka halamannya dulu');
  (b.sessions = b.sessions || []).push({
    id: uid(), date: logForm.date.value || today(), fromPage: from, toPage: to, minutes,
    place: logForm.place.value.trim(), mood: logForm.mood.value, note,
  });
  if (to > (b.currentPage || 0) || b.currentPage == null) b.currentPage = to;
  if (b.status !== 'reading' && b.status !== 'finished') { b.status = 'reading'; b.startDate = b.startDate || logForm.date.value; }
  touch(b);
  const finished = b.totalPages && b.currentPage >= b.totalPages && b.status !== 'finished';
  save();
  logSheet.close();
  haptic(20);
  toast(to > from ? `Tersimpan · +${to - from} halaman 📖` : 'Sesi tersimpan');
  if (finished && confirm(`🎉 Kamu sudah menamatkan "${b.title}"! Tandai sebagai selesai?`)) {
    b.status = 'finished'; b.finishDate = b.finishDate || today(); touch(b); save();
    render(); openDetail(b.id, 'review');
    return;
  }
  render();
  if ($('#detailSheet').open) renderDetail();
});

/* ---------- BOOK FORM ---------- */
const bookSheet = $('#bookSheet');
const bookForm = $('#bookForm');
const FIELDS = ['title', 'author', 'totalPages', 'currentPage', 'startDate', 'finishDate', 'genre', 'publisher', 'year', 'isbn', 'language', 'source', 'returnDate', 'cover', 'review'];

function bindSeg(segId, inputName, onChange) {
  $$(`#${segId} button`).forEach((x) => (x.onclick = () => { setSeg(segId, inputName, x.dataset.v); onChange && onChange(x.dataset.v); }));
}
function setSeg(segId, inputName, v) {
  bookForm[inputName].value = v;
  $$(`#${segId} button`).forEach((x) => x.classList.toggle('active', x.dataset.v === v));
}
bindSeg('statusSeg', 'status', (s) => {
  if (s === 'reading' && !bookForm.startDate.value) bookForm.startDate.value = today();
  if (s === 'finished') {
    if (!bookForm.finishDate.value) bookForm.finishDate.value = today();
    if (bookForm.totalPages.value) bookForm.currentPage.value = bookForm.totalPages.value;
  }
});
bindSeg('formatSeg', 'format');

function renderStarInput(val) {
  const box = $('#starInput');
  box.innerHTML = [1, 2, 3, 4, 5].map((i) => `<button type="button" data-v="${i}" class="${i <= val ? 'on' : ''}" aria-label="${i} bintang">★</button>`).join('')
    + (val ? `<button type="button" data-v="0" class="clr">Hapus</button>` : '');
  bookForm.rating.value = val || '';
  $$('button', box).forEach((b) => (b.onclick = () => renderStarInput(+b.dataset.v)));
}
function updateCoverPreview() {
  const url = bookForm.cover.value.trim();
  $('#coverPreview').innerHTML = url ? `<img src="${esc(url)}" alt="" onerror="this.parentNode.innerHTML='<span>Gagal dimuat</span>'">` : '<span>Sampul</span>';
}
bookForm.cover.addEventListener('input', updateCoverPreview);

function openBookForm(id) {
  const b = id ? getBook(id) : null;
  ui.editingId = id || null;
  bookForm.reset();
  $('#lookupResults').innerHTML = '';
  $('#lookupInput').value = '';
  $('#bookFormTitle').textContent = b ? 'Edit buku' : 'Tambah buku';
  $('.lookup').classList.toggle('hidden', !!b);
  if (b) {
    FIELDS.forEach((f) => (bookForm[f].value = b[f] ?? ''));
    bookForm.tags.value = (b.tags || []).join(', ');
  } else {
    bookForm.startDate.value = today();
  }
  setSeg('statusSeg', 'status', b?.status || 'reading');
  setSeg('formatSeg', 'format', b?.format || 'physical');
  renderStarInput(b?.rating || 0);
  updateCoverPreview();
  $('#moreDetails').open = !!b;
  openSheet(bookSheet);
  bookSheet.querySelector('.sheet-body').scrollTop = 0;
}

bookForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = bookForm;
  const data = {
    title: f.title.value.trim(), author: f.author.value.trim(), status: f.status.value || 'reading', format: f.format.value || 'physical',
    totalPages: num(f.totalPages.value), currentPage: num(f.currentPage.value) || 0,
    startDate: f.startDate.value, finishDate: f.finishDate.value,
    genre: f.genre.value.trim(), tags: f.tags.value.split(',').map((t) => t.trim()).filter(Boolean),
    publisher: f.publisher.value.trim(), year: num(f.year.value), isbn: f.isbn.value.trim(), language: f.language.value.trim(),
    source: f.source.value.trim(), returnDate: f.returnDate.value, cover: f.cover.value.trim(),
    rating: num(f.rating.value) || 0, review: f.review.value.trim(),
  };
  if (!data.title) { f.title.focus(); return toast('Judul buku wajib diisi'); }
  if (data.totalPages && data.currentPage > data.totalPages) data.currentPage = data.totalPages;
  if (data.status === 'finished' && data.totalPages) data.currentPage = data.totalPages;

  let b;
  if (ui.editingId) { b = getBook(ui.editingId); Object.assign(b, data); }
  else { b = { id: uid(), createdAt: new Date().toISOString(), sessions: [], notes: [], quotes: [], ...data }; state.books.push(b); }
  touch(b); save();
  bookSheet.close();
  haptic(20);
  toast(ui.editingId ? 'Perubahan disimpan' : `“${b.title}” masuk ke rak 📚`);
  render();
  if ($('#detailSheet').open) renderDetail();
});

/* Open Library */
$('#lookupBtn').addEventListener('click', lookup);
$('#lookupInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); lookup(); } });
async function lookup() {
  const q = $('#lookupInput').value.trim(); if (!q) return;
  const box = $('#lookupResults');
  box.innerHTML = '<div class="note">Mencari…</div>';
  const isIsbn = /^[\d-]{10,17}x?$/i.test(q);
  const url = 'https://openlibrary.org/search.json?limit=12&fields=title,author_name,first_publish_year,number_of_pages_median,isbn,cover_i,publisher,subject,language&'
    + (isIsbn ? 'isbn=' + encodeURIComponent(q.replace(/-/g, '')) : 'q=' + encodeURIComponent(q));
  try {
    const res = await fetch(url);
    const docs = (await res.json()).docs || [];
    if (!docs.length) { box.innerHTML = '<div class="note">Tidak ditemukan — isi manual di bawah.</div>'; return; }
    box.innerHTML = docs.map((d, i) => {
      const fake = { title: d.title, author: (d.author_name || [])[0], cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : '' };
      return `<button type="button" class="lk" data-i="${i}">${cover(fake)}<b>${esc(d.title)}</b><span>${esc((d.author_name || [])[0] || '')}${d.first_publish_year ? ' · ' + d.first_publish_year : ''}</span></button>`;
    }).join('');
    $$('.lk', box).forEach((el) => (el.onclick = () => applyLookup(docs[+el.dataset.i])));
  } catch { box.innerHTML = '<div class="note">Tidak bisa terhubung. Periksa internet atau isi manual.</div>'; }
}
function applyLookup(d) {
  const f = bookForm;
  f.title.value = d.title || '';
  f.author.value = (d.author_name || []).slice(0, 3).join(', ');
  if (d.number_of_pages_median) f.totalPages.value = d.number_of_pages_median;
  if (d.first_publish_year) f.year.value = d.first_publish_year;
  if (d.isbn?.length) f.isbn.value = d.isbn.find((x) => x.length === 13) || d.isbn[0];
  if (d.publisher?.length) f.publisher.value = d.publisher[0];
  if (d.subject?.length && !f.genre.value) f.genre.value = d.subject.slice(0, 2).join(', ');
  if (d.cover_i) f.cover.value = `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`;
  updateCoverPreview();
  $('#lookupResults').innerHTML = '';
  toast('Data terisi otomatis — cek lalu simpan');
}

/* ---------- DETAIL ---------- */
const detailSheet = $('#detailSheet');
function openDetail(id, tab) { ui.detailId = id; ui.detailTab = tab || 'sessions'; renderDetail(); openSheet(detailSheet); $('#detailContent').scrollTop = 0; }

function renderDetail() {
  const b = getBook(ui.detailId); if (!b) return detailSheet.close();
  const p = pct(b);
  const sessions = [...(b.sessions || [])].sort((x, y) => (y.date || '').localeCompare(x.date || ''));
  const totalMin = sessions.reduce((s, x) => s + (x.minutes || 0), 0);
  const timedPages = sessions.filter((x) => x.minutes).reduce((s, x) => s + pagesOf(x), 0);
  const speed = totalMin && timedPages ? timedPages / (totalMin / 60) : null;
  const left = b.totalPages ? Math.max(0, b.totalPages - (b.currentPage || 0)) : null;
  const eta = speed && left ? left / speed : null;
  const daysReading = b.startDate ? daysBetween(b.startDate, b.finishDate || today()) + 1 : null;

  const facts = [
    ['Mulai', fmtDate(b.startDate)], ['Selesai', fmtDate(b.finishDate)], ['Lama baca', daysReading ? `${daysReading} hari` : '—'],
    ['Sesi', sessions.length], ['Waktu baca', totalMin ? `${Math.floor(totalMin / 60)}j ${totalMin % 60}m` : '—'],
    ['Kecepatan', speed ? `${speed.toFixed(0)} hlm/jam` : '—'],
    ['Sisa', left != null && b.status !== 'finished' ? `${left} hlm${eta ? ` · ±${eta < 1 ? Math.ceil(eta * 60) + 'm' : eta.toFixed(1) + 'j'}` : ''}` : '—'],
    ['Format', FORMAT[b.format] || '—'], ['Penerbit', b.publisher || '—'], ['Tahun', b.year || '—'],
    ['ISBN', b.isbn || '—'], ['Bahasa', b.language || '—'], ['Asal buku', b.source || '—'],
  ];
  if (b.returnDate) facts.push(['Kembalikan', fmtDate(b.returnDate)]);
  const shownFacts = facts.filter(([, v]) => v !== '—' && v !== '' && v != null);

  const tags = [...(b.genre ? b.genre.split(',').map((g) => g.trim()).filter(Boolean) : []), ...(b.tags || []).map((t) => '#' + t)];
  const tab = ui.detailTab;
  let pane = '';
  if (tab === 'sessions') {
    pane = sessions.length ? sessions.map((s) => `<div class="entry">
        <div class="meta"><b>${fmtDate(s.date)}</b><span>hlm ${s.fromPage ?? '?'} → ${s.toPage ?? '?'}</span><span>+${pagesOf(s)} hlm</span>
        ${s.minutes ? `<span>⏱ ${s.minutes} mnt</span>` : ''}${s.place ? `<span>📍 ${esc(s.place)}</span>` : ''}${s.mood ? `<span>${esc(s.mood)}</span>` : ''}</div>
        ${s.note ? `<p>${esc(s.note)}</p>` : ''}
        <button class="del" data-del="sessions" data-id="${s.id}" aria-label="Hapus">✕</button></div>`).join('')
      : `<p class="muted small">Belum ada riwayat. Tekan <b>Catat bacaan</b> setiap selesai membaca.</p>`;
  } else if (tab === 'notes' || tab === 'quotes') {
    const isQ = tab === 'quotes';
    const items = [...(b[tab] || [])].sort((x, y) => (y.date || '').localeCompare(x.date || ''));
    pane = `<form class="add-box" id="addEntry">
        <textarea name="text" rows="3" required placeholder="${isQ ? 'Tulis kutipan favoritmu…' : 'Ringkasan bab, tokoh, pemikiranmu…'}"></textarea>
        <div class="row"><input name="page" type="number" inputmode="numeric" min="0" placeholder="Halaman" value="${b.currentPage || ''}">
        <button class="btn primary" type="submit">${isQ ? 'Simpan kutipan' : 'Simpan catatan'}</button></div>
      </form>` + (items.length ? items.map((n) => `<div class="entry ${isQ ? 'quote' : ''}">
        <div class="meta">${n.page != null ? `<b>hlm ${n.page}</b>` : ''}<span>${fmtDate(n.date)}</span></div>
        <p>${isQ ? '“' + esc(n.text) + '”' : esc(n.text)}</p>
        <button class="del" data-del="${tab}" data-id="${n.id}" aria-label="Hapus">✕</button></div>`).join('')
      : `<p class="muted small">${isQ ? 'Belum ada kutipan.' : 'Belum ada catatan.'}</p>`);
  } else {
    pane = `<div class="stars" style="font-size:1.7rem;margin-bottom:8px">${stars(b.rating)}</div>
      <div class="review-box">${b.review ? esc(b.review) : '<span class="muted">Belum ada ulasan.</span>'}</div>
      <button class="btn block" style="margin-top:14px" data-act="edit">✎ ${b.review || b.rating ? 'Ubah' : 'Tulis'} rating & ulasan</button>`;
  }

  $('#detailContent').innerHTML = `
    <div class="detail-bar">
      <button class="icon-btn" data-close aria-label="Kembali"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
      <div class="acts">
        <button class="btn sm" data-act="edit">Edit</button>
        <button class="btn sm danger" data-act="delete">Hapus</button>
      </div>
    </div>
    <div class="detail-hero">
      ${cover(b)}
      <div style="min-width:0">
        ${statusPill(b.status)}
        <h2 style="margin-top:8px">${esc(b.title)}</h2>
        <div class="aut">${esc(b.author || 'Penulis tidak diketahui')}</div>
        ${b.rating ? `<div class="stars">${stars(b.rating)}</div>` : ''}
        ${tags.length ? `<div class="tag-row">${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
      </div>
    </div>
    <div class="detail-section">
      <div class="read-progress" style="margin-top:0">
        <div class="row"><span>Halaman <b>${b.currentPage || 0}</b>${b.totalPages ? ' / ' + b.totalPages : ''}</span><b>${p}%</b></div>
        <div class="progress"><span style="width:${p}%"></span></div>
      </div>
      <div class="detail-cta">
        ${b.status !== 'finished' ? `<button class="btn primary" data-act="log">✎ Catat bacaan</button>` : ''}
        <select class="status-select" data-act="status" aria-label="Ubah status">
          ${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === b.status ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="detail-section"><dl class="fact-grid">${shownFacts.map(([k, v]) => `<div class="fact"><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></div>
    <div class="seg-tabs">
      ${[['sessions', `Riwayat (${sessions.length})`], ['notes', `Catatan (${(b.notes || []).length})`], ['quotes', `Kutipan (${(b.quotes || []).length})`], ['review', 'Ulasan']]
        .map(([k, v]) => `<button data-tab="${k}" class="${k === tab ? 'active' : ''}">${v}</button>`).join('')}
    </div>
    <div class="tab-pane">${pane}</div>`;

  const root = $('#detailContent');
  $$('[data-tab]', root).forEach((t) => (t.onclick = () => { ui.detailTab = t.dataset.tab; renderDetail(); }));
  $$('[data-act="edit"]', root).forEach((x) => (x.onclick = () => openBookForm(b.id)));
  const lb = $('[data-act="log"]', root); if (lb) lb.onclick = () => openLog(b.id);
  $('[data-act="delete"]', root).onclick = () => {
    if (!confirm(`Hapus "${b.title}" beserta semua riwayat & catatannya?`)) return;
    state.books = state.books.filter((x) => x.id !== b.id); save();
    detailSheet.close(); render(); toast('Buku dihapus');
  };
  $('[data-act="status"]', root).onchange = (e) => {
    b.status = e.target.value;
    if (b.status === 'reading' && !b.startDate) b.startDate = today();
    if (b.status === 'finished') { b.finishDate = b.finishDate || today(); if (b.totalPages) b.currentPage = b.totalPages; ui.detailTab = 'review'; toast('🎉 Selamat! Beri rating & ulasan, yuk'); }
    touch(b); save(); renderDetail(); render();
  };
  $$('[data-del]', root).forEach((x) => (x.onclick = () => {
    if (!confirm('Hapus item ini?')) return;
    const key = x.dataset.del;
    b[key] = (b[key] || []).filter((s) => s.id !== x.dataset.id);
    if (key === 'sessions') {
      const max = Math.max(0, ...b.sessions.map((s) => s.toPage || 0));
      if (b.status !== 'finished') b.currentPage = max;
    }
    touch(b); save(); renderDetail(); render();
  }));
  const af = $('#addEntry', root);
  if (af) af.onsubmit = (e) => {
    e.preventDefault();
    const text = af.text.value.trim(); if (!text) return;
    (b[tab] = b[tab] || []).push({ id: uid(), date: today(), page: num(af.page.value), text });
    touch(b); save(); renderDetail(); toast(tab === 'quotes' ? 'Kutipan disimpan ✨' : 'Catatan disimpan');
  };
}

/* ---------- STATS ---------- */
function renderStats() {
  const now = new Date(), year = now.getFullYear();
  const byDay = pagesByDay();
  const finished = state.books.filter((b) => b.status === 'finished');
  const finYear = finished.filter((b) => (b.finishDate || '').startsWith(String(year)));
  const sessions = state.books.flatMap((b) => (b.sessions || []).map((s) => ({ ...s, book: b })));
  const totalPages = Object.values(byDay).reduce((a, b) => a + b, 0)
    + finished.filter((b) => !(b.sessions || []).length).reduce((a, b) => a + (b.totalPages || 0), 0);
  const totalMin = sessions.reduce((a, s) => a + (s.minutes || 0), 0);
  const rated = finished.filter((b) => b.rating);
  const avg = rated.length ? (rated.reduce((a, b) => a + b.rating, 0) / rated.length).toFixed(1) : '—';
  const { goalYearly } = state.settings;
  const yPct = goalYearly ? Math.min(100, Math.round((finYear.length / goalYearly) * 100)) : null;

  const cards = [
    [`${finYear.length}${goalYearly ? `<span class="muted" style="font-size:1rem"> / ${goalYearly}</span>` : ''}`, `Buku selesai ${year}`, yPct],
    [`${streak(byDay)} 🔥`, 'Hari beruntun'],
    [totalPages.toLocaleString('id-ID'), 'Total halaman'],
    [totalMin ? `${Math.floor(totalMin / 60)}<small>j</small> ${totalMin % 60}<small>m</small>` : '0', 'Waktu membaca'],
    [state.books.filter((b) => b.status === 'reading').length, 'Sedang dibaca'],
    [finished.length, 'Total selesai'],
    [sessions.length, 'Sesi tercatat'],
    [avg === '—' ? '—' : `${avg} <span class="stars" style="font-size:1rem">★</span>`, 'Rata-rata rating'],
  ];
  $('#statGrid').innerHTML = cards.map(([v, k, g]) => `<div class="stat"><div class="v">${v}</div><div class="k">${k}</div>
    ${g != null ? `<div class="progress"><span style="width:${g}%"></span></div><div class="gl">${g}% dari target</div>` : ''}</div>`).join('');

  const days = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(toISO(d)); }
  const mx = Math.max(1, ...days.map((d) => byDay[d] || 0));
  $('#chartDays').innerHTML = days.map((d) => {
    const v = byDay[d] || 0;
    return `<div class="bar ${v ? '' : 'zero'} ${d === today() ? 'today' : ''}" title="${fmtDate(d)}: ${v} halaman"><em>${v || ''}</em><i style="height:${Math.max(2, (v / mx) * 100)}%"></i><small>${+d.slice(8)}</small></div>`;
  }).join('');

  $('#yearLabel').textContent = '· ' + year;
  const pm = Array(12).fill(0);
  finYear.forEach((b) => pm[+b.finishDate.slice(5, 7) - 1]++);
  const mm = Math.max(1, ...pm);
  $('#chartMonths').innerHTML = pm.map((v, i) => `<div class="bar ${v ? '' : 'zero'}" title="${MONTHS[i]}: ${v} buku"><em>${v || ''}</em><i style="height:${Math.max(2, (v / mm) * 100)}%"></i><small>${MONTHS[i].slice(0, 1)}</small></div>`).join('');

  const g = {};
  state.books.forEach((b) => (b.genre || '').split(',').map((x) => x.trim()).filter(Boolean).forEach((x) => (g[x] = (g[x] || 0) + 1)));
  const gl = Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, 6);
  $('#genreList').innerHTML = gl.length ? gl.map(([k, v]) => `<div class="rank-item"><div class="row"><span>${esc(k)}</span><span class="muted">${v} buku</span></div><div class="progress thin"><span style="width:${(v / gl[0][1]) * 100}%"></span></div></div>`).join('')
    : '<p class="muted small">Isi genre pada buku untuk melihat statistik ini.</p>';

  const recent = sessions.sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 10);
  $('#activityList').innerHTML = recent.length ? recent.map((s) => `<div class="tl-item"><span class="d">${fmtDate(s.date, false)}</span>
    <span><b>${esc(s.book.title)}</b> · hlm ${s.fromPage ?? '?'}–${s.toPage ?? '?'}${s.minutes ? ` · ${s.minutes} mnt` : ''}${s.note ? `<br><span class="muted">${esc(s.note)}</span>` : ''}</span></div>`).join('')
    : '<p class="muted small">Belum ada aktivitas.</p>';
}

/* ---------- SETTINGS ---------- */
function renderSettings() {
  $('#goalDaily').value = state.settings.goalDaily ?? '';
  $('#goalYearly').value = state.settings.goalYearly ?? '';
  $('#remindDays').value = state.settings.remindDays ?? '';
  applyTheme(document.documentElement.dataset.theme || null);
}
$('#saveGoals').addEventListener('click', () => {
  state.settings.goalDaily = num($('#goalDaily').value) || 0;
  state.settings.goalYearly = num($('#goalYearly').value) || 0;
  state.settings.remindDays = num($('#remindDays').value) || 3;
  save(); toast('Target disimpan ✓');
});
function download(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}
$('#exportBtn').addEventListener('click', () => download(`books-track-${today()}.json`, JSON.stringify(state, null, 2), 'application/json'));
$('#exportCsvBtn').addEventListener('click', () => {
  const cols = ['title', 'author', 'status', 'format', 'currentPage', 'totalPages', 'startDate', 'finishDate', 'rating', 'genre', 'tags', 'publisher', 'year', 'isbn', 'language', 'source', 'review'];
  const q = (v) => `"${String(Array.isArray(v) ? v.join('; ') : v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...state.books.map((b) => cols.map((c) => q(c === 'status' ? STATUS[b.status] : c === 'format' ? FORMAT[b.format] : b[c])).join(','))].join('\n');
  download(`books-track-${today()}.csv`, '﻿' + csv, 'text/csv');
});
$('#importInput').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.books)) throw new Error('format');
    const merge = state.books.length && confirm('Gabungkan dengan data yang ada?\n\nOK = gabungkan\nBatal = ganti semua data');
    if (merge) {
      const ids = new Set(state.books.map((b) => b.id));
      data.books.forEach((b) => { if (!ids.has(b.id)) state.books.push(b); });
    } else {
      state.books = data.books;
      if (data.settings) state.settings = { ...DEFAULT_SETTINGS, ...data.settings };
    }
    save(); renderSettings(); toast(`Impor berhasil · ${data.books.length} buku`);
  } catch { toast('⚠ File cadangan tidak valid'); }
  e.target.value = '';
});
$('#clearBtn').addEventListener('click', () => {
  if (confirm('Hapus SEMUA buku dan catatan di perangkat ini?\nEkspor dulu jika ingin menyimpan cadangan.') && confirm('Yakin? Tindakan ini tidak bisa dibatalkan.')) {
    state.books = []; save(); toast('Semua data dihapus'); render();
  }
});

/* ---------- PWA ---------- */
let installEvt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; $('#installBtn').classList.remove('hidden'); });
$('#installBtn').addEventListener('click', async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; $('#installBtn').classList.add('hidden'); });
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

/* ---------- Keyboard (desktop) ---------- */
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || $('dialog[open]')) return;
  if (e.key === 'n') { e.preventDefault(); openBookForm(); }
  if (e.key === 'c') { e.preventDefault(); $('#fabBtn').click(); }
});

/* ---------- Init ---------- */
render();
// segarkan beranda saat aplikasi dibuka kembali (mis. hari berganti)
document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('dialog[open]')) render(); });
