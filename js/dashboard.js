/**
 * js/dashboard.js
 * Halaman Dashboard ringkasan aktivitas mengaji harian untuk Admin dan Guru.
 */

import { isSupabaseConfigured, escapeHtml, formatTanggalID, getTodayISO } from './config.js';
import { isAdmin, getRoleDisplayLabel } from './auth.js';
import { fetchAccessibleClasses } from './kelas.js';
import { fetchAccessibleStudents } from './siswa.js';
import {
  fetchAccessibleJournals,
  getNilaiTextClass,
  getKehadiranTextClass,
} from './jurnal.js';

/**
 * Merender halaman Ringkasan Dashboard untuk Admin dan Guru.
 * @param {HTMLElement} container
 * @param {object} session
 * @param {(route: string) => void} onNavigate
 */
export async function renderDashboardView(container, session, onNavigate) {
  container.innerHTML = `
    <div class="space-y-6">
      <div class="h-24 bg-white border border-slate-200 rounded-xl animate-pulse"></div>
      <div class="h-64 bg-white border border-slate-200 rounded-xl animate-pulse"></div>
    </div>
  `;

  if (!isSupabaseConfigured()) {
    container.innerHTML = `
      <div class="bg-white border border-amber-200 rounded-xl p-6">
        <h2 class="text-lg font-bold text-slate-900">Hubungkan Database Supabase</h2>
        <p class="text-sm text-slate-600 mt-1">
          Isi kredensial <code class="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">SUPABASE_URL</code> dan
          <code class="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">SUPABASE_ANON_KEY</code> di file
          <code class="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">js/config.js</code> untuk mulai memuat data.
        </p>
      </div>
    `;
    return;
  }

  try {
    const [classes, students] = await Promise.all([
      fetchAccessibleClasses(session),
      fetchAccessibleStudents(session),
    ]);
    const journals = await fetchAccessibleJournals(session, students);

    const today = getTodayISO();
    const todayJournals = journals.filter((j) => String(j.tanggal || '').startsWith(today));
    const mumtazCount = journals.filter(
      (j) => j.nilai_bacaan === 'Mumtaz' || j.nilai_hafalan === 'Mumtaz'
    ).length;
    const studentMap = new Map(students.map((s) => [String(s.id), s]));
    const latestEight = journals.slice(0, 8);

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Sambutan Ringkas -->
        <section class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 class="text-xl font-bold text-slate-900">
              Assalamu'alaikum, ${escapeHtml(session.user?.nama || 'Ustadz/Ustadzah')}
            </h2>
            <p class="text-sm text-slate-600 mt-0.5">
              ${getRoleDisplayLabel(session)} · Ringkasan aktivitas mengaji per ${formatTanggalID(today)}
            </p>
          </div>
          <div class="flex items-center gap-2.5 self-start sm:self-auto">
            ${
              isAdmin(session) && classes.length === 0
                ? `<button
                    type="button"
                    id="dash-btn-add-kelas"
                    class="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-700 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    + Tambah Kelas
                  </button>`
                : ''
            }
            <button
              type="button"
              id="dash-btn-input-jurnal"
              class="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0"
            >
              + Catat Jurnal Mengaji
            </button>
          </div>
        </section>

        <!-- Statistik Utama -->
        <section class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white border border-slate-200 rounded-xl p-4">
            <div class="flex items-center justify-between gap-2">
              <div class="text-xs font-medium text-slate-500">Total Siswa Terdaftar</div>
              <button type="button" id="dash-link-siswa" class="text-xs font-semibold text-emerald-700 hover:text-emerald-900">Lihat</button>
            </div>
            <div class="text-2xl font-bold text-slate-900 tabular-nums mt-1">${students.length}</div>
          </div>
          <div class="bg-white border border-slate-200 rounded-xl p-4">
            <div class="flex items-center justify-between gap-2">
              <div class="text-xs font-medium text-slate-500">Kelas Aktif</div>
              <button type="button" id="dash-link-kelas" class="text-xs font-semibold text-emerald-700 hover:text-emerald-900">Kelola</button>
            </div>
            <div class="text-2xl font-bold text-slate-900 tabular-nums mt-1">${classes.length}</div>
          </div>
          <div class="bg-white border border-slate-200 rounded-xl p-4">
            <div class="text-xs font-medium text-slate-500">Setoran Hari Ini</div>
            <div class="text-2xl font-bold text-emerald-700 tabular-nums mt-1">${todayJournals.length}</div>
          </div>
          <div class="bg-white border border-slate-200 rounded-xl p-4">
            <div class="text-xs font-medium text-slate-500">Capaian Predikat Mumtaz</div>
            <div class="text-2xl font-bold text-slate-900 tabular-nums mt-1">${mumtazCount}</div>
          </div>
        </section>

        <!-- Daftar Setoran Terbaru -->
        <section class="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div class="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 class="text-base font-bold text-slate-900">Setoran Mengaji Terbaru</h3>
              <p class="text-xs text-slate-500">Menampilkan 8 catatan terakhir berdasarkan tanggal &amp; waktu input.</p>
            </div>
            <button
              type="button"
              id="dash-btn-all-jurnal"
              class="text-xs font-semibold text-emerald-700 hover:text-emerald-900 whitespace-nowrap"
            >
              Lihat Semua &rarr;
            </button>
          </div>

          ${
            latestEight.length === 0
              ? `
            <div class="p-10 text-center">
              <p class="text-sm font-semibold text-slate-800">Belum ada setoran tercatat</p>
              <p class="text-xs text-slate-500 mt-1">Klik tombol "+ Catat Jurnal Mengaji" untuk menambahkan jurnal harian pertama.</p>
            </div>
          `
              : `
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th class="py-3 px-4">Tanggal</th>
                    <th class="py-3 px-3">Siswa &amp; Kelas</th>
                    <th class="py-3 px-3">Kehadiran</th>
                    <th class="py-3 px-3">Bacaan / Binadzor</th>
                    <th class="py-3 px-4">Hafalan / Tahfidz</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-sm">
                  ${latestEight
                    .map((j) => {
                      const std = studentMap.get(String(j.siswa_id));
                      return `
                        <tr class="hover:bg-slate-50/70">
                          <td class="py-3 px-4 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                            ${escapeHtml(formatTanggalID(j.tanggal))}
                          </td>
                          <td class="py-3 px-3">
                            <div class="font-semibold text-slate-900">${escapeHtml(std?.nama || `Siswa #${j.siswa_id}`)}</div>
                            <div class="text-xs text-slate-500">Kelas ${escapeHtml(std?.kelas || '-')}</div>
                          </td>
                          <td class="py-3 px-3 text-xs whitespace-nowrap ${getKehadiranTextClass(j.kehadiran)}">
                            ${escapeHtml(j.kehadiran || '-')}
                          </td>
                          <td class="py-3 px-3">
                            <div class="text-xs font-medium text-slate-900">${escapeHtml(j.detail_bacaan || '-')}</div>
                            ${
                              j.nilai_bacaan
                                ? `<div class="text-xs ${getNilaiTextClass(j.nilai_bacaan)}">${escapeHtml(j.nilai_bacaan)}</div>`
                                : ''
                            }
                          </td>
                          <td class="py-3 px-4">
                            <div class="text-xs font-medium text-slate-900">
                              ${
                                j.nama_surat
                                  ? `${escapeHtml(j.nama_surat)}${j.ayat_hafalan ? ` (${escapeHtml(j.ayat_hafalan)})` : ''}`
                                  : '-'
                              }
                            </div>
                            ${
                              j.nilai_hafalan
                                ? `<div class="text-xs ${getNilaiTextClass(j.nilai_hafalan)}">${escapeHtml(j.nilai_hafalan)}</div>`
                                : ''
                            }
                          </td>
                        </tr>
                      `;
                    })
                    .join('')}
                </tbody>
              </table>
            </div>
          `
          }
        </section>
      </div>
    `;

    container.querySelector('#dash-btn-add-kelas')?.addEventListener('click', () => onNavigate('kelas'));
    container.querySelector('#dash-link-kelas')?.addEventListener('click', () => onNavigate('kelas'));
    container.querySelector('#dash-link-siswa')?.addEventListener('click', () => onNavigate('siswa'));
    container.querySelector('#dash-btn-input-jurnal')?.addEventListener('click', () => onNavigate('jurnal'));
    container.querySelector('#dash-btn-all-jurnal')?.addEventListener('click', () => onNavigate('jurnal'));
  } catch (err) {
    container.innerHTML = `
      <div class="bg-white border border-red-200 rounded-xl p-6 text-sm text-red-700">
        <p class="font-semibold">Gagal Memuat Ringkasan</p>
        <p class="mt-1">${escapeHtml(err?.message || 'Terjadi kesalahan koneksi.')}</p>
      </div>
    `;
  }
}
