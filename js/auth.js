/**
 * js/auth.js
 * Logika autentikasi & kontrol akses (RBAC) untuk 3 role:
 * 1. Admin (roodoh_users, role = 'admin')
 * 2. Guru / Wali Kelas (roodoh_users, role = 'guru', akses dibatasi assigned_classes)
 * 3. Wali Murid (roodoh_students via nisn + password default 'wali123', Read-Only)
 */

import { getSupabaseClient, isSupabaseConfigured, escapeHtml } from './config.js';

const SESSION_KEY = 'mi_jurnal_mengaji_session_v1';
const DEFAULT_WALI_PASSWORD = 'wali123';

/**
 * Mengambil sesi pengguna yang tersimpan di localStorage.
 * @returns {object | null}
 */
export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Menyimpan sesi pengguna ke localStorage.
 * @param {object} session
 */
export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

/**
 * Menghapus sesi (logout).
 */
export function logout() {
  localStorage.removeItem(SESSION_KEY);
}

export function isAdmin(session) {
  return session?.role === 'admin';
}

export function isGuru(session) {
  return session?.role === 'guru';
}

export function isWali(session) {
  return session?.role === 'wali';
}

/**
 * Mengambil daftar kelas yang ditugaskan untuk guru (dari kolom jsonb assigned_classes).
 * @param {object | null} session
 * @returns {string[]}
 */
export function getAssignedClasses(session) {
  if (!session || session.role !== 'guru') return [];
  const raw = session.user?.assigned_classes;
  if (Array.isArray(raw)) {
    return raw.map((c) => String(c).trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((c) => String(c).trim()).filter(Boolean);
      }
    } catch {
      return raw.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

/**
 * Cek apakah user berhak mengakses kelas tertentu.
 * @param {object | null} session
 * @param {string} kelasNama
 * @returns {boolean}
 */
export function canAccessClass(session, kelasNama) {
  if (!session) return false;
  if (session.role === 'admin') return true;
  if (session.role === 'guru') {
    return getAssignedClasses(session).includes(String(kelasNama).trim());
  }
  return false;
}

/**
 * Proses login untuk Admin dan Guru melalui tabel `roodoh_users`.
 * @param {string} username
 * @param {string} password
 * @returns {Promise<object>}
 */
export async function loginStaff(username, password) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Koneksi Supabase belum dikonfigurasi pada file js/config.js.');
  }

  const cleanUser = username.trim();
  const cleanPass = password;
  if (!cleanUser || !cleanPass) {
    throw new Error('Username dan password wajib diisi.');
  }

  const { data, error } = await supabase
    .from('roodoh_users')
    .select('id, username, password, role, nama, jabatan, assigned_classes, created_at')
    .eq('username', cleanUser)
    .maybeSingle();

  if (error) {
    throw new Error(`Gagal memeriksa akun: ${error.message}`);
  }

  if (!data || data.password !== cleanPass) {
    throw new Error('Username atau password tidak sesuai.');
  }

  const normalizedRole = String(data.role || '').toLowerCase();
  if (normalizedRole !== 'admin' && normalizedRole !== 'guru') {
    throw new Error('Role pengguna tidak dikenali. Hubungi Admin.');
  }

  const safeUser = {
    id: data.id,
    username: data.username,
    role: normalizedRole,
    nama: data.nama || data.username,
    jabatan: data.jabatan || (normalizedRole === 'admin' ? 'Administrator' : 'Guru Mengaji'),
    assigned_classes: data.assigned_classes || [],
  };

  const session = {
    role: normalizedRole,
    user: safeUser,
    loggedInAt: new Date().toISOString(),
  };
  saveSession(session);
  return session;
}

/**
 * Proses login untuk Wali Murid melalui NISN pada tabel `roodoh_students` dengan password default `wali123`.
 * @param {string} nisn
 * @param {string} password
 * @returns {Promise<object>}
 */
export async function loginWali(nisn, password) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Koneksi Supabase belum dikonfigurasi pada file js/config.js.');
  }

  const cleanNisn = nisn.trim();
  if (!cleanNisn || !password) {
    throw new Error('NISN siswa dan password wajib diisi.');
  }

  if (password !== DEFAULT_WALI_PASSWORD) {
    throw new Error('Password wali murid tidak sesuai (default: wali123).');
  }

  const { data, error } = await supabase
    .from('roodoh_students')
    .select('*')
    .eq('nisn', cleanNisn)
    .maybeSingle();

  if (error) {
    throw new Error(`Gagal memverifikasi NISN: ${error.message}`);
  }

  if (!data) {
    throw new Error('Data siswa dengan NISN tersebut tidak ditemukan.');
  }

  const session = {
    role: 'wali',
    student: data,
    loggedInAt: new Date().toISOString(),
  };
  saveSession(session);
  return session;
}

/**
 * Merender halaman login ke dalam container.
 * @param {HTMLElement} container
 * @param {(session: object) => void} onLoginSuccess
 */
export function renderLoginView(container, onLoginSuccess) {
  let activeTab = 'staff'; // 'staff' | 'wali'
  const configured = isSupabaseConfigured();

  container.innerHTML = `
    <div class="min-h-screen flex flex-col justify-between bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div class="max-w-md w-full mx-auto my-auto">
        <!-- Identitas Madrasah -->
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-700 text-white mb-4 shadow-sm">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Sistem Jurnal Mengaji
          </h1>
          <p class="mt-2 text-sm text-slate-600">
            Madrasah Ibtidaiyah (MI) · Pencatatan Binadzor &amp; Tahfidz Harian
          </p>
        </div>

        ${
          !configured
            ? `
          <div class="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p class="font-semibold">Konfigurasi Supabase Diperlukan</p>
            <p class="mt-1 text-amber-800 leading-relaxed">
              Isi <code class="font-mono text-xs bg-amber-100 px-1.5 py-0.5 rounded">SUPABASE_URL</code> dan
              <code class="font-mono text-xs bg-amber-100 px-1.5 py-0.5 rounded">SUPABASE_ANON_KEY</code>
              pada file <code class="font-mono text-xs bg-amber-100 px-1.5 py-0.5 rounded">js/config.js</code> untuk menghubungkan database.
            </p>
          </div>
        `
            : ''
        }

        <!-- Kartu Form Login -->
        <div class="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <!-- Segmented Switch Role -->
          <div class="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-6" role="tablist">
            <button
              type="button"
              id="tab-login-staff"
              role="tab"
              aria-selected="true"
              class="py-2 px-3 text-sm font-semibold rounded-lg bg-white text-slate-900 shadow-sm transition-colors whitespace-nowrap"
            >
              Guru &amp; Admin
            </button>
            <button
              type="button"
              id="tab-login-wali"
              role="tab"
              aria-selected="false"
              class="py-2 px-3 text-sm font-semibold rounded-lg text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap"
            >
              Wali Murid
            </button>
          </div>

          <!-- Pesan Error -->
          <div
            id="login-error"
            class="hidden mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
            role="alert"
          ></div>

          <!-- Form Login -->
          <form id="login-form" class="space-y-4">
            <div>
              <label
                for="login-identifier"
                id="login-identifier-label"
                class="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Username
              </label>
              <input
                id="login-identifier"
                name="identifier"
                type="text"
                required
                autocomplete="username"
                placeholder="Masukkan username guru atau admin"
                class="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>

            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label
                  for="login-password"
                  class="block text-sm font-medium text-slate-700"
                >
                  Password
                </label>
                <span id="login-password-hint" class="hidden text-xs text-slate-500">
                  Default: <span class="font-mono font-medium text-slate-700">wali123</span>
                </span>
              </div>
              <input
                id="login-password"
                name="password"
                type="password"
                required
                autocomplete="current-password"
                placeholder="Masukkan password"
                class="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>

            <button
              type="submit"
              id="login-submit-btn"
              class="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Masuk ke Aplikasi
            </button>
          </form>

          <p id="login-role-caption" class="mt-5 pt-4 border-t border-slate-100 text-xs text-slate-500 text-center">
            Gunakan akun <span class="font-medium text-slate-700">Admin</span> atau <span class="font-medium text-slate-700">Guru Pembimbing</span> untuk mencatat dan mengelola data.
          </p>
        </div>
      </div>

      <footer class="text-center text-xs text-slate-400 pt-6">
        Sistem Jurnal Mengaji Madrasah Ibtidaiyah
      </footer>
    </div>
  `;

  const tabStaff = container.querySelector('#tab-login-staff');
  const tabWali = container.querySelector('#tab-login-wali');
  const idLabel = container.querySelector('#login-identifier-label');
  const idInput = container.querySelector('#login-identifier');
  const passInput = container.querySelector('#login-password');
  const passHint = container.querySelector('#login-password-hint');
  const roleCaption = container.querySelector('#login-role-caption');
  const errorBox = container.querySelector('#login-error');
  const form = container.querySelector('#login-form');
  const submitBtn = container.querySelector('#login-submit-btn');

  function updateTabUI(nextTab) {
    activeTab = nextTab;
    errorBox.classList.add('hidden');
    errorBox.textContent = '';

    if (activeTab === 'staff') {
      tabStaff.className =
        'py-2 px-3 text-sm font-semibold rounded-lg bg-white text-slate-900 shadow-sm transition-colors whitespace-nowrap';
      tabStaff.setAttribute('aria-selected', 'true');
      tabWali.className =
        'py-2 px-3 text-sm font-semibold rounded-lg text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap';
      tabWali.setAttribute('aria-selected', 'false');

      idLabel.textContent = 'Username';
      idInput.placeholder = 'Masukkan username guru atau admin';
      idInput.value = '';
      passInput.value = '';
      passHint.classList.add('hidden');
      roleCaption.innerHTML =
        'Gunakan akun <span class="font-medium text-slate-700">Admin</span> atau <span class="font-medium text-slate-700">Guru Pembimbing</span> untuk mencatat dan mengelola data.';
    } else {
      tabWali.className =
        'py-2 px-3 text-sm font-semibold rounded-lg bg-white text-slate-900 shadow-sm transition-colors whitespace-nowrap';
      tabWali.setAttribute('aria-selected', 'true');
      tabStaff.className =
        'py-2 px-3 text-sm font-semibold rounded-lg text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap';
      tabStaff.setAttribute('aria-selected', 'false');

      idLabel.textContent = 'NISN Siswa';
      idInput.placeholder = 'Masukkan nomor NISN ananda';
      idInput.value = '';
      passInput.value = '';
      passHint.classList.remove('hidden');
      roleCaption.innerHTML =
        'Akses khusus orang tua/wali murid (Read-Only) untuk memantau perkembangan mengaji ananda.';
    }
    idInput.focus();
  }

  tabStaff.addEventListener('click', () => updateTabUI('staff'));
  tabWali.addEventListener('click', () => updateTabUI('wali'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.classList.add('hidden');
    errorBox.textContent = '';

    const identifier = idInput.value;
    const password = passInput.value;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Memproses...';

    try {
      const session =
        activeTab === 'staff'
          ? await loginStaff(identifier, password)
          : await loginWali(identifier, password);
      onLoginSuccess(session);
    } catch (err) {
      errorBox.textContent = err?.message || 'Terjadi kesalahan saat masuk.';
      errorBox.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Masuk ke Aplikasi';
    }
  });
}

/**
 * Mengembalikan label role yang mudah dibaca.
 * @param {object} session
 * @returns {string}
 */
export function getRoleDisplayLabel(session) {
  if (!session) return '';
  if (session.role === 'admin') return escapeHtml(session.user?.jabatan || 'Administrator');
  if (session.role === 'guru') {
    const classes = getAssignedClasses(session);
    return classes.length > 0
      ? `Guru · Kelas ${escapeHtml(classes.join(', '))}`
      : escapeHtml(session.user?.jabatan || 'Guru Mengaji');
  }
  if (session.role === 'wali') {
    return `Wali dari ${escapeHtml(session.student?.nama || 'Siswa')}`;
  }
  return '';
}
