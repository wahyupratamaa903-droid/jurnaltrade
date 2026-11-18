let lastNewsSummaryForReason = '';

function openVaultShortcut() {
  if (typeof closeModal === 'function') closeModal();
  if (typeof closeAiAnalystModal === 'function') closeAiAnalystModal();
  if (typeof openAccountModal === 'function') {
    openAccountModal();
    setTimeout(() => {
      const el = document.getElementById('vault-groq');
      if (el) el.focus();
    }, 250);
  }
}

// ==========================================
// 1. AI AUTO-FILL SELURUH KOLOM TRANSAKSI
// ==========================================
async function runAiAutoFill() {
  const inputEl = document.getElementById('ai-autofill-input');
  const statusEl = document.getElementById('ai-autofill-status');
  const btn = document.getElementById('ai-autofill-btn');
  const promptText = (inputEl?.value || '').trim();

  if (!promptText) {
    statusEl.innerHTML = '<span class="text-rose-400">Ketik perintah transaksi dulu (contoh: buy xauusd 0.05 sesi london tp 450rb rr 1:2 pips 30 karena sweep asian low).</span>';
    statusEl.classList.remove('hidden');
    inputEl?.focus();
    return;
  }

  if (!hasAnyLlmKey()) {
    statusEl.innerHTML = `
      <div class="flex items-center justify-between gap-2 text-amber-300">
        <span>API Key AI belum diatur di Brankas.</span>
        <button type="button" onclick="openVaultShortcut()" class="underline font-bold text-emerald-400 shrink-0">Isi API Key</button>
      </div>`;
    statusEl.classList.remove('hidden');
    return;
  }

  const origBtnHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
  statusEl.innerHTML = '<span class="text-slate-400">AI sedang membaca perintah & mengisi kolom form...</span>';
  statusEl.classList.remove('hidden');

  const now = new Date();
  const todayFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const defaultSess = typeof detectSession === 'function' ? detectSession() : 'Asia';

  const systemPrompt = `Kamu adalah asisten ekstraksi data jurnal trading forex/gold/kripto.
Tugasmu mengubah perintah bebas user menjadi objek JSON murni untuk mengisi form transaksi.
Tanggal hari ini: ${todayFormatted}. Sesi saat ini: ${defaultSess}.

Aturan konversi wajib:
- "date": format "DD/MM/YYYY" (gunakan "${todayFormatted}" jika tidak disebut).
- "session": pilih persis salah satu dari ["Asia", "London", "New York"] (gunakan "${defaultSess}" jika tidak disebut).
- "pair": simbol instrumen huruf kapital tanpa spasi (contoh: "XAUUSD", "EURUSD", "BTCUSD", "US30", "GBPJPY").
- "side": pilih persis "BUY" atau "SELL" ("long" -> "BUY", "short" -> "SELL").
- "lot": string 2 desimal (contoh: "0.01", "0.05", "0.10", "1.00"). Default "0.01" jika tidak disebut.
- "rr": format rasio seperti "1 : 2" atau "1 : 3" (kosongkan "" jika tidak disebut).
- "risk": angka integer Rupiah (konversi "100rb"/"100k" -> 100000, "1.5jt" -> 1500000, 0 jika tidak disebut).
- "status": pilih persis salah satu dari ["TP", "SL", "SL+", "BE"] ("profit"/"win" -> "TP", "loss"/"cutloss" -> "SL", "impas" -> "BE").
- "nominal": angka integer Rupiah untuk profit atau loss (konversi "450rb" -> 450000, "1,2jt" -> 1200000).
- "pips": angka atau string angka (contoh: "25.5" atau "" jika tidak disebut).
- "reason": rangkuman rapi alasan teknikal/setup analisa dari teks user.
- "info": rangkuman kondisi psikologi/evaluasi dari teks user (jika tidak disebut, tulis "-").
- "doc": URL screenshot jika ada di teks, selain itu "".

Keluarkan HANYA JSON valid tanpa markdown atau teks tambahan.`;

  try {
    const res = await callLlmWithFailover([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: promptText }
    ], true);

    const cleanedJson = res.content.replace(/```json|```/gi, '').trim();
    const jsonMatch = cleanedJson.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleanedJson);

    applyParsedDataToForm(parsed);

    statusEl.innerHTML = `<span class="text-emerald-400"><i class="fas fa-circle-check mr-1"></i>Kolom form otomatis diisi oleh <strong>${res.provider}</strong>. Silakan cek lalu klik Simpan.</span>`;
    if (typeof showToast === 'function') showToast('Form transaksi terisi otomatis!');
  } catch (err) {
    statusEl.innerHTML = `<span class="text-rose-400">Gagal memproses AI: ${err.message}</span>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = origBtnHtml;
  }
}

function applyParsedDataToForm(d) {
  if (d.date) document.getElementById('m-date').value = d.date;

  if (d.session && ['Asia', 'London', 'New York'].includes(d.session)) {
    document.getElementById('m-session').value = d.session;
  }

  if (d.pair) {
    document.getElementById('m-pair').value = String(d.pair).toUpperCase().trim();
    if (typeof highlightActivePairPreset === 'function') highlightActivePairPreset();
  }

  if (d.side && ['BUY', 'SELL'].includes(String(d.side).toUpperCase())) {
    document.getElementById('m-side').value = String(d.side).toUpperCase();
  }

  if (d.lot) {
    const lotVal = parseFloat(d.lot).toFixed(2);
    const lotSelect = document.getElementById('m-lot');
    const exists = Array.from(lotSelect.options).some(opt => opt.value === lotVal);
    if (!exists) {
      const opt = document.createElement('option');
      opt.value = lotVal;
      opt.textContent = lotVal;
      lotSelect.appendChild(opt);
    }
    lotSelect.value = lotVal;
  }

  if (d.rr !== undefined && d.rr !== null) {
    document.getElementById('m-rr').value = d.rr;
  }

  if (typeof d.risk === 'number' && d.risk > 0) {
    document.getElementById('m-risk').value = Math.round(d.risk);
  }

  if (d.status && ['TP', 'SL', 'SL+', 'BE'].includes(d.status)) {
    document.getElementById('m-status').value = d.status;
  }

  if (typeof d.nominal === 'number' && d.nominal >= 0) {
    document.getElementById('m-nominal').value = Math.round(d.nominal);
  }

  if (d.pips !== undefined && d.pips !== null && d.pips !== '') {
    document.getElementById('m-pips').value = d.pips;
  }

  if (d.reason) {
    document.getElementById('m-reason').value = d.reason;
  }

  if (d.info) {
    document.getElementById('m-info').value = d.info;
  }

  if (d.doc) {
    document.getElementById('m-doc').value = d.doc;
  }
}

// ==========================================
// 2. RADAR BERITA REAL-TIME & SITUS TERPERCAYA
// ==========================================
async function fetchPairNewsRadar() {
  const pairInput = document.getElementById('m-pair');
  const pair = (pairInput?.value || 'XAUUSD').trim().toUpperCase() || 'XAUUSD';
  if (pairInput && !pairInput.value) pairInput.value = pair;

  const box = document.getElementById('news-radar-result');
  const btn = document.getElementById('news-radar-btn');

  if (!hasAnySearchKey() && !hasAnyLlmKey()) {
    box.innerHTML = `
      <div class="flex items-center justify-between gap-2 text-amber-300 text-[10px] font-mono">
        <span>Isi API Key Exa / Jina / LLM dulu di Brankas.</span>
        <button type="button" onclick="openVaultShortcut()" class="underline font-bold text-emerald-400 shrink-0">Buka Brankas</button>
      </div>`;
    box.classList.remove('hidden');
    return;
  }

  const origBtn = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mencari...';
  box.innerHTML = `<p class="text-[10px] text-slate-400 font-mono"><i class="fas fa-satellite-dish fa-beat mr-1 text-emerald-400"></i> Mengambil berita terbaru <strong>${pair}</strong> dari Investing.com, Forex Factory, Bloomberg, Reuters, TradingView & Myfxbook...</p>`;
  box.classList.remove('hidden');

  try {
    let articles = [];
    let searchWarning = '';

    try {
      articles = await searchTrustedMarketNews(pair);
    } catch (searchErr) {
      if (searchErr.message === 'NO_SEARCH_KEY') {
        searchWarning = 'API Exa/Jina belum diisi, menampilkan analisa AI & tautan langsung situs terpercaya.';
      } else {
        searchWarning = `Pencarian live terkendala (${searchErr.message}), menampilkan rujukan langsung.`;
      }
    }

    let summaryHtml = '';
    let sourcesHtml = '';

    if (articles.length > 0) {
      // Bangun daftar sumber situs terpercaya lengkap dengan domain & link
      sourcesHtml = `
        <div class="pt-2 border-t border-slate-800/80 space-y-1.5">
          <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
            <i class="fas fa-link mr-1 text-blue-400"></i> Sumber Berita Terverifikasi (${articles[0].engine}):
          </span>
          <div class="space-y-1 max-h-32 overflow-y-auto pr-1">
            ${articles.map(a => `
              <a href="${a.url}" target="_blank" rel="noopener noreferrer"
                class="block bg-slate-900/90 hover:bg-slate-800 border border-slate-800 rounded-lg px-2 py-1.5 transition">
                <div class="flex items-center justify-between gap-1.5">
                  <span class="text-[9px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.2 rounded">${a.domain}</span>
                  <span class="text-[9px] font-mono text-slate-500">${a.publishedDate}</span>
                </div>
                <p class="text-[10px] text-slate-200 font-medium line-clamp-1 mt-0.5">${a.title}</p>
              </a>
            `).join('')}
          </div>
        </div>
      `;

      if (hasAnyLlmKey()) {
        const digestInput = articles.map((a, idx) =>
          `[${idx + 1}] Sumber: ${a.domain} (${a.publishedDate}) | Judul: ${a.title} | Cuplikan: ${a.snippet}`
        ).join('\n');

        const aiRes = await callLlmWithFailover([
          {
            role: 'system',
            content: 'Kamu analis pasar finansial. Ringkas berita terbaru berikut dalam bahasa Indonesia yang padat, objektif, dan mudah dibaca trader. Wajib sebutkan nama situs sumbernya (misal Investing.com, Reuters, Forex Factory, dll) pada setiap poin.'
          },
          {
            role: 'user',
            content: `Instrumen: ${pair}\n\nData Berita Real-Time:\n${digestInput}\n\nBuat ringkasan singkat 3 poin:\n1. Sentimen & Bias Utama\n2. Katalis Berita Terbaru (sebutkan sumber situsnya)\n3. Peringatan Volatilitas / High-Impact News`
          }
        ], false);

        lastNewsSummaryForReason = `[Radar Berita ${pair}] ${aiRes.content.replace(/\*\*/g, '')}`;
        const formattedText = aiRes.content
          .replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-100">$1</strong>')
          .replace(/\n/g, '<br>');

        summaryHtml = `
          <div class="text-[11px] text-slate-300 leading-relaxed space-y-1">
            <div class="flex items-center justify-between text-[9px] font-mono text-emerald-400 pb-1">
              <span><i class="fas fa-bolt mr-1"></i>Ringkasan Real-Time (${aiRes.provider})</span>
              <button type="button" onclick="copyNewsToReason()" class="bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded font-bold transition">
                + Salin ke Reason
              </button>
            </div>
            <div>${formattedText}</div>
          </div>
        `;
      } else {
        lastNewsSummaryForReason = `[Sumber Berita ${pair}]: ` + articles.map(a => `${a.title} (${a.domain})`).join('; ');
        summaryHtml = `<p class="text-[10px] text-slate-300">Ditemukan ${articles.length} berita terbaru untuk <strong>${pair}</strong> dari situs terpercaya di bawah:</p>`;
      }
    } else {
      const qEnc = encodeURIComponent(pair);
      summaryHtml = `<p class="text-[10px] text-amber-300">${searchWarning || `Belum ada berita terbaru untuk ${pair}.`}</p>`;
      sourcesHtml = `
        <div class="pt-1.5 flex flex-wrap gap-1 font-mono text-[9px]">
          <a href="https://www.investing.com/search/?q=${qEnc}" target="_blank" class="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-amber-400 hover:bg-slate-800">Investing.com ↗</a>
          <a href="https://www.forexfactory.com/calendar" target="_blank" class="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-blue-400 hover:bg-slate-800">Forex Factory ↗</a>
          <a href="https://www.myfxbook.com/forex-economic-calendar" target="_blank" class="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-emerald-400 hover:bg-slate-800">Myfxbook ↗</a>
          <a href="https://www.tradingview.com/symbols/${qEnc}/news/" target="_blank" class="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-cyan-400 hover:bg-slate-800">TradingView ↗</a>
          <a href="https://www.reuters.com/site-search/?query=${qEnc}" target="_blank" class="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-orange-400 hover:bg-slate-800">Reuters ↗</a>
          <a href="https://www.bloomberg.com/search?query=${qEnc}" target="_blank" class="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-purple-400 hover:bg-slate-800">Bloomberg ↗</a>
        </div>
      `;
    }

    box.innerHTML = summaryHtml + sourcesHtml;
  } catch (err) {
    box.innerHTML = `<p class="text-[10px] text-rose-400">Kendala Radar Berita: ${err.message}</p>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = origBtn;
  }
}

function copyNewsToReason() {
  if (!lastNewsSummaryForReason) return;
  const reasonEl = document.getElementById('m-reason');
  if (reasonEl) {
    const existing = reasonEl.value.trim();
    reasonEl.value = existing ? `${existing}\n\n${lastNewsSummaryForReason}` : lastNewsSummaryForReason;
    if (typeof showToast === 'function') showToast('Ringkasan berita ditambahkan ke Reason!');
  }
}

// ==========================================
// 3. TANYA AI ANALYST (EVALUASI JURNAL BEBAS)
// ==========================================
function openAiAnalystModal() {
  const modal = document.getElementById('ai-analyst-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex', 'modal-animate-backdrop');
}

function closeAiAnalystModal() {
  const modal = document.getElementById('ai-analyst-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex', 'modal-animate-backdrop');
}

async function askAiJournalAnalyst(presetQuestion = null) {
  const inputEl = document.getElementById('ai-analyst-question');
  const outEl = document.getElementById('ai-analyst-output');
  const btn = document.getElementById('ai-analyst-submit');

  const question = presetQuestion || (inputEl?.value || '').trim();
  if (!question) return;
  if (inputEl && presetQuestion) inputEl.value = presetQuestion;

  if (!hasAnyLlmKey()) {
    outEl.innerHTML = `
      <div class="flex items-center justify-between gap-2 text-amber-300 text-xs">
        <span>Simpan minimal 1 API Key (Groq / Cerebras / OpenRouter) di Brankas dulu.</span>
        <button type="button" onclick="openVaultShortcut()" class="underline font-bold text-emerald-400 shrink-0">Buka Brankas</button>
      </div>`;
    outEl.classList.remove('hidden');
    return;
  }

  const origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menganalisa...';
  outEl.innerHTML = '<p class="text-xs text-slate-400 font-mono">AI sedang membaca riwayat transaksi jurnal Anda...</p>';
  outEl.classList.remove('hidden');

  const compactTrades = trades.slice(-50).map(t => ({
    tgl: t.date,
    sesi: t.session,
    pair: t.pair,
    posisi: t.side,
    lot: t.lot,
    hasil: t.status,
    pnl: (t.profit || 0) - (t.loss || 0),
    pips: t.pips,
    analisa: t.reason,
    psikologi: t.info
  }));

  try {
    const res = await callLlmWithFailover([
      {
        role: 'system',
        content: 'Kamu adalah asisten analis data trading pribadi yang santai, tajam, dan tidak kaku. Jawab pertanyaan trader berdasarkan data jurnal miliknya dalam bahasa Indonesia yang ringkas dan praktis.'
      },
      {
        role: 'user',
        content: `Modal Awal: Rp ${initialBalance.toLocaleString('id-ID')}\nTotal Transaksi: ${trades.length}\nData Transaksi Terbaru (JSON):\n${JSON.stringify(compactTrades)}\n\nPertanyaan User: ${question}`
      }
    ], false);

    const formatted = res.content
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-100">$1</strong>')
      .replace(/\n/g, '<br>');

    outEl.innerHTML = `
      <div class="text-[10px] font-mono text-emerald-400 mb-1.5 flex items-center justify-between">
        <span><i class="fas fa-robot mr-1"></i>Dijawab oleh ${res.provider}</span>
      </div>
      <div class="text-xs text-slate-200 leading-relaxed">${formatted}</div>
    `;
  } catch (err) {
    outEl.innerHTML = `<p class="text-xs text-rose-400">Gagal memuat analisa AI: ${err.message}</p>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = origHtml;
  }
}
