let activePeriodPreset = 'ALL';

const POSITIVE_PSYCH_WORDS = [
  'tenang', 'disiplin', 'sabar', 'fokus', 'sesuai plan',
  'konfirmasi', 'rileks', 'terukur', 'percaya diri', 'objektif'
];

const NEGATIVE_PSYCH_WORDS = [
  'fomo', 'panik', 'terburu', 'buru', 'serakah', 'greedy',
  'revenge', 'balas dendam', 'emosi', 'marah', 'ragu',
  'takut', 'overtrade', 'geser sl', 'impulsif', 'tidak sabar'
];

// Mengubah string tanggal "DD/MM/YYYY" atau "YYYY-MM-DD" menjadi objek Date
function parseTradeDate(dateStr) {
  if (!dateStr) return null;
  const clean = String(dateStr).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
    const [dd, mm, yyyy] = clean.split('/').map(Number);
    return new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [yyyy, mm, dd] = clean.split('-').map(Number);
    return new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);
  }
  const d = new Date(clean);
  return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function setPeriodPreset(preset) {
  activePeriodPreset = preset;

  document.querySelectorAll('.period-btn').forEach(btn => {
    const isTarget = btn.getAttribute('data-period') === preset;
    btn.className = isTarget
      ? 'period-btn px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold transition'
      : 'period-btn px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 transition';
  });

  const customBox = document.getElementById('custom-date-inputs');
  if (customBox) {
    if (preset === 'CUSTOM') {
      customBox.classList.remove('hidden');
      customBox.classList.add('flex');
    } else {
      customBox.classList.add('hidden');
      customBox.classList.remove('flex');
    }
  }

  if (typeof updateAll === 'function') updateAll();
}

function applyCustomDateRange() {
  activePeriodPreset = 'CUSTOM';
  if (typeof updateAll === 'function') updateAll();
}

// Menyaring daftar transaksi sesuai periode waktu yang dipilih
function getPeriodScopedTrades() {
  const baseModal = parseFloat(document.getElementById('initial-balance')?.value) || 0;
  const badgeEl = document.getElementById('period-summary-badge');

  if (activePeriodPreset === 'ALL') {
    if (badgeEl) badgeEl.textContent = `Menampilkan semua (${trades.length} posisi)`;
    return { scopedTrades: trades, startEquity: baseModal, isFiltered: false };
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  let startDate = null;
  let endDate = todayEnd;

  if (activePeriodPreset === 'TODAY') {
    startDate = todayStart;
  } else if (activePeriodPreset === 'WEEK') {
    startDate = new Date(todayStart);
    startDate.setDate(todayStart.getDate() - 6);
  } else if (activePeriodPreset === 'MONTH') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (activePeriodPreset === 'CUSTOM') {
    const startVal = document.getElementById('period-start')?.value;
    const endVal = document.getElementById('period-end')?.value;
    if (startVal) startDate = parseTradeDate(startVal);
    if (endVal) {
      const parsedEnd = parseTradeDate(endVal);
      if (parsedEnd) {
        endDate = new Date(parsedEnd.getFullYear(), parsedEnd.getMonth(), parsedEnd.getDate(), 23, 59, 59, 999);
      }
    }
  }

  let priorPnL = 0;
  const scopedTrades = [];

  trades.forEach(t => {
    const tDate = parseTradeDate(t.date);
    const net = (t.profit || 0) - (t.loss || 0);

    if (!tDate) {
      scopedTrades.push(t);
      return;
    }

    if (startDate && tDate < startDate) {
      priorPnL += net;
    } else if ((!startDate || tDate >= startDate) && (!endDate || tDate <= endDate)) {
      scopedTrades.push(t);
    }
  });

  if (badgeEl) {
    badgeEl.textContent = `${scopedTrades.length} dari ${trades.length} posisi dalam periode`;
  }

  return {
    scopedTrades,
    startEquity: baseModal + priorPnL,
    isFiltered: true
  };
}

// Menganalisis performa berdasarkan catatan kolom INFORMATION (PSIKOLOGI)
function renderPsychologyStats(scopedTrades) {
  const container = document.getElementById('psych-performance-list');
  if (!container) return;

  const stats = {
    calm: { wins: 0, total: 0, pnl: 0 },
    emotional: { wins: 0, total: 0, pnl: 0 },
    neutral: 0
  };

  scopedTrades.forEach(t => {
    const note = (t.info || '').toLowerCase();
    const isWin = t.status === 'TP' || t.status === 'SL+';
    const net = (t.profit || 0) - (t.loss || 0);

    const hasNeg = NEGATIVE_PSYCH_WORDS.some(w => note.includes(w));
    const hasPos = POSITIVE_PSYCH_WORDS.some(w => note.includes(w));

    if (hasNeg) {
      stats.emotional.total++;
      stats.emotional.pnl += net;
      if (isWin) stats.emotional.wins++;
    } else if (hasPos) {
      stats.calm.total++;
      stats.calm.pnl += net;
      if (isWin) stats.calm.wins++;
    } else {
      stats.neutral++;
    }
  });

  const calmWR = stats.calm.total > 0 ? ((stats.calm.wins / stats.calm.total) * 100).toFixed(0) : 0;
  const emoWR = stats.emotional.total > 0 ? ((stats.emotional.wins / stats.emotional.total) * 100).toFixed(0) : 0;

  container.innerHTML = `
    <div class="bg-slate-950/70 border border-emerald-900/50 p-2 rounded-xl">
      <span class="text-[9px] text-emerald-400 uppercase font-bold block">Tenang / Disiplin</span>
      <p class="text-xs font-black text-slate-100 mt-0.5">${calmWR}% WR <span class="text-[9px] font-normal text-slate-500">(${stats.calm.total})</span></p>
      <p class="text-[9px] font-mono ${stats.calm.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'} mt-0.5">
        ${stats.calm.pnl >= 0 ? '+' : ''}Rp ${stats.calm.pnl.toLocaleString('id-ID')}
      </p>
    </div>
    <div class="bg-slate-950/70 border border-rose-900/50 p-2 rounded-xl">
      <span class="text-[9px] text-rose-400 uppercase font-bold block">Emosional / FOMO</span>
      <p class="text-xs font-black text-slate-100 mt-0.5">${emoWR}% WR <span class="text-[9px] font-normal text-slate-500">(${stats.emotional.total})</span></p>
      <p class="text-[9px] font-mono ${stats.emotional.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'} mt-0.5">
        ${stats.emotional.pnl >= 0 ? '+' : ''}Rp ${stats.emotional.pnl.toLocaleString('id-ID')}
      </p>
    </div>
  `;
}
