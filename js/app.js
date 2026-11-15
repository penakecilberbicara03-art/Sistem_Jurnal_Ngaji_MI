/**
 * js/app.js
 * File utama aplikasi: mengatur routing halaman/view, shell navigasi responsif,
 * dan menghubungkan seluruh modul fitur.
 */

import { escapeHtml } from './config.js';
import { showToast } from './ui.js';
import { getSession, logout, renderLoginView, isAdmin, isWali, getRoleDisplayLabel } from './auth.js';
import { renderDashboardView } from './dashboard.js';
import { renderKelasView } from './kelas.js';
import { renderGuruView } from './guru.js';
import { renderSiswaView } from './siswa.js';
import { renderJurnalView } from './jurnal.js';
import { renderWaliView } from './wali.js';

const appRoot = document.getElementById('app');

let currentSession = null;
let currentRoute = 'dashboard'; // 'dashboard' | 'jurnal' | 'kelas' | 'siswa' | 'guru' | 'wali'
let isMobileNavOpen = false;

/**
 * Merender kerangka utama aplikasi (Navbar + Main View Container).
 */
function renderAppShell() {
  const waliMode = isWali(currentSession);
  const adminMode = isAdmin(currentSession);

  const navItems = waliMode
    ? [{ id: 'wali', label: 'Jurnal Ananda' }]
    : adminMode
      ? [
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'jurnal', label: 'Jurnal Mengaji' },
          { id: 'kelas', label: 'Data Kelas' },
          { id: 'siswa', label: 'Data Siswa' },
          { id: 'guru', label: 'Guru & Akun' },
        ]
      : [
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'jurnal', label: 'Jurnal Mengaji' },
          { id: 'kelas', label: 'Data Kelas' },
          { id: 'siswa', label: 'Data Siswa' },
        ];

  const userName = waliMode
    ? currentSession.student?.nama_wali || `Wali ${currentSession.student?.nama || ''}`
    : currentSession.user?.nama || currentSession.user?.username || 'Pengguna';

  const userSubtitle = getRoleDisplayLabel(currentSession);

  appRoot.innerHTML = `
    <div class="min-h-screen flex flex-col bg-slate-50">
      <!-- Top Bar -->
      <header class="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-6">
        <div class="flex items-center gap-3 min-w-0">
          ${
            !waliMode
              ? `
            <button
              type="button"
              id="btn-mobile-menu"
              aria-label="Buka menu navigasi"
              class="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          `
              : ''
          }
          <a href="#dashboard" id="brand-home" class="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <span class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-700 text-white">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </span>
            <span class="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900">
              Jurnal Mengaji MI
            </span>
          </a>
        </div>

        <!-- Desktop Top Nav Links -->
        <nav class="hidden lg:flex items-center gap-6" aria-label="Navigasi Utama">
          ${navItems
            .map((item) => {
              const active = currentRoute === item.id;
              return `
                <button
                  type="button"
                  data-nav="${item.id}"
                  class="nav-link py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'text-emerald-700 border-b-2 border-emerald-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }"
                >
                  ${escapeHtml(item.label)}
                </button>
              `;
            })
            .join('')}
        </nav>

        <!-- Akun & Logout -->
        <div class="flex items-center gap-4 shrink-0">
          <div class="hidden sm:block text-right">
            <div class="text-sm font-semibold text-slate-900 leading-tight max-w-[180px] truncate">${escapeHtml(userName)}</div>
            <div class="text-xs text-slate-500 leading-tight max-w-[200px] truncate">${userSubtitle}</div>
          </div>
          <button
            type="button"
            id="btn-logout"
            class="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Keluar
          </button>
        </div>
      </header>

      <!-- Mobile Drawer Nav -->
      ${
        !waliMode && isMobileNavOpen
          ? `
        <div class="lg:hidden bg-white border-b border-slate-200 px-4 py-3 space-y-1">
          <div class="pb-2 mb-2 border-b border-slate-100 sm:hidden">
            <div class="text-sm font-semibold text-slate-900">${escapeHtml(userName)}</div>
            <div class="text-xs text-slate-500">${userSubtitle}</div>
          </div>
          ${navItems
            .map((item) => {
              const active = currentRoute === item.id;
              return `
                <button
                  type="button"
                  data-nav="${item.id}"
                  class="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    active ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700 hover:bg-slate-100'
                  }"
                >
                  ${escapeHtml(item.label)}
                </button>
              `;
            })
            .join('')}
        </div>
      `
          : ''
      }

      <!-- Main Viewport -->
      <main id="view-container" class="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6"></main>
    </div>
  `;

  appRoot.querySelector('#btn-mobile-menu')?.addEventListener('click', () => {
    isMobileNavOpen = !isMobileNavOpen;
    renderAppShell();
    mountActiveView();
  });

  appRoot.querySelector('#brand-home')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo(waliMode ? 'wali' : 'dashboard');
  });

  appRoot.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-nav');
      isMobileNavOpen = false;
      navigateTo(target);
    });
  });

  appRoot.querySelector('#btn-logout')?.addEventListener('click', () => {
    logout();
    currentSession = null;
    isMobileNavOpen = false;
    initApp();
    showToast('Anda telah keluar dari aplikasi.', 'info');
  });
}

async function mountActiveView() {
  const viewContainer = document.getElementById('view-container');
  if (!viewContainer || !currentSession) return;

  if (isWali(currentSession)) {
    await renderWaliView(viewContainer, currentSession);
    return;
  }

  switch (currentRoute) {
    case 'jurnal':
      await renderJurnalView(viewContainer, currentSession);
      break;
    case 'kelas':
      await renderKelasView(viewContainer, currentSession);
      break;
    case 'siswa':
      await renderSiswaView(viewContainer, currentSession, navigateTo);
      break;
    case 'guru':
      await renderGuruView(viewContainer, currentSession);
      break;
    default:
      await renderDashboardView(viewContainer, currentSession, navigateTo);
      break;
  }
}

export function navigateTo(route) {
  if (!currentSession) return;
  if (isWali(currentSession)) {
    currentRoute = 'wali';
  } else {
    const allowed = isAdmin(currentSession)
      ? ['dashboard', 'jurnal', 'kelas', 'siswa', 'guru']
      : ['dashboard', 'jurnal', 'kelas', 'siswa'];
    currentRoute = allowed.includes(route) ? route : 'dashboard';
  }
  renderAppShell();
  mountActiveView();
}

function initApp() {
  currentSession = getSession();
  if (!currentSession) {
    renderLoginView(appRoot, (session) => {
      currentSession = session;
      currentRoute = isWali(session) ? 'wali' : 'dashboard';
      renderAppShell();
      mountActiveView();
      showToast('Berhasil masuk ke Sistem Jurnal Mengaji.', 'success');
    });
    return;
  }

  currentRoute = isWali(currentSession) ? 'wali' : 'dashboard';
  renderAppShell();
  mountActiveView();
}

document.addEventListener('DOMContentLoaded', initApp);
