// 1. Sistem Notifikasi Toast Melayang (Pengganti alert() yang kaku)
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

// 2. Indikator Status Sinkronisasi Cloud di Bar Atas
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
    badge.innerHTML = '<i class="fas fa-cloud-check text-emerald-400"></i> <span class="hidden sm:inline">Cloud Aktif</span>';
    badge.className = 'inline-flex items-center gap-1 text-[10px] font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full';
  }
}

// 3. Tombol Tambah Mengambang (Floating Action Button) untuk Jangkauan Ibu Jari di HP
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

// 4. Tutup Modal dengan Mengetuk Area Luar (Backdrop) atau Tombol Esc
function initModalDismissUX() {
  const modalIds = ['entry-modal', 'detail-modal', 'account-modal'];
  modalIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', (e) => {
      if (e.target === el) {
        el.classList.add('hidden');
        el.classList.remove('flex', 'modal-animate-backdrop');
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

window.addEventListener('DOMContentLoaded', () => {
  initMobileFloatingButton();
  initModalDismissUX();
});
