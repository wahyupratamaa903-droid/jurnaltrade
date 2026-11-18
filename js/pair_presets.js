const FAV_PAIRS_KEY = 'jurnal_favorite_pairs_v1';
const DEFAULT_FAV_PAIRS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSD', 'US30'];

function getFavoritePairs() {
  try {
    const saved = JSON.parse(localStorage.getItem(FAV_PAIRS_KEY));
    if (Array.isArray(saved) && saved.length > 0) return saved;
  } catch (_) {}
  return [...DEFAULT_FAV_PAIRS];
}

function saveFavoritePairs(list) {
  localStorage.setItem(FAV_PAIRS_KEY, JSON.stringify(list));
}

function selectPresetPair(symbol) {
  const input = document.getElementById('m-pair');
  if (input) {
    input.value = symbol.toUpperCase();
    highlightActivePairPreset();
  }
}

function addCustomFavoritePair() {
  const raw = prompt('Masukkan simbol Pair baru (contoh: GBPJPY atau NAS100):');
  if (!raw) return;
  const clean = raw.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, '');
  if (!clean) return;

  const list = getFavoritePairs();
  if (!list.includes(clean)) {
    list.push(clean);
    saveFavoritePairs(list);
  }
  selectPresetPair(clean);
  renderPairPresets();
}

function removeFavoritePair(event, symbol) {
  event.stopPropagation();
  const list = getFavoritePairs().filter(p => p !== symbol);
  saveFavoritePairs(list.length > 0 ? list : [...DEFAULT_FAV_PAIRS]);
  renderPairPresets();
}

function highlightActivePairPreset() {
  const currentVal = (document.getElementById('m-pair')?.value || '').trim().toUpperCase();
  document.querySelectorAll('.pair-preset-btn').forEach(btn => {
    const sym = btn.getAttribute('data-pair');
    const isActive = sym === currentVal;
    btn.className = isActive
      ? 'pair-preset-btn inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/50 font-mono text-[10px] font-bold transition'
      : 'pair-preset-btn inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800 font-mono text-[10px] transition';
  });
}

function renderPairPresets() {
  const container = document.getElementById('pair-presets-container');
  if (!container) return;

  const list = getFavoritePairs();
  const buttonsHtml = list.map(sym => {
    const isDefault = DEFAULT_FAV_PAIRS.includes(sym);
    const removeTag = !isDefault
      ? `<span onclick="removeFavoritePair(event, '${sym}')" title="Hapus" class="text-slate-500 hover:text-rose-400 ml-0.5">×</span>`
      : '';
    return `
      <button type="button" data-pair="${sym}" onclick="selectPresetPair('${sym}')"
        class="pair-preset-btn inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800 font-mono text-[10px] transition">
        ${sym}${removeTag}
      </button>
    `;
  }).join('');

  container.innerHTML = buttonsHtml + `
    <button type="button" onclick="addCustomFavoritePair()" title="Tambah Pair Favorit"
      class="px-2 py-0.5 rounded bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-400 border border-emerald-800/60 font-mono text-[10px] font-bold transition">
      + Pair
    </button>
  `;
  highlightActivePairPreset();
}

window.addEventListener('DOMContentLoaded', () => {
  renderPairPresets();
  const pairInput = document.getElementById('m-pair');
  if (pairInput) {
    pairInput.addEventListener('input', highlightActivePairPreset);
  }
});
