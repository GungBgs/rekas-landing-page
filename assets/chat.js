/* =========================================================================
   Rekas — simulasi percakapan
   Animasi ringan (tanpa library): draft diketik di kolom pesan, lalu bubble
   muncul, indikator "mengetik…" menyusul, log bergulir sendiri, lalu loop.
   Bila pengguna meminta gerak dikurangi, keempat skenario ditampilkan
   sekaligus sebagai transkrip statis.
   ========================================================================= */

(function () {
  'use strict';

  // Nomor WhatsApp ditulis sekali di HTML (#wa-cta); CTA lain meminjam href-nya,
  // sehingga mengganti nomor cukup di satu tempat. Tanpa JS, CTA jatuh ke #mulai.
  var waSource = document.getElementById('wa-cta');
  if (waSource) {
    var waLinks = document.querySelectorAll('[data-wa]');
    for (var w = 0; w < waLinks.length; w++) {
      waLinks[w].setAttribute('href', waSource.getAttribute('href'));
    }
  }

  var log = document.getElementById('chat-log');
  if (!log) return;

  var draftEl = document.getElementById('composer-draft');
  var placeholderEl = document.getElementById('composer-placeholder');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ── Naskah ─────────────────────────────────────────────────────────────
     Empat kemampuan nyata Rekas. Nominal memakai format "Rp. 1.500.000"
     seperti keluaran bot yang sebenarnya (ADR-013). */
  var scenarios = [
    {
      label: 'Catat pengeluaran',
      turns: [
        { from: 'user', text: 'tadi sarapan 25rb, bensin 60rb' },
        {
          from: 'bot',
          text: 'Sudah aku catat:\n• Makan & Minum — Rp. 25.000\n• Transportasi — Rp. 60.000\n\nSaldo Cash sekarang Rp. 415.000.'
        }
      ]
    },
    {
      label: 'Tanya saldo',
      turns: [
        { from: 'user', text: 'saldo' },
        {
          from: 'bot',
          text: 'Saldo kamu:\n• Cash — Rp. 415.000\n• BCA — Rp. 2.480.000\n\nTotal aset Rp. 2.895.000.'
        }
      ]
    },
    {
      label: 'Foto struk',
      turns: [
        { from: 'user', media: 'receipt', text: 'struk-indomaret.jpg' },
        {
          from: 'bot',
          text: 'Aku baca struk ini:\n• Indomaret — Rp. 47.300 (Makan & Minum)\n\nCatat sekarang?'
        },
        { from: 'user', text: 'iya' },
        { from: 'bot', text: 'Sudah masuk ke Cash. Sisa saldo Rp. 367.700.' }
      ]
    },
    {
      label: 'Pengingat budget',
      turns: [
        {
          from: 'bot',
          text: 'Pengingat: budget Makan & Minum tinggal Rp. 318.000 dari Rp. 1.500.000.\n\nMasih ada 9 hari lagi bulan ini.'
        },
        { from: 'user', text: 'oke, sisa hari ini aku masak di rumah' }
      ]
    }
  ];

  var clock = 19 * 60 + 41;

  function nextTime() {
    clock += 1;
    var h = String(Math.floor(clock / 60) % 24).padStart(2, '0');
    var m = String(clock % 60).padStart(2, '0');
    return h + '.' + m;
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  /* ── Pembuat elemen ─────────────────────────────────────────────────── */
  var CHECK_SVG =
    '<svg class="bubble__check" viewBox="0 0 16 11" width="14" height="10" aria-hidden="true" focusable="false">' +
    '<path d="M1 5.5 5 9.5 11 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M5 5.5 9 9.5 15 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>' +
    '</svg>';

  var RECEIPT_SVG =
    '<svg class="bubble__receipt" viewBox="0 0 120 148" role="img" aria-label="Foto struk belanja Indomaret">' +
    '<rect width="120" height="148" fill="#f7f3e6"/>' +
    '<text x="60" y="19" text-anchor="middle" font-family="monospace" font-size="8.5" letter-spacing="1.2" fill="#33362f">INDOMARET</text>' +
    '<text x="60" y="30" text-anchor="middle" font-family="monospace" font-size="5.5" letter-spacing=".6" fill="#8a8b80">JL. MERDEKA 12 · WITA</text>' +
    '<path d="M10 36h100" stroke="#c9c6b8" stroke-width=".7" stroke-dasharray="2 2"/>' +
    '<g font-family="monospace" font-size="5.6" fill="#3b3d36">' +
    '<text x="10" y="48">ROTI TAWAR</text><text x="110" y="48" text-anchor="end">14.500</text>' +
    '<text x="10" y="60">SUSU UHT 1L</text><text x="110" y="60" text-anchor="end">18.900</text>' +
    '<text x="10" y="72">TELUR 6 BUTIR</text><text x="110" y="72" text-anchor="end">13.900</text>' +
    '</g>' +
    '<path d="M10 80h100" stroke="#c9c6b8" stroke-width=".7" stroke-dasharray="2 2"/>' +
    '<g font-family="monospace" font-size="6.4" fill="#2b2d27">' +
    '<text x="10" y="92">TOTAL</text><text x="110" y="92" text-anchor="end">47.300</text>' +
    '</g>' +
    '<g font-family="monospace" font-size="5.4" fill="#8a8b80">' +
    '<text x="10" y="104">TUNAI</text><text x="110" y="104" text-anchor="end">50.000</text>' +
    '<text x="10" y="114">KEMBALI</text><text x="110" y="114" text-anchor="end">2.700</text>' +
    '</g>' +
    '<text x="60" y="134" text-anchor="middle" font-family="monospace" font-size="5.2" letter-spacing=".8" fill="#a3a49a">TERIMA KASIH</text>' +
    '</svg>';

  function addDivider(label) {
    var wrap = document.createElement('div');
    wrap.className = 'divider';
    wrap.textContent = label;
    log.appendChild(wrap);
    scrollToEnd();
    return wrap;
  }

  function addBubble(turn) {
    var row = document.createElement('div');
    row.className = 'msg msg--' + (turn.from === 'user' ? 'user' : 'bot');

    var bubble = document.createElement('div');
    bubble.className = 'bubble bubble--' + (turn.from === 'user' ? 'user' : 'bot');

    if (turn.media === 'receipt') {
      var holder = document.createElement('span');
      holder.innerHTML = RECEIPT_SVG;
      if (holder.firstChild) bubble.appendChild(holder.firstChild);
    }

    var text = document.createTextNode(turn.text);
    bubble.appendChild(text);

    var meta = document.createElement('span');
    meta.className = 'bubble__meta';
    meta.appendChild(document.createTextNode(nextTime()));
    if (turn.from === 'user') {
      var check = document.createElement('span');
      check.innerHTML = CHECK_SVG;
      if (check.firstChild) meta.appendChild(check.firstChild);
    }
    bubble.appendChild(meta);

    row.appendChild(bubble);
    log.appendChild(row);
    scrollToEnd();
    return row;
  }

  function addTyping() {
    var row = document.createElement('div');
    row.className = 'msg msg--bot';
    row.setAttribute('aria-hidden', 'true');

    var bubble = document.createElement('div');
    bubble.className = 'bubble bubble--bot bubble--typing';
    for (var i = 0; i < 3; i++) bubble.appendChild(document.createElement('span'));

    row.appendChild(bubble);
    log.appendChild(row);
    scrollToEnd();
    return row;
  }

  function scrollToEnd() {
    log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' });
  }

  /* ── Ketikan di kolom pesan ─────────────────────────────────────────── */
  function setDraft(text) {
    if (!draftEl) return;
    draftEl.textContent = text;
    if (placeholderEl) placeholderEl.style.display = text ? 'none' : '';
  }

  async function typeDraft(text, myRun) {
    if (!draftEl) return;
    var perChar = Math.max(16, Math.min(46, 900 / Math.max(text.length, 1)));
    for (var i = 1; i <= text.length; i++) {
      if (myRun !== run) return;
      setDraft(text.slice(0, i));
      await sleep(perChar);
    }
    await sleep(260);
  }

  /* ── Animasi utama ──────────────────────────────────────────────────── */
  var run = 0;

  async function playTurns(myRun) {
    for (var s = 0; s < scenarios.length; s++) {
      if (myRun !== run) return;
      var scenario = scenarios[s];
      addDivider(scenario.label);
      await sleep(520);
      if (myRun !== run) return;

      for (var t = 0; t < scenario.turns.length; t++) {
        if (myRun !== run) return;
        var turn = scenario.turns[t];

        if (turn.from === 'user') {
          await typeDraft(turn.text, myRun);
          if (myRun !== run) return;
          setDraft('');
          addBubble(turn);
          await sleep(420);
        } else {
          var typing = addTyping();
          var wait = Math.min(2000, 780 + turn.text.length * 20);
          await sleep(wait);
          if (myRun !== run) return;
          typing.remove();
          addBubble(turn);
          await sleep(520);
        }
      }

      await sleep(1000);
    }

    if (myRun !== run) return;
    await sleep(2600);
    if (myRun !== run) return;

    // Kosongkan lalu mulai lagi dari awal.
    log.style.transition = 'opacity .45s ease';
    log.style.opacity = '0';
    await sleep(460);
    if (myRun !== run) return;
    log.innerHTML = '';
    clock = 19 * 60 + 41;
    log.style.opacity = '1';
  }

  async function playLoop() {
    var myRun = ++run;
    while (myRun === run) {
      await playTurns(myRun);
      await sleep(300);
    }
  }

  /* ── Mode gerak dikurangi: transkrip utuh ───────────────────────────── */
  function renderStatic() {
    run++; // hentikan animasi yang sedang berjalan
    log.innerHTML = '';
    setDraft('');
    log.style.opacity = '1';
    clock = 19 * 60 + 41;

    scenarios.forEach(function (scenario) {
      addDivider(scenario.label);
      scenario.turns.forEach(function (turn) {
        addBubble(turn);
      });
    });

    // Transkrip statis dibaca dari awal, bukan dari ekor percakapan.
    log.scrollTop = 0;
  }

  function applyPreference() {
    if (reducedMotion.matches) {
      renderStatic();
    } else {
      log.innerHTML = '';
      log.style.opacity = '1';
      playLoop();
    }
  }

  if (typeof reducedMotion.addEventListener === 'function') {
    reducedMotion.addEventListener('change', applyPreference);
  } else if (typeof reducedMotion.addListener === 'function') {
    reducedMotion.addListener(applyPreference);
  }

  applyPreference();
})();
