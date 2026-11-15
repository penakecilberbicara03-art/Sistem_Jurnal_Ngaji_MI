/**
 * js/config.js
 * Konfigurasi koneksi Supabase (PostgreSQL).
 * Silakan ganti SUPABASE_URL dan SUPABASE_ANON_KEY dengan kredensial proyek Supabase Anda.
 */

export const SUPABASE_URL = 'https://esbskbnaujpwqsnskkmx.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_rNigApAIwU94WKVnUMzGAQ_9Fg4fQXA';

/**
 * Mengecek apakah kredensial Supabase sudah diisi dengan benar.
 * @returns {boolean}
 */
export function isSupabaseConfigured() {
  return (
    Boolean(SUPABASE_URL) &&
    Boolean(SUPABASE_ANON_KEY) &&
    SUPABASE_URL.startsWith('https://') &&
    !SUPABASE_URL.includes('YOUR_PROJECT_ID') &&
    !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY')
  );
}

let cachedClient = null;

/**
 * Mengembalikan instance client Supabase.
 * @returns {import('@supabase/supabase-js').SupabaseClient | null}
 */
export function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!cachedClient) {
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      throw new Error('SDK Supabase belum termuat. Periksa koneksi internet atau tag script CDN.');
    }
    cachedClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return cachedClient;
}

/**
 * Format tanggal YYYY-MM-DD ke format Indonesia yang rapi.
 * @param {string} dateStr
 * @returns {string}
 */
export function formatTanggalID(dateStr) {
  if (!dateStr) return '-';
  const parts = String(dateStr).split('T')[0].split('-');
  if (parts.length !== 3) return dateStr;
  const bulan = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
  ];
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (Number.isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) return dateStr;
  return `${day} ${bulan[monthIdx]} ${year}`;
}

/**
 * Mengembalikan tanggal hari ini dalam format YYYY-MM-DD (waktu lokal).
 * @returns {string}
 */
export function getTodayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Escape HTML untuk mencegah XSS saat merender data dinamis.
 * @param {unknown} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
