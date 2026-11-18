const RATE_STORE_KEY = 'jurnal_usd_idr_rate';
let liveAccountEquity = 2000000;

function getSavedUsdRate() {
  const saved = parseFloat(localStorage.getItem(RATE_STORE_KEY));
  return saved && saved > 0 ? saved : 16000;
}

function saveUsdRate(val) {
  const rate = parseFloat(val);
  if (rate && rate > 0) {
    localStorage.setItem(RATE_STORE_KEY, rate.toString());
  }
}

// Menghitung Lot & Risk Plan otomatis berdasarkan profil risiko (0.5%, 1%, 2%)
function applyRiskProfile(riskPercent) {
  const slPips = parseFloat(document.getElementById('calc-sl-pips').value);
  const usdRate = parseFloat(document.getElementById('calc-usd-rate').value) || getSavedUsdRate();
  const feedbackEl = document.getElementById('calc-feedback');

  if (!slPips || slPips <= 0) {
    feedbackEl.textContent = 'Masukkan jarak Stop Loss (Pips) terlebih dahulu.';
    feedbackEl.className = 'text-[10px] text-rose-400 font-mono mt-1.5';
    feedbackEl.classList.remove('hidden');
    document.getElementById('calc-sl-pips').focus();
    return;
  }

  saveUsdRate(usdRate);

  const equity = liveAccountEquity > 0 ? liveAccountEquity : (parseFloat(document.getElementById('initial-balance').value) || 2000000);
  const targetRiskRp = Math.round(equity * (riskPercent / 100));
  const targetRiskUsd = targetRiskRp / usdRate;

  // Standar nilai 1.00 lot = $10 per pip (dibulatkan ke bawah 2 desimal agar aman)
  const rawLot = targetRiskUsd / (slPips * 10);
  const safeLot = Math.max(0.01, Math.floor(rawLot * 100) / 100).toFixed(2);

  // Masukkan nilai Lot ke dropdown #m-lot (buat opsi baru jika belum ada di daftar)
  const lotSelect = document.getElementById('m-lot');
  let optionExists = Array.from(lotSelect.options).some(opt => opt.value === safeLot);
  if (!optionExists) {
    const newOpt = document.createElement('option');
    newOpt.value = safeLot;
    newOpt.textContent = safeLot;
    lotSelect.appendChild(newOpt);
  }
  lotSelect.value = safeLot;

  // Isi nominal Risk Plan (Rp)
  document.getElementById('m-risk').value = targetRiskRp;

  // Hitung estimasi nominal 1:2 R:R sebagai panduan cepat
  const estRewardRp = targetRiskRp * 2;
  feedbackEl.innerHTML = `Risk <strong>${riskPercent}%</strong> = <strong>Rp ${targetRiskRp.toLocaleString('id-ID')}</strong> • Lot: <strong class="text-emerald-400">${safeLot}</strong> (Target 1:2 ≈ Rp ${estRewardRp.toLocaleString('id-ID')})`;
  feedbackEl.className = 'text-[10px] text-slate-300 font-mono mt-1.5 bg-slate-900/90 px-2 py-1 rounded border border-slate-800';
  feedbackEl.classList.remove('hidden');
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
  const maxDailyLossRp = baseEquity * 0.03; // Batas 3% per hari

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

// Inisialisasi nilai kurs tersimpan saat halaman dimuat
window.addEventListener('DOMContentLoaded', () => {
  const rateInput = document.getElementById('calc-usd-rate');
  if (rateInput) rateInput.value = getSavedUsdRate();
});
