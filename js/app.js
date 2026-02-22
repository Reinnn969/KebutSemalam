/* ============================================================
   KEBUTSEMALAM — app.js
   Semua logika: State, Navigation, AI, Flashcard,
   Feynman, Soal, Rangkuman, Pomodoro, Jurnal
   ============================================================ */

'use strict';

/* ============================================================
   STATE & STORAGE
   ============================================================ */
const STATE = {
  xp:       0,
  streak:   1,
  sessions: 0,
  lastDate: '',
  journals: [],
  pomo: { sessions: 0, minutes: 0 }
};

function loadState() {
  try {
    const d = localStorage.getItem('ks_state');
    if (d) Object.assign(STATE, JSON.parse(d));
  } catch (e) { console.warn('loadState error', e); }

  // Streak check
  const today = todayStr();
  if (STATE.lastDate && STATE.lastDate !== today) {
    const diff = dayDiff(STATE.lastDate, today);
    if (diff > 1) STATE.streak = 1; // reset
    else STATE.streak += 1;
  }
  STATE.lastDate = today;
  saveState();
}

function saveState() {
  localStorage.setItem('ks_state', JSON.stringify(STATE));
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function dayDiff(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

/* ============================================================
   UI UPDATE
   ============================================================ */
function updateUI() {
  const lvl  = Math.floor(STATE.xp / 100) + 1;
  const xpIn = STATE.xp % 100;

  // Sidebar
  document.getElementById('sbLvl').textContent  = lvl;
  document.getElementById('sbXP').textContent   = STATE.xp + ' XP';
  document.getElementById('sbNext').textContent = (lvl * 100) + ' XP';
  document.getElementById('sbBar').style.width  = xpIn + '%';

  // Topbar
  document.getElementById('tXP').textContent     = STATE.xp;
  document.getElementById('tStreak').textContent  = STATE.streak;

  // Home hero
  document.getElementById('h-xp').textContent     = STATE.xp;
  document.getElementById('h-streak').textContent  = STATE.streak;
  document.getElementById('h-sess').textContent    = STATE.sessions;

}

function addXP(n) {
  STATE.xp += n;
  saveState();
  updateUI();
  showToast('+' + n + ' XP ⭐');
}

/* ============================================================
   API KEY MODAL — tidak digunakan (key ada di api.php)
   ============================================================ */
function saveApiKey()  { closeApiModal(); }
function closeApiModal() {
  document.getElementById('apiModal').classList.remove('show');
}
const PAGE_TITLES = {
  home:      '🏠 BERANDA',
  flashcard: '🃏 FLASH CARD',
  feynman:   '🧠 FEYNMAN',
  soal:      '📝 SOAL BERGRADASI',
  rangkuman: '📄 RANGKUMAN',
  pomodoro:  '⏱️ POMODORO',
  jurnal:    '📓 JURNAL',
};

function goPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById('page-' + id);
  const nav  = document.getElementById('nav-'  + id);
  if (page) page.classList.add('active');
  if (nav)  nav.classList.add('active');

  document.getElementById('pageTitle').textContent = PAGE_TITLES[id] || 'KEBUTSEMALAM';
  closeSidebar();
  window.scrollTo(0, 0);
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const hm = document.getElementById('hamBtn');
  const ov = document.getElementById('overlay');
  sb.classList.toggle('open');
  hm.classList.toggle('active');
  ov.classList.toggle('show');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('hamBtn').classList.remove('active');
  document.getElementById('overlay').classList.remove('show');
}

/* ============================================================
   LOADING BAR
   ============================================================ */
function showLoad(v) {
  document.getElementById('loadBar').classList.toggle('show', v);
}

/* ============================================================
   TOAST
   ============================================================ */
let _toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('xpToast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ============================================================
   NAVIGATION
   ============================================================ */

/* ============================================================
   CLAUDE API CALL  (via api.php — key ada di server)
   ============================================================ */
async function callClaude(messages, system = '', maxTokens = 2000) {
  showLoad(true);
  try {
    const body = {
      model:      'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages
    };
    if (system) body.system = system;

    const res = await fetch('api.php', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });

    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || 'API Error');

    return data.content[0].text;
  } finally {
    showLoad(false);
  }
}

/* ============================================================
   STICKER
   ============================================================ */
const STICKERS_BENAR = [
  'stickers/StikerBenar1.png',
  'stickers/StikerBenar2.png',
  'stickers/StikerBenar3.png',
];
const STICKERS_SALAH = [
  'stickers/StikerSalah1.png',
  'stickers/StikerSalah2.png',
  'stickers/StikerSalah3.png',
];
const MSG_BENAR = ['YEAY! Bener Banget! 🎉', 'Mantap Jiwa! 🔥', 'GG! Top Markotop! 👑', 'Paham Pol! ✨', 'Kamu Luar Biasa! 💪'];
const MSG_SALAH = ['Yah, Kurang Tepat... 💔', 'Hampir! Jangan Nyerah! 💪', 'Next Time Pasti Bisa! 🤞', 'Baca Ulang Materinya Ya! 📖'];

let _stickerTimer = null;

function showSticker(benar, xp = 0) {
  const ov   = document.getElementById('stickerOverlay');
  const wrap = document.getElementById('stickerImgWrap');
  const msg  = document.getElementById('stickerMsg');
  const sub  = document.getElementById('stickerSub');
  const xpEl = document.getElementById('stickerXP');

  const list = benar ? STICKERS_BENAR : STICKERS_SALAH;
  const msgs = benar ? MSG_BENAR      : MSG_SALAH;
  const src  = list[Math.floor(Math.random() * list.length)];

  wrap.innerHTML = '';
  const img = document.createElement('img');
  img.className = 'sticker-img';
  img.src = src;
  img.onerror = () => {
    wrap.innerHTML = '<div class="sticker-fallback">' + (benar ? '🎉' : '😢') + '</div>';
  };
  wrap.appendChild(img);

  msg.textContent = msgs[Math.floor(Math.random() * msgs.length)];
  msg.className   = 'sticker-msg ' + (benar ? 'benar' : 'salah');
  sub.textContent = benar ? 'Pertahankan terus ya!' : 'Jangan menyerah, coba lagi!';
  xpEl.textContent = xp > 0 ? '+' + xp + ' XP' : '';

  ov.classList.add('show');
  clearTimeout(_stickerTimer);
  _stickerTimer = setTimeout(() => ov.classList.remove('show'), 2800);
}

/* ============================================================
   ===  FLASHCARD  ===
   ============================================================ */
const FC = {
  cards:   [],
  cur:     0,
  flipped: false,
  b:       0,   // benar
  s:       0,   // salah
};

async function genFlashcard() {
  const mat   = document.getElementById('fc-mat').value.trim();
  const topic = document.getElementById('fc-topic').value.trim() || 'Materi';
  const cnt   = parseInt(document.getElementById('fc-count').value) || 8;

  if (mat.length < 30) { alert('Materi terlalu pendek! Minimal 30 karakter.'); return; }

  const sys = `Kamu adalah guru yang membuat flashcard untuk pelajar SMP/SMA Indonesia.
Buat tepat ${cnt} flashcard dari materi berikut.

FORMAT WAJIB — hanya output JSON array, tidak ada teks lain sama sekali:
[{"q":"Pertanyaan?","a":"Jawaban lengkap dan jelas."},...]

Variasikan jenis pertanyaan: definisi, fungsi, proses, contoh, perbedaan, sebab-akibat.
Gunakan bahasa Indonesia yang jelas dan mudah dipahami.
PENTING: Hanya output JSON valid, tidak ada markdown, tidak ada penjelasan tambahan.`;

  try {
    const raw    = await callClaude([{ role: 'user', content: 'Topik: ' + topic + '\n\nMateri:\n' + mat }], sys, 3000);
    const clean  = raw.replace(/```json|```/g, '').trim();
    const cards  = JSON.parse(clean);
    if (!Array.isArray(cards) || cards.length === 0) throw new Error('Format tidak valid');

    FC.cards   = cards;
    FC.cur     = 0;
    FC.flipped = false;
    FC.b       = 0;
    FC.s       = 0;

    document.getElementById('fc-empty').style.display    = 'none';
    document.getElementById('fc-active').style.display   = 'block';
    document.getElementById('fc-list-card').style.display = 'block';

    renderFC();
    renderFCList();
  } catch (e) {
    alert('Gagal generate flashcard: ' + e.message);
  }
}

function renderFC() {
  const { cards, cur } = FC;
  if (cur >= cards.length) { fcResult(); return; }

  const c = cards[cur];
  document.getElementById('fc-front').textContent = c.q;
  document.getElementById('fc-back').textContent  = c.a;
  document.getElementById('fc-ctr').textContent   = (cur + 1) + ' / ' + cards.length;
  document.getElementById('fc-r').textContent     = cards.length - cur - 1;
  document.getElementById('fc-b').textContent     = FC.b;
  document.getElementById('fc-s').textContent     = FC.s;

  const card = document.getElementById('fc-card');
  card.classList.remove('flipped');
  FC.flipped = false;
  document.getElementById('fc-btns').style.display = 'none';
  document.getElementById('fc-hint').style.display  = 'block';

  // Update list highlight
  document.querySelectorAll('.fc-list-item')
    .forEach((el, i) => el.classList.toggle('active', i === cur));
}

function flipFC() {
  const card = document.getElementById('fc-card');
  card.classList.toggle('flipped');
  FC.flipped = card.classList.contains('flipped');

  document.getElementById('fc-btns').style.display = FC.flipped ? 'grid' : 'none';
  document.getElementById('fc-hint').style.display  = FC.flipped ? 'none'  : 'block';
}

function fcNav(dir) {
  FC.cur = Math.max(0, Math.min(FC.cards.length - 1, FC.cur + dir));
  renderFC();
}

function fcAns(ok) {
  if (ok) { FC.b++; addXP(10); }
  else       FC.s++;

  showSticker(ok, ok ? 10 : 0);

  setTimeout(() => {
    FC.cur++;
    renderFC();
    // Update list
    renderFCList();
  }, 2900);
}

function renderFCList() {
  document.getElementById('fc-list').innerHTML = FC.cards.map((c, i) => `
    <div class="fc-list-item ${i === FC.cur ? 'active' : ''}" onclick="FC.cur=${i};renderFC()">
      <span class="fc-list-num">${i + 1}</span>
      <span class="fc-list-q">${escHtml(c.q)}</span>
    </div>`).join('');
}

function fcResult() {
  STATE.sessions++;
  saveState();
  updateUI();

  const total = FC.cards.length;
  const pct   = Math.round((FC.b / total) * 100);
  const emoji = pct >= 80 ? '🏆' : pct >= 50 ? '😊' : '💪';
  const title = pct >= 80 ? 'Luar Biasa!' : pct >= 50 ? 'Lumayan Nih!' : 'Terus Semangat!';

  document.getElementById('fc-active').innerHTML = `
    <div style="text-align:center;padding:40px 20px;">
      <div style="font-size:64px;margin-bottom:14px;">${emoji}</div>
      <div style="font-family:var(--font-d);font-size:26px;font-weight:800;color:var(--text);margin-bottom:8px;">${title}</div>
      <div style="color:var(--text2);font-size:14px;margin-bottom:28px;">
        Benar: <strong style="color:var(--green)">${FC.b}</strong> /
        Salah: <strong style="color:var(--red)">${FC.s}</strong> /
        Akurasi: <strong style="color:var(--accent-b)">${pct}%</strong>
      </div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="fcRestart()">🔄 Ulangi</button>
        <button class="btn btn-outline" onclick="fcReset()">➕ Materi Baru</button>
      </div>
    </div>`;
}

function fcRestart() {
  FC.cur     = 0;
  FC.flipped = false;
  FC.b       = 0;
  FC.s       = 0;
  // Re-render active area
  document.getElementById('fc-active').innerHTML = `
    <div class="fc-nav-row">
      <span class="fc-counter-txt" id="fc-ctr">0 / 0</span>
      <div class="row-gap">
        <button class="btn btn-outline btn-sm" onclick="fcNav(-1)">← Prev</button>
        <button class="btn btn-outline btn-sm" onclick="fcNav(1)">Next →</button>
      </div>
    </div>
    <div class="card-3d">
      <div class="flashcard" id="fc-card" onclick="flipFC()">
        <div class="fc-face front">
          <div class="fc-label">❓ PERTANYAAN · Klik untuk balik</div>
          <div class="fc-text" id="fc-front">—</div>
        </div>
        <div class="fc-face back">
          <div class="fc-label">✅ JAWABAN</div>
          <div class="fc-text" id="fc-back">—</div>
        </div>
      </div>
    </div>
    <div id="fc-hint" class="fc-hint-row"><span>Klik kartu untuk lihat jawaban</span></div>
    <div class="fc-ans-btns" id="fc-btns" style="display:none;">
      <button class="btn btn-green btn-full" onclick="fcAns(true)">✅ Paham / Benar</button>
      <button class="btn btn-red   btn-full" onclick="fcAns(false)">❌ Belum Paham</button>
    </div>
    <div class="card mt-12">
      <div class="fc-score-grid">
        <div><div class="fc-score-val green" id="fc-b">0</div><div class="fc-score-lbl">Benar</div></div>
        <div><div class="fc-score-val red"   id="fc-s">0</div><div class="fc-score-lbl">Salah</div></div>
        <div><div class="fc-score-val blue"  id="fc-r">0</div><div class="fc-score-lbl">Sisa</div></div>
      </div>
    </div>`;
  renderFC();
  renderFCList();
}

function fcReset() {
  FC.cards = [];
  document.getElementById('fc-empty').style.display    = 'block';
  document.getElementById('fc-active').style.display   = 'none';
  document.getElementById('fc-list-card').style.display = 'none';
}

/* ============================================================
   ===  FEYNMAN TECHNIQUE  ===
   ============================================================ */
const FEY = {
  hist:   [],
  topic:  '',
  active: false,
};

async function startFey() {
  const topic = document.getElementById('fey-topic').value.trim();
  if (!topic) { alert('Masukkan topik dulu!'); return; }

  FEY.hist   = [];
  FEY.topic  = topic;
  FEY.active = true;

  document.getElementById('fey-setup').style.display = 'none';
  document.getElementById('fey-chat').style.display  = 'block';
  document.getElementById('fey-topic-chip').textContent = topic;
  document.getElementById('chat-msgs').innerHTML = '';

  const intro = `Hei! Katanya kamu mau jelasin sesuatu ke aku? 😊 Aku tuh beneran ga tau tentang "${topic}" deh... Bisa jelasin ke aku ga? Pake bahasa yang simpel ya, aku agak lemot soalnya hehe 😅`;
  addChatMsg('ai', intro);
  FEY.hist.push({ role: 'assistant', content: intro });
}

async function sendMsg() {
  const inp = document.getElementById('chat-in');
  const txt = inp.value.trim();
  if (!txt || !FEY.active) return;

  inp.value = '';
  inp.style.height = '48px';
  addChatMsg('user', txt);
  FEY.hist.push({ role: 'user', content: txt });

  // Thinking
  const thinkId = 'tk_' + Date.now();
  const chatEl  = document.getElementById('chat-msgs');
  chatEl.innerHTML += `
    <div class="msg ai" id="${thinkId}">
      <div class="msg-avatar">🤔</div>
      <div class="bubble"><div class="dots"><span></span><span></span><span></span></div></div>
    </div>`;
  scrollChat();

  const mode = document.getElementById('fey-mode').value;
  const modeInstr = {
    easy:   'Tanya hanya hal-hal simpel dan dasar. Mudah puas dengan penjelasan singkat.',
    medium: 'Sesekali minta klarifikasi, contoh nyata, atau penjelasan lebih lanjut.',
    hard:   'Selalu tanya "kenapa bisa begitu?", minta detail mendalam, dan tantang penjelasan user.',
  };

  const sys = `Kamu adalah murid SMP bernama Dito yang BENAR-BENAR tidak tahu apa-apa tentang "${FEY.topic}".
Kepribadianmu: polos, penasaran, terkadang lucu, dan selalu jujur kalau tidak mengerti.

ATURAN MAIN:
1. ${modeInstr[mode] || modeInstr.medium}
2. Kalau ada fakta yang JELAS SALAH secara ilmiah, koreksi DENGAN LEMBUT: "eh tapi aku pernah baca katanya..."
3. JANGAN pernah jelasin materi sendiri. Biarkan user yang jelasin.
4. Pakai bahasa Indonesia santai, singkat (2-4 kalimat saja per respons).
5. Variasikan respons: kadang "oh gitu!", "wah seru!", "beneran?", "terus terus?", "kok bisa?"
6. TETAP in-character sebagai murid polos. JANGAN keluar dari peran.`;

  try {
    const reply = await callClaude([...FEY.hist], sys, 400);
    document.getElementById(thinkId)?.remove();
    addChatMsg('ai', reply);
    FEY.hist.push({ role: 'assistant', content: reply });

    // Kasih XP tiap 3 pesan user
    const userCount = FEY.hist.filter(m => m.role === 'user').length;
    if (userCount > 0 && userCount % 3 === 0) addXP(15);
  } catch (e) {
    document.getElementById(thinkId)?.remove();
    addChatMsg('ai', '😅 Aduh ada gangguan nih, coba kirim lagi ya!');
  }
}

function chatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMsg();
  }
}

function addChatMsg(role, text) {
  const area   = document.getElementById('chat-msgs');
  const avatar = role === 'user' ? '👤' : '🤔';
  area.innerHTML += `
    <div class="msg ${role}">
      <div class="msg-avatar">${avatar}</div>
      <div class="bubble">${escHtml(text).replace(/\n/g, '<br>')}</div>
    </div>`;
  scrollChat();
}

function scrollChat() {
  const area = document.getElementById('chat-msgs');
  area.scrollTop = area.scrollHeight;
}

async function endFey() {
  if (!FEY.active) return;
  FEY.active = false;

  const endMsg = 'Oke, sesi selesai! Sekarang berikan feedback jujur tentang penjelasanku tadi ya — apa yang udah benar, apa yang kurang tepat, dan tips buat belajar topik ini lebih lanjut.';
  FEY.hist.push({ role: 'user', content: endMsg });

  const sys = `Kamu adalah tutor yang memberikan feedback konstruktif dan memotivasi dalam Bahasa Indonesia.
Struktur feedback:
1. Apresiasi usaha user dengan tulus
2. Poin-poin yang sudah dijelaskan dengan BENAR
3. Koreksi hal yang kurang tepat atau perlu dilengkapi (kalau ada)
4. Saran konkret untuk belajar lebih lanjut
Gunakan bahasa yang hangat, supportif, dan memotivasi. Tidak perlu terlalu panjang.`;

  try {
    const feedback = await callClaude([...FEY.hist], sys, 700);
    addChatMsg('ai', '📋 FEEDBACK SESI:\n\n' + feedback);
    addXP(30);
    STATE.sessions++;
    saveState();
    updateUI();
  } catch (e) {
    addChatMsg('ai', 'Sesi selesai! Kerja bagus ya sudah mau mencoba! 🎉');
  }

  // Reset ke setup setelah 15 detik
  setTimeout(() => {
    document.getElementById('fey-setup').style.display = 'block';
    document.getElementById('fey-chat').style.display  = 'none';
  }, 15000);
}

/* ============================================================
   ===  SOAL BERGRADASI  ===
   ============================================================ */
const SOAL = {
  mudah:  [],
  sedang: [],
  sulit:  [],
  cur:    0,
  diff:   'mudah',
  b:      0,
  s:      0,
  xpSesi: 0,
  answered: false,
};

let selectedOpt = -1;

async function genSoal() {
  const mat   = document.getElementById('soal-mat').value.trim();
  const per   = parseInt(document.getElementById('soal-per').value) || 3;
  const mapel = document.getElementById('soal-mapel').value;

  if (mat.length < 10) { alert('Masukkan materi atau topik dulu!'); return; }

  const sys = `Kamu adalah guru pembuat soal untuk pelajar SMP/SMA mata pelajaran ${mapel}.
Buat soal pilihan ganda dengan 3 tingkat kesulitan, ${per} soal masing-masing.

FORMAT WAJIB — hanya output JSON, tidak ada teks lain:
{
  "mudah":  [{"soal":"...","pilihan":["A. ...","B. ...","C. ...","D. ..."],"jawaban":0,"penjelasan":"..."},...],
  "sedang": [...],
  "sulit":  [...]
}

"jawaban" = index pilihan yang benar (0=A, 1=B, 2=C, 3=D).
MUDAH:  ingatan / definisi dasar
SEDANG: pemahaman / penerapan konsep
SULIT:  analisis / evaluasi / sintesis

Pastikan semua pilihan jawaban masuk akal (bukan jawaban yang jelas salah).
PENTING: Hanya output JSON valid.`;

  try {
    const raw    = await callClaude([{ role: 'user', content: mat }], sys, 4000);
    const clean  = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    SOAL.mudah   = parsed.mudah  || [];
    SOAL.sedang  = parsed.sedang || [];
    SOAL.sulit   = parsed.sulit  || [];
    SOAL.cur     = 0;
    SOAL.diff    = 'mudah';
    SOAL.b       = 0;
    SOAL.s       = 0;
    SOAL.xpSesi  = 0;
    SOAL.answered = false;

    document.getElementById('soal-setup').style.display = 'none';
    document.getElementById('soal-quiz').style.display  = 'block';

    switchDiff('mudah');
  } catch (e) {
    alert('Gagal generate soal: ' + e.message);
  }
}

function switchDiff(d) {
  SOAL.diff     = d;
  SOAL.cur      = 0;
  SOAL.answered = false;
  selectedOpt   = -1;

  // Update tabs
  document.querySelectorAll('.dtab').forEach(t => {
    t.classList.remove('act', 'mudah', 'sedang', 'sulit');
  });
  const tab = document.getElementById('dtab-' + d);
  if (tab) tab.classList.add('act', d);

  // Update tag
  const tagMap = {
    mudah:  { cls: 'tag-green',  txt: '🟢 Mudah'  },
    sedang: { cls: 'tag-yellow', txt: '🟡 Sedang' },
    sulit:  { cls: 'tag-red',    txt: '🔴 Sulit'  },
  };
  const tag = document.getElementById('soal-tag');
  tag.className   = 'tag ' + tagMap[d].cls;
  tag.textContent = tagMap[d].txt;

  renderSoal();
}

function renderSoal() {
  const list = SOAL[SOAL.diff] || [];
  const { cur } = SOAL;

  if (list.length === 0) {
    document.getElementById('soal-q').textContent = 'Soal tidak tersedia untuk tingkat ini.';
    return;
  }

  if (cur >= list.length) { soalResult(); return; }

  const soal = list[cur];
  document.getElementById('soal-ctr').textContent  = 'Soal ' + (cur + 1) + ' dari ' + list.length;
  document.getElementById('soal-q').textContent    = soal.soal;
  document.getElementById('soal-fb').style.display = 'none';
  document.getElementById('soal-nxt').style.display = 'none';
  SOAL.answered = false;
  selectedOpt   = -1;

  // Dots
  document.getElementById('soal-dots').innerHTML = list.map((_, i) => `
    <div class="soal-dot ${i < cur ? 'done' : i === cur ? 'cur' : ''}"></div>`).join('');

  // Pilihan
  const ltrs = ['A', 'B', 'C', 'D', 'E'];
  document.getElementById('soal-opts').innerHTML = soal.pilihan.map((p, i) => `
    <button class="soal-opt" onclick="pickOpt(${i})" id="sopt${i}">
      <span class="opt-ltr">${ltrs[i]}</span>
      <span>${escHtml(p)}</span>
    </button>`).join('');
}

function pickOpt(i) {
  if (SOAL.answered) return;
  selectedOpt = i;
  document.querySelectorAll('.soal-opt').forEach((b, j) => b.classList.toggle('sel', j === i));
  checkSoal();
}

function checkSoal() {
  const soal = SOAL[SOAL.diff][SOAL.cur];
  const ok   = selectedOpt === soal.jawaban;
  SOAL.answered = true;

  // Disable & mark options
  document.querySelectorAll('.soal-opt').forEach((b, i) => {
    b.disabled = true;
    if (i === soal.jawaban)             b.classList.add('cor');
    else if (i === selectedOpt && !ok)  b.classList.add('wrg');
  });

  const xpMap = { mudah: 10, sedang: 20, sulit: 35 };
  if (ok) {
    SOAL.b++;
    const x = xpMap[SOAL.diff];
    SOAL.xpSesi += x;
    addXP(x);
    showSticker(true, x);
  } else {
    SOAL.s++;
    showSticker(false, 0);
  }

  // Update score bar
  document.getElementById('s-b').textContent = SOAL.b;
  document.getElementById('s-s').textContent = SOAL.s;
  document.getElementById('s-x').textContent = SOAL.xpSesi;

  // Feedback
  const fb = document.getElementById('soal-fb');
  fb.style.display = 'block';
  fb.className     = 'soal-fb ' + (ok ? 'cor' : 'wrg');
  document.getElementById('fb-t').textContent = ok ? '✅ Jawaban Benar!' : '❌ Jawaban Salah!';
  document.getElementById('fb-p').textContent =
    soal.penjelasan || (ok ? 'Jawaban kamu tepat!' : 'Jawaban benar: ' + soal.pilihan[soal.jawaban]);

  document.getElementById('soal-nxt').style.display = 'inline-flex';
}

function nxtSoal() {
  SOAL.cur++;
  selectedOpt   = -1;
  SOAL.answered = false;
  renderSoal();
}

function soalResult() {
  STATE.sessions++;
  saveState();
  updateUI();

  const total = SOAL.b + SOAL.s;
  const pct   = total > 0 ? Math.round((SOAL.b / total) * 100) : 0;
  const nextMap = { mudah: 'sedang', sedang: 'sulit' };
  const next    = nextMap[SOAL.diff];
  const emoji   = pct >= 70 ? '🏆' : '💪';
  const dLabel  = SOAL.diff.charAt(0).toUpperCase() + SOAL.diff.slice(1);

  document.getElementById('soal-card').innerHTML = `
    <div style="text-align:center;padding:32px 16px;">
      <div style="font-size:60px;margin-bottom:14px;">${emoji}</div>
      <div style="font-family:var(--font-d);font-size:24px;font-weight:800;color:var(--text);margin-bottom:6px;">
        Level ${dLabel} Selesai!
      </div>
      <div style="color:var(--text2);font-size:13.5px;margin-bottom:24px;">
        Benar: ${SOAL.b} · Salah: ${SOAL.s} · +${SOAL.xpSesi} XP
      </div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
        ${next
          ? `<button class="btn btn-primary" onclick="switchDiff('${next}')">Naik Level → ${next.charAt(0).toUpperCase() + next.slice(1)}</button>`
          : '<span class="tag tag-green" style="font-size:14px;">🏅 Semua Level Selesai!</span>'}
        <button class="btn btn-outline" onclick="resetSoal()">Materi Baru</button>
      </div>
    </div>`;
}

function resetSoal() {
  document.getElementById('soal-setup').style.display = 'block';
  document.getElementById('soal-quiz').style.display  = 'none';
  document.getElementById('soal-mat').value = '';
}

/* ============================================================
   ===  RANGKUMAN OTOMATIS  ===
   ============================================================ */
async function genRangkuman() {
  const mat = document.getElementById('rng-in').value.trim();
  if (mat.length < 50) { alert('Materi terlalu pendek! Minimal 50 karakter.'); return; }

  const sys = `Kamu adalah asisten yang membuat rangkuman materi pelajaran untuk pelajar Indonesia.

FORMAT WAJIB — hanya output JSON, tidak ada teks lain:
{
  "ringkasan": "3-4 kalimat ringkasan padat dan jelas.",
  "poin": ["Poin penting 1", "Poin penting 2", "Poin penting 3", "Poin penting 4", "Poin penting 5"],
  "istilah": ["Istilah1", "Istilah2", "Istilah3", "Istilah4", "Istilah5"]
}

Maksimal 6 poin dan 6 istilah kunci. Gunakan bahasa Indonesia yang jelas.
PENTING: Hanya output JSON valid.`;

  try {
    const raw   = await callClaude([{ role: 'user', content: mat }], sys, 1200);
    const clean = raw.replace(/```json|```/g, '').trim();
    const data  = JSON.parse(clean);

    document.getElementById('rng-sum').textContent = data.ringkasan || '—';
    document.getElementById('rng-pts').innerHTML   = (data.poin || []).map((p, i) => `
      <div class="key-pt">
        <span class="kn">${i + 1}</span>
        <span class="kt">${escHtml(p)}</span>
      </div>`).join('');
    document.getElementById('rng-terms').innerHTML = (data.istilah || []).map(t =>
      `<span class="tag tag-blue">${escHtml(t)}</span>`).join('');

    document.getElementById('rng-out').style.display = 'block';
    addXP(20);
  } catch (e) {
    alert('Gagal membuat rangkuman: ' + e.message);
  }
}

function rngClear() {
  document.getElementById('rng-in').value          = '';
  document.getElementById('rng-out').style.display = 'none';
}

function rngCopy() {
  const sum  = document.getElementById('rng-sum').textContent;
  const pts  = Array.from(document.querySelectorAll('.kt')).map(e => e.textContent).join('\n• ');
  const terms = Array.from(document.querySelectorAll('#rng-terms .tag')).map(e => e.textContent).join(', ');
  const text = `RANGKUMAN:\n${sum}\n\nPOIN PENTING:\n• ${pts}\n\nISTILAH KUNCI:\n${terms}`;
  navigator.clipboard.writeText(text)
    .then(() => showToast('📋 Rangkuman disalin!'))
    .catch(() => showToast('Gagal menyalin'));
}

/* ============================================================
   ===  POMODORO TIMER  ===
   ============================================================ */
const POMO = {
  run:    false,
  isBreak: false,
  left:   25 * 60,
  work:   25,
  short:  5,
  long:   15,
  n:      4,
  cur:    1,
  iv:     null,
  totS:   0,
  totM:   0,
};

const CIRCUM = 2 * Math.PI * 100; // ~628.3

function pomoUpd() {
  if (POMO.run) return;
  POMO.work  = parseInt(document.getElementById('p-work').value) || 25;
  POMO.short = parseInt(document.getElementById('p-brk').value)  || 5;
  POMO.long  = parseInt(document.getElementById('p-lng').value)  || 15;
  POMO.n     = parseInt(document.getElementById('p-n').value)    || 4;
  POMO.left  = POMO.work * 60;
  pomoRender();
}

function pomoPP() {
  if (POMO.run) {
    clearInterval(POMO.iv);
    POMO.run = false;
    document.getElementById('pomo-pp').textContent = '▶ Lanjut';
  } else {
    POMO.run = true;
    document.getElementById('pomo-pp').textContent = '⏸ Pause';
    POMO.iv = setInterval(() => {
      POMO.left--;
      if (POMO.left <= 0) pomoComplete();
      else pomoRender();
    }, 1000);
  }
}

function pomoRst() {
  clearInterval(POMO.iv);
  POMO.run     = false;
  POMO.isBreak = false;
  POMO.cur     = 1;
  POMO.left    = POMO.work * 60;
  pomoRender();
  document.getElementById('pomo-pp').textContent = '▶ Mulai';
}

function pomoSkip() {
  clearInterval(POMO.iv);
  POMO.run = false;
  pomoComplete();
}

function pomoComplete() {
  clearInterval(POMO.iv);
  POMO.run = false;

  if (!POMO.isBreak) {
    // Sesi fokus selesai
    POMO.totS++;
    POMO.totM += POMO.work;
    addXP(25);
    STATE.pomo.sessions++;
    STATE.pomo.minutes += POMO.work;
    STATE.sessions++;
    saveState();
    updateUI();

    document.getElementById('p-tot-s').textContent = POMO.totS;
    document.getElementById('p-tot-m').textContent = POMO.totM;
    document.getElementById('p-tot-x').textContent = POMO.totS * 25;

    const isLong = POMO.cur % POMO.n === 0;
    POMO.isBreak = true;
    POMO.left    = (isLong ? POMO.long : POMO.short) * 60;
    showToast(isLong ? '🛋️ Istirahat panjang! Kamu layak istirahat.' : '☕ Istirahat bentar dulu!');

    // Notifikasi browser
    if (Notification.permission === 'granted') {
      new Notification('KebutSemalam', { body: isLong ? 'Sesi selesai! Istirahat panjang 15 menit.' : 'Sesi selesai! Istirahat 5 menit.' });
    }
  } else {
    POMO.isBreak = false;
    POMO.cur++;
    if (POMO.cur > POMO.n) POMO.cur = 1;
    POMO.left = POMO.work * 60;
    showToast('🔥 Yuk balik fokus!');
  }

  pomoRender();
  document.getElementById('pomo-pp').textContent = '▶ Mulai';
}

function pomoRender() {
  const m = String(Math.floor(POMO.left / 60)).padStart(2, '0');
  const s = String(POMO.left % 60).padStart(2, '0');
  document.getElementById('pomo-time').textContent = m + ':' + s;

  let lbl = 'FOKUS';
  if (POMO.isBreak) {
    lbl = (POMO.cur % POMO.n === 0) ? 'ISTIRAHAT PANJANG' : 'ISTIRAHAT';
  }
  document.getElementById('pomo-lbl').textContent = lbl;

  // Ring
  const total  = (POMO.isBreak ? (POMO.cur % POMO.n === 0 ? POMO.long : POMO.short) : POMO.work) * 60;
  const offset = CIRCUM * (POMO.left / total);
  const ring   = document.getElementById('pomo-ring');
  ring.style.strokeDashoffset = CIRCUM - offset;
  ring.classList.toggle('brk', POMO.isBreak);

  // Session dots
  document.getElementById('pomo-sess-dots').innerHTML = Array.from({ length: POMO.n }, (_, i) =>
    `<div class="pomo-sdot ${i < POMO.cur - 1 || (i === POMO.cur - 1 && !POMO.isBreak) ? 'done' : ''}"></div>`
  ).join('');

  document.getElementById('pomo-sess-lbl').textContent = 'Sesi ke-' + POMO.cur + ' dari ' + POMO.n;
}

/* ============================================================
   ===  JURNAL BELAJAR  ===
   ============================================================ */
let jMood = '😊';

function setMood(btn, m) {
  document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('act'));
  btn.classList.add('act');
  jMood = m;
}

function saveJurnal() {
  const date  = document.getElementById('j-date').value  || todayStr();
  const topik = document.getElementById('j-topik').value.trim();
  const notes = document.getElementById('j-notes').value.trim();
  const dur   = parseInt(document.getElementById('j-dur').value) || 0;

  if (!topik) { alert('Isi topik dulu!'); return; }

  STATE.journals.unshift({
    id:     Date.now(),
    date,
    mood:   jMood,
    topik,
    notes,
    durasi: dur,
  });

  if (STATE.journals.length > 60) STATE.journals.pop();
  saveState();
  renderJurnal();
  addXP(5);

  document.getElementById('j-topik').value = '';
  document.getElementById('j-notes').value = '';
  document.getElementById('j-dur').value   = '';
  showToast('📓 Jurnal tersimpan!');
}

function renderJurnal() {
  const el = document.getElementById('j-list');
  if (!STATE.journals.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">📭</div><p>Belum ada jurnal. Mulai tulis!</p></div>';
    return;
  }
  el.innerHTML = STATE.journals.map(j => `
    <div class="j-entry">
      <div class="j-entry-head">
        <span class="j-date">${j.date}${j.durasi ? ' · ' + j.durasi + ' menit' : ''}</span>
        <span class="j-mood">${j.mood}</span>
      </div>
      <div class="j-topik">${escHtml(j.topik)}</div>
      <div class="j-preview">${escHtml(j.notes || '—')}</div>
    </div>`).join('');
}

/* ============================================================
   UTILITIES
   ============================================================ */
function escHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  updateUI();

  // Set tanggal hari ini di jurnal
  document.getElementById('j-date').value = todayStr();

  // Init pomodoro render
  POMO.left = POMO.work * 60;
  pomoRender();

  // Render jurnal
  renderJurnal();

  // Minta izin notifikasi untuk pomodoro
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Auto-resize textarea chat
  const chatIn = document.getElementById('chat-in');
  if (chatIn) {
    chatIn.addEventListener('input', function () {
      this.style.height = '48px';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
  }

  console.log('%cKebutSemalam v1.0 loaded! 🚀', 'color:#2F80ED;font-weight:bold;font-size:16px;');
});
