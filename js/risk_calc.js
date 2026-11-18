const RATE_STORE_KEY = 'jurnal_usd_idr_rate';
const RATE_TIME_KEY = 'jurnal_usd_idr_updated';
let liveAccountEquity = 2000000;
let userManualRate = false;

function getSavedUsdRate() {
  const saved = parseFloat(localStorage.getItem(RATE_STORE_KEY));
  return saved && saved > 0 ? saved : 18225;
}

function saveUsdRate(val, isManual = true) {
  const rate = parseFloat(val);
  if (rate && rate > 0) {
    if (isManual) userManualRate = true;
    localStorage.setItem(RATE_STORE_KEY, rate.toString());
    const statusEl = document.getElementById('rate-status-text');
    if (statusEl && isManual) {
      statusEl.textContent = 'Manual';
      statusEl.className = 'text-[9px] text-amber-400 font-mono';
    }
  }
}

// Mengambil kurs USD -> IDR secara real-time
async function fetchLiveUsdRate(force = false) {
  if (userManualRate && !force) return;

  const statusEl = document.getElementById('rate-status-text');
  const rateInput = document.getElementById('calc-usd-rate');
  if (statusEl) {
    statusEl.textContent = 'Memuat kurs...';
    statusEl.className = 'text-[9px] text-slate-400 font-mono';
  }

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!res.ok) throw new Error('Gagal ambil kurs');
    const data = await res.json();
    if (data && data.rates && data.rates.IDR) {
      const liveRate = Math.round(data.rates.IDR);
      userManualRate = false;
      localStorage.setItem(RATE_STORE_KEY, liveRate.toString());
      localStorage.setItem(RATE_TIME_KEY, Date.now().toString());
      if (rateInput) rateInput.value = liveRate;
      if (statusEl) {
        statusEl.textContent = `Live: Rp ${liveRate.toLocaleString('id-ID')}`;
        statusEl.className = 'text-[9px] text-emerald-400 font-mono';
      }
      return;
    }
  } catch (e) {
    // Fallback ke API cadangan jika endpoint utama gagal
    try {
      const res2 = await fetch('https://api.frankfurter.app/latest?from=USD&to=IDR');
      const data2 = await res2.json();
      if (data2 && data2.rates && data2.rates.IDR) {
        const liveRate = Math.round(data2.rates.IDR);
        userManualRate = false;
        localStorage.setItem(RATE_STORE_KEY, liveRate.toString());
        if (rateInput) rateInput.value = liveRate;
        if (statusEl) {
          statusEl.textContent = `Live: Rp ${liveRate.toLocaleString('id-ID')}`;
          statusEl.className = 'text-[9px] text-emerald-400 font-mono';
        }
        return;
      }
    } catch (_) {}
  }

  if (statusEl) {
    const fallback = getSavedUsdRate();
    statusEl.textContent = `Offline (Rp ${fallback.toLocaleString('id-ID')})`;
    statusEl.className = 'text-[9px] text-slate-500 font-mono';
  }
}

// Menghitung Lot & Risk Plan berdasarkan persentase risiko (preset maupun custom)
function applyRiskProfile(riskPercent) {
  const pct = parseFloat(riskPercent);
  const slPips = parseFloat(document.getElementById('calc-sl-pips').value);
  const usdRate = parseFloat(document.getElementById('calc-usd-rate').value) || getSavedUsdRate();
  const feedbackEl = document.getElementById('calc-feedback');

  if (!pct || pct <= 0 || pct > 100) {
    feedbackEl.textContent = 'Masukkan persentase risiko yang valid (contoh: 1.5).';
    feedbackEl.className = 'text-[10px] text-rose-400 font-mono mt-1.5';
    feedbackEl.classList.remove('hidden');
    return;
  }

  if (!slPips || slPips <= 0) {
    feedbackEl.textContent = 'Isi Jarak SL (Pips) dulu. Contoh: 20 pips (= 200 poin).';
    feedbackEl.className = 'text-[10px] text-rose-400 font-mono mt-1.5';
    feedbackEl.classList.remove('hidden');
    document.getElementById('calc-sl-pips').focus();
    return;
  }

  const equity = liveAccountEquity > 0 ? liveAccountEquity : (parseFloat(document.getElementById('initial-balance').value) || 2000000);
  const targetRiskRp = Math.round(equity * (pct / 100));
  const targetRiskUsd = targetRiskRp / usdRate;

  // Rumus lot standar ($10 per pip untuk 1.00 lot)
  const rawLot = targetRiskUsd / (slPips * 10);
  const safeLot = Math.max(0.01, Math.floor(rawLot * 100) / 100).toFixed(2);

  // Masukkan nilai Lot ke dropdown #m-lot
  const lotSelect = document.getElementById('m-lot');
  const optionExists = Array.from(lotSelect.options).some(opt => opt.value === safeLot);
  if (!optionExists) {
    const newOpt = document.createElement('option');
    newOpt.value = safeLot;
    newOpt.textContent = safeLot;
    lotSelect.appendChild(newOpt);
  }
  lotSelect.value = safeLot;

  // Isi otomatis kolom Risk Plan (Rp)
  document.getElementById('m-risk').value = targetRiskRp;

  const estRewardRp = targetRiskRp * 2;
  const minLotNote = rawLot < 0.01 ? ' <span class="text-amber-400">(Min. lot 0.01)</span>' : '';

  feedbackEl.innerHTML =
    `Risk <strong>${pct}%</strong> = <strong>Rp ${targetRiskRp.toLocaleString('id-ID')}</strong> ($${targetRiskUsd.toFixed(2)})<br>` +
    `Rekomendasi Lot: <strong class="text-emerald-400">${safeLot}</strong>${minLotNote} • Target 1:2 ≈ Rp ${estRewardRp.toLocaleString('id-ID')}`;
  feedbackEl.className = 'text-[10px] text-slate-300 font-mono mt-1.5 bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-slate-800 leading-relaxed';
  feedbackEl.classList.remove('hidden');
}

function applyCustomRisk() {
  const customVal = document.getElementById('calc-custom-risk').value;
  applyRiskProfile(customVal);
}

// Memeriksa batas kerugian harian (Daily Loss Limit 3%)
function evaluateDailyLossLimit(currentRunningEquity) {
  liveAccountEquity = currentRunningEquity;

  const banner = document.getElementById('daily-loss-banner');
  if (!banner) return;

  const now = new Date();
  const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  let todayNetPnL = 0;
  let todayTradesCount = 0;

  trades.forEach(t => {
    if (t.date === todayStr) {
      todayTradesCount++;
      todayNetPnL += (t.profit || 0) - (t.loss || 0);
    }
  });

  const baseEquity = currentRunningEquity > 0 ? currentRunningEquity : initialBalance;
  const maxDailyLossRp = baseEquity * 0.03;

  if (todayTradesCount > 0 && todayNetPnL <= -maxDailyLossRp) {
    const lossAbs = Math.abs(todayNetPnL);
    const lossPct = ((lossAbs / baseEquity) * 100).toFixed(2);
    document.getElementById('daily-loss-detail').textContent =
      `Kerugian hari ini (${todayStr}) mencapai -Rp ${lossAbs.toLocaleString('id-ID')} (-${lossPct}%), melewati batas aman harian 3% (Rp ${Math.round(maxDailyLossRp).toLocaleString('id-ID')}). Disarankan berhenti trading hari ini.`;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const rateInput = document.getElementById('calc-usd-rate');
  if (rateInput) rateInput.value = getSavedUsdRate();
  fetchLiveUsdRate();
});
