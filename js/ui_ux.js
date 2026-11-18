// 1. Sistem Notifikasi Toast Melayang
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed bottom-20 md:bottom-5 right-4 z-[9998] flex flex-col gap-2 pointer-events-none max-w-[300px]';
    document.body.appendChild(container);
  }

  const styles = {
    success: 'bg-slate-900/95 border-emerald-500/50 text-emerald-300',
    error: 'bg-slate-900/95 border-rose-500/50 text-rose-300',
    info: 'bg-slate-900/95 border-amber-500/50 text-amber-300'
  };

  const icons = {
    success: 'fa-circle-check text-emerald-400',
    error: 'fa-circle-exclamation text-rose-400',
    info: 'fa-cloud-arrow-up text-amber-400'
  };

  const toast = document.createElement('div');
  toast.className = `toast-item pointer-events-auto border ${styles[type] || styles.success} px-3.5 py-2.5 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-2.5 text-[11px] font-medium`;
  toast.innerHTML = `<i class="fas ${icons[type] || icons.success} text-xs shrink-0"></i><span>${message}</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 0.22s ease';
    setTimeout(() => toast.remove(), 240);
  }, 2800);
}

// 2. Indikator Status Sinkronisasi Cloud
function setCloudSyncState(state) {
  const badge = document.getElementById('cloud-sync-badge');
  if (!badge) return;

  if (state === 'syncing') {
    badge.innerHTML = '<i class="fas fa-rotate fa-spin text-amber-400"></i> <span class="hidden sm:inline">Menyimpan...</span>';
    badge.className = 'inline-flex items-center gap-1 text-[10px] font-mono text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full';
  } else if (state === 'offline') {
    badge.innerHTML = '<i class="fas fa-cloud-slash text-rose-400"></i> <span class="hidden sm:inline">Offline</span>';
    badge.className = 'inline-flex items-center gap-1 text-[10px] font-mono text-rose-300 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-full';
  } else {
    badge.innerHTML = '<i class="fas fa-circle-check text-emerald-400"></i> <span class="hidden sm:inline">Cloud Aktif</span>';
    badge.className = 'inline-flex items-center gap-1 text-[10px] font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full';
  }
}

// 3. Robinhood Ticker (Animasi Angka Bergulir Halus untuk Equity & Capital Gain)
let tickerAnimFrame = null;
let prevTickerEquity = null;
let prevTickerGain = null;

function animateEquityTicker(targetEquity, targetGainPct, isPositive) {
  const eqEl = document.getElementById('current-equity');
  const gainEl = document.getElementById('capital-gain');
  if (!eqEl || !gainEl) return;

  gainEl.className = `font-black ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`;

  const endEq = Number(targetEquity) || 0;
  const endGain = parseFloat(targetGainPct) || 0;

  if (prevTickerEquity === null || (prevTickerEquity === endEq && prevTickerGain === endGain)) {
    prevTickerEquity = endEq;
    prevTickerGain = endGain;
    eqEl.textContent = `Rp ${Math.round(endEq).toLocaleString('id-ID')}`;
    gainEl.textContent = `${endGain >= 0 ? '+' : ''}${endGain.toFixed(2)}%`;
    return;
  }

  if (tickerAnimFrame) cancelAnimationFrame(tickerAnimFrame);

  const startEq = prevTickerEquity;
  const startGain = prevTickerGain !== null ? prevTickerGain : endGain;
  const duration = 450;
  const startTime = performance.now();

  function step(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - progress, 3); // Ease-out cubic

    const curEq = Math.round(startEq + (endEq - startEq) * eased);
    const curGain = startGain + (endGain - startGain) * eased;

    eqEl.textContent = `Rp ${curEq.toLocaleString('id-ID')}`;
    gainEl.textContent = `${curGain >= 0 ? '+' : ''}${curGain.toFixed(2)}%`;

    if (progress < 1) {
      tickerAnimFrame = requestAnimationFrame(step);
    } else {
      prevTickerEquity = endEq;
      prevTickerGain = endGain;
      eqEl.textContent = `Rp ${Math.round(endEq).toLocaleString('id-ID')}`;
      gainEl.textContent = `${endGain >= 0 ? '+' : ''}${endGain.toFixed(2)}%`;
      tickerAnimFrame = null;
    }
  }

  tickerAnimFrame = requestAnimationFrame(step);
}

// 4. Tombol Sakelar Mode Tampilan: Tabel vs Kartu HP (RecyclerView Card List)
const VIEW_MODE_KEY = 'jurnal_trades_view_mode';

function getTradesViewMode() {
  const saved = localStorage.getItem(VIEW_MODE_KEY);
  if (saved === 'table' || saved === 'cards') return saved;
  return window.innerWidth < 768 ? 'cards' : 'table';
}

function setTradesViewMode(mode) {
  localStorage.setItem(VIEW_MODE_KEY, mode);
  applyTradesViewModeUI();
}

function applyTradesViewModeUI() {
  const mode = getTradesViewMode();
  const tableWrap = document.getElementById('table-view-wrapper');
  const cardsWrap = document.getElementById('cards-view-wrapper');
  const btnTable = document.getElementById('view-btn-table');
  const btnCards = document.getElementById('view-btn-cards');

  if (!tableWrap || !cardsWrap) return;

  if (mode === 'cards') {
    tableWrap.classList.add('hidden');
    cardsWrap.classList.remove('hidden');
    if (btnCards) btnCards.className = 'px-2.5 py-1 rounded-md bg-emerald-600 text-white font-bold transition';
    if (btnTable) btnTable.className = 'px-2.5 py-1 rounded-md text-slate-400 hover:text-slate-200 transition';
  } else {
    cardsWrap.classList.add('hidden');
    tableWrap.classList.remove('hidden');
    if (btnTable) btnTable.className = 'px-2.5 py-1 rounded-md bg-emerald-600 text-white font-bold transition';
    if (btnCards) btnCards.className = 'px-2.5 py-1 rounded-md text-slate-400 hover:text-slate-200 transition';
  }
}

// 5. Tombol Tambah Mengambang (Floating Action Button) untuk Jangkauan Ibu Jari di HP
function initMobileFloatingButton() {
  if (document.getElementById('mobile-fab-add')) return;

  const fab = document.createElement('button');
  fab.id = 'mobile-fab-add';
  fab.type = 'button';
  fab.title = 'Tambah Posisi Baru';
  fab.onclick = () => openModal();
  fab.className = 'md:hidden fixed bottom-5 right-4 z-40 w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-xl shadow-emerald-950/80 flex items-center justify-center text-lg font-black transition-all duration-200 opacity-0 translate-y-4 pointer-events-none active:scale-90';
  fab.innerHTML = '<i class="fas fa-plus"></i>';
  document.body.appendChild(fab);

  function updateFabVisibility() {
    const authOverlay = document.getElementById('auth-overlay');
    const isLoggedIn = authOverlay && authOverlay.classList.contains('hidden');
    if (isLoggedIn && window.scrollY > 120) {
      fab.classList.remove('opacity-0', 'translate-y-4', 'pointer-events-none');
      fab.classList.add('opacity-100', 'translate-y-0', 'pointer-events-auto');
    } else {
      fab.classList.add('opacity-0', 'translate-y-4', 'pointer-events-none');
      fab.classList.remove('opacity-100', 'translate-y-0', 'pointer-events-auto');
    }
  }

  window.addEventListener('scroll', updateFabVisibility, { passive: true });
}

// 6. Bottom Sheet Drag Handle & Swipe-Down Close untuk Layar HP
function initBottomSheetUX() {
  const modalIds = ['entry-modal', 'detail-modal', 'account-modal', 'ai-analyst-modal'];

  modalIds.forEach(id => {
    const backdrop = document.getElementById(id);
    if (!backdrop) return;

    const box = backdrop.querySelector('.modal-animate-box');
    if (box && !box.querySelector('.bottom-sheet-handle')) {
      const handle = document.createElement('div');
      handle.className = 'bottom-sheet-handle';
      box.insertBefore(handle, box.firstChild);

      // Gestur usap ke bawah dari bagian atas sheet untuk menutup
      let startY = 0;
      let currentDelta = 0;
      box.addEventListener('touchstart', (e) => {
        if (box.scrollTop <= 0) {
          startY = e.touches[0].clientY;
          currentDelta = 0;
        } else {
          startY = 0;
        }
      }, { passive: true });

      box.addEventListener('touchmove', (e) => {
        if (!startY) return;
        const delta = e.touches[0].clientY - startY;
        if (delta > 0 && box.scrollTop <= 0) {
          currentDelta = delta;
          box.style.transform = `translateY(${Math.min(delta, 180)}px)`;
        }
      }, { passive: true });

      box.addEventListener('touchend', () => {
        if (currentDelta > 95) {
          backdrop.classList.add('hidden');
          backdrop.classList.remove('flex', 'modal-animate-backdrop');
        }
        box.style.transform = '';
        startY = 0;
        currentDelta = 0;
      });
    }

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.add('hidden');
        backdrop.classList.remove('flex', 'modal-animate-backdrop');
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      modalIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.classList.contains('hidden')) {
          el.classList.add('hidden');
          el.classList.remove('flex', 'modal-animate-backdrop');
        }
      });
    }
  });
}

// 7. Pull-to-Refresh (SwipeRefreshLayout) untuk PWA Layar Penuh
function initPullToRefresh() {
  if (document.getElementById('ptr-indicator')) return;

  const ptr = document.createElement('div');
  ptr.id = 'ptr-indicator';
  ptr.className = 'fixed top-3 left-1/2 -translate-x-1/2 z-[9990] bg-slate-900/95 border border-emerald-500/40 text-emerald-400 px-3.5 py-1.5 rounded-full shadow-2xl backdrop-blur-md flex items-center gap-2 text-[11px] font-mono transition-all duration-200 opacity-0 -translate-y-12 pointer-events-none';
  ptr.innerHTML = '<i id="ptr-icon" class="fas fa-arrow-down"></i><span id="ptr-text">Tarik untuk sinkronisasi</span>';
  document.body.appendChild(ptr);

  let startY = 0;
  let pulling = false;
  let triggered = false;

  function isAnyModalOpen() {
    const auth = document.getElementById('auth-overlay');
    if (auth && !auth.classList.contains('hidden')) return true;
    return ['entry-modal', 'detail-modal', 'account-modal', 'ai-analyst-modal'].some(id => {
      const m = document.getElementById(id);
      return m && !m.classList.contains('hidden');
    });
  }

  window.addEventListener('touchstart', (e) => {
    if (window.scrollY <= 0 && !isAnyModalOpen() && e.touches.length === 1) {
      startY = e.touches[0].clientY;
      pulling = true;
      triggered = false;
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!pulling) return;
    const dist = e.touches[0].clientY - startY;
    if (dist > 18 && window.scrollY <= 0) {
      const clamped = Math.min(dist, 110);
      ptr.style.opacity = Math.min(1, clamped / 65).toString();
      ptr.style.transform = `translate(-50%, ${Math.round(clamped * 0.45)}px)`;

      const icon = document.getElementById('ptr-icon');
      const text = document.getElementById('ptr-text');
      if (dist > 78) {
        triggered = true;
        if (icon) icon.className = 'fas fa-rotate text-emerald-400';
        if (text) text.textContent = 'Lepas untuk memuat ulang...';
      } else {
        triggered = false;
        if (icon) icon.className = 'fas fa-arrow-down text-slate-400';
        if (text) text.textContent = 'Tarik untuk sinkronisasi';
      }
    } else if (dist < 0) {
      pulling = false;
    }
  }, { passive: true });

  window.addEventListener('touchend', async () => {
    if (!pulling) return;
    pulling = false;

    if (triggered && typeof currentUserKey !== 'undefined' && currentUserKey) {
      const icon = document.getElementById('ptr-icon');
      const text = document.getElementById('ptr-text');
      if (icon) icon.className = 'fas fa-rotate fa-spin text-emerald-400';
      if (text) text.textContent = 'Menyinkronkan cloud...';

      if (typeof loadUserData === 'function') {
        await loadUserData(currentUserKey);
      }
      showToast('Data berhasil disinkronkan dari Cloud!');
    }

    ptr.style.opacity = '0';
    ptr.style.transform = 'translate(-50%, -48px)';
    triggered = false;
  });
}

window.addEventListener('DOMContentLoaded', () => {
  applyTradesViewModeUI();
  initMobileFloatingButton();
  initBottomSheetUX();
  initPullToRefresh();
});
