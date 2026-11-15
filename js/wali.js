/**
 * js/wali.js
 * Tampilan Portal Wali Murid / Orang Tua (Read-Only) untuk memantau perkembangan mengaji ananda.
 */

import { escapeHtml, formatTanggalID } from './config.js';
import { fetchAccessibleStudents } from './siswa.js';
import {
  fetchAccessibleJournals,
  getNilaiTextClass,
  getKehadiranTextClass,
} from './jurnal.js';

/**
 * Merender halaman Jurnal Ananda (Read-Only) untuk Wali Murid.
 * @param {HTMLElement} container
 * @param {object} session
 */
export async function renderWaliView(container, session) {
  let student = session.student;
  let journals = [];
  let loading = true;
  let loadError = '';
  let filterSearch = '';

  async function loadWaliData() {
    loading = true;
    loadError = '';
    render();

    try {
      const freshStudents = await fetchAccessibleStudents(session);
      if (freshStudents.length > 0) {
        student = freshStudents[0];
      }
      journals = await fetchAccessibleJournals(session, [student]);
    } catch (err) {
      loadError = err?.message || 'Gagal memuat riwayat mengaji ananda.';
    } finally {
      loading = false;
      render();
    }
  }

  function render() {
    if (loading) {
      container.innerHTML = `
        <div class="space-y-4">
          <div class="h-28 bg-white border border-slate-200 rounded-xl animate-pulse"></div>
          <div class="h-64 bg-white border border-slate-200 rounded-xl animate-pulse"></div>
        </div>
      `;
      return;
    }

    if (loadError) {
      container.innerHTML = `
        <div class="bg-white border border-red-200 rounded-xl p-6 text-sm text-red-700">
          <p class="font-semibold">Gagal Memuat Data</p>
          <p class="mt-1">${escapeHtml(loadError)}</p>
        </div>
      `;
      return;
    }

    const totalSetoran = journals.length;
    const totalHadir = journals.filter((j) => j.kehadiran === 'Hadir').length;
    const latestBacaan = journals.find((j) => j.detail_bacaan);
    const latestHafalan = journals.find((j) => j.nama_surat);

    const filtered = journals.filter((j) => {
      const q = filterSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        String(j.detail_bacaan || '').toLowerCase().includes(q) ||
        String(j.nama_surat || '').toLowerCase().includes(q) ||
        String(j.catatan_guru || '').toLowerCase().includes(q) ||
        String(j.tanggal || '').toLowerCase().includes(q)
      );
    });

    const isTuntasBaseline =
      student?.juz30_tuntas_baseline === true ||
      student?.juz30_tuntas_baseline === 'true' ||
      student?.juz30_tuntas_baseline === 'Tuntas';

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Profil Ananda -->
        <section class="bg-white border border-slate-200 rounded-xl p-6">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p class="text-xs font-semibold text-emerald-700">Pantauan Orang Tua / Wali Murid (Read-Only)</p>
              <h2 class="text-2xl font-bold text-slate-900 mt-1">${escapeHtml(student?.nama || '-')}</h2>
              <div class="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-slate-600">
                <span class="font-mono tabular-nums">NISN ${escapeHtml(student?.nisn || '-')}</span>
                <span aria-hidden="true">·</span>
                <span>Kelas <strong class="text-slate-900">${escapeHtml(student?.kelas || '-')}</strong></span>
                <span aria-hidden="true">·</span>
                <span>Guru Pembimbing: <strong class="text-slate-900">${escapeHtml(student?.guru_pembimbing || '-')}</strong></span>
              </div>
            </div>

            <div class="flex flex-col sm:items-end gap-1 text-sm">
              <div class="text-slate-500 text-xs">Status Baseline Juz 30</div>
              <div class="font-semibold ${isTuntasBaseline ? 'text-emerald-700' : 'text-slate-800'}">
                ${isTuntasBaseline ? 'Sudah Tuntas Juz 30' : 'Dalam Proses Pembinaan'}
              </div>
              ${
                student?.nama_wali
                  ? `<div class="text-xs text-slate-500">Wali: ${escapeHtml(student.nama_wali)}</div>`
                  : ''
              }
            </div>
          </div>

          ${
            student?.catatan_semester
              ? `
            <div class="mt-4 pt-4 border-t border-slate-100 text-sm text-slate-700">
              <span class="font-semibold text-slate-900">Catatan Semester:</span> ${escapeHtml(student.catatan_semester)}
            </div>
          `
              : ''
          }
        </section>

        <!-- Ringkasan Capaian -->
        <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white border border-slate-200 rounded-xl p-4">
            <div class="text-xs font-medium text-slate-500">Total Catatan Jurnal</div>
            <div class="text-2xl font-bold text-slate-900 tabular-nums mt-1">${totalSetoran}</div>
          </div>
          <div class="bg-white border border-slate-200 rounded-xl p-4">
            <div class="text-xs font-medium text-slate-500">Kehadiran Mengaji</div>
            <div class="text-2xl font-bold text-emerald-700 tabular-nums mt-1">${totalHadir} <span class="text-sm font-normal text-slate-500">sesi</span></div>
          </div>
          <div class="bg-white border border-slate-200 rounded-xl p-4">
            <div class="text-xs font-medium text-slate-500">Bacaan Terakhir</div>
            <div class="text-sm font-bold text-slate-900 mt-1.5 truncate">${escapeHtml(latestBacaan?.detail_bacaan || 'Belum ada')}</div>
            <div class="text-xs ${getNilaiTextClass(latestBacaan?.nilai_bacaan)} mt-0.5">${escapeHtml(latestBacaan?.nilai_bacaan || '-')}</div>
          </div>
          <div class="bg-white border border-slate-200 rounded-xl p-4">
            <div class="text-xs font-medium text-slate-500">Hafalan Terakhir</div>
            <div class="text-sm font-bold text-slate-900 mt-1.5 truncate">
              ${latestHafalan ? `${escapeHtml(latestHafalan.nama_surat)} ${latestHafalan.ayat_hafalan ? `(${escapeHtml(latestHafalan.ayat_hafalan)})` : ''}` : 'Belum ada'}
            </div>
            <div class="text-xs ${getNilaiTextClass(latestHafalan?.nilai_hafalan)} mt-0.5">${escapeHtml(latestHafalan?.nilai_hafalan || '-')}</div>
          </div>
        </section>

        <!-- Tabel Riwayat Jurnal Ananda -->
        <section class="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div class="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 class="text-base font-bold text-slate-900">Riwayat Jurnal Mengaji Ananda</h3>
              <p class="text-xs text-slate-500">Diurutkan dari setoran terbaru.</p>
            </div>
            <input
              id="wali-search"
              type="search"
              value="${escapeHtml(filterSearch)}"
              placeholder="Cari surat, jilid, atau catatan..."
              class="w-full sm:w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
          </div>

          ${
            filtered.length === 0
              ? `
            <div class="p-10 text-center">
              <p class="text-sm font-semibold text-slate-800">Belum ada catatan jurnal mengaji</p>
              <p class="text-xs text-slate-500 mt-1">Catatan harian akan tampil di sini setelah guru pembimbing menginput setoran ananda.</p>
            </div>
          `
              : `
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th class="py-3 px-4">Tanggal</th>
                    <th class="py-3 px-3">Kehadiran</th>
                    <th class="py-3 px-3">Bacaan / Binadzor</th>
                    <th class="py-3 px-3">Hafalan / Tahfidz</th>
                    <th class="py-3 px-4">Catatan Guru</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-sm">
                  ${filtered
                    .map(
                      (j) => `
                      <tr class="hover:bg-slate-50/70">
                        <td class="py-3 px-4 font-mono tabular-nums text-xs text-slate-700 whitespace-nowrap">
                          ${escapeHtml(formatTanggalID(j.tanggal))}
                        </td>
                        <td class="py-3 px-3 whitespace-nowrap text-xs ${getKehadiranTextClass(j.kehadiran)}">
                          ${escapeHtml(j.kehadiran || '-')}
                        </td>
                        <td class="py-3 px-3">
                          <div class="font-medium text-slate-900">${escapeHtml(j.detail_bacaan || '-')}</div>
                          ${
                            j.nilai_bacaan
                              ? `<div class="text-xs ${getNilaiTextClass(j.nilai_bacaan)}">${escapeHtml(j.nilai_bacaan)}</div>`
                              : ''
                          }
                        </td>
                        <td class="py-3 px-3">
                          <div class="font-medium text-slate-900">
                            ${
                              j.nama_surat
                                ? `${escapeHtml(j.nama_surat)}${j.ayat_hafalan ? ` · Ayat ${escapeHtml(j.ayat_hafalan)}` : ''}`
                                : '-'
                            }
                          </div>
                          ${
                            j.nilai_hafalan
                              ? `<div class="text-xs ${getNilaiTextClass(j.nilai_hafalan)}">${escapeHtml(j.nilai_hafalan)}</div>`
                              : ''
                          }
                        </td>
                        <td class="py-3 px-4 text-xs text-slate-600 max-w-xs">
                          ${escapeHtml(j.catatan_guru || '-')}
                        </td>
                      </tr>
                    `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          `
          }
        </section>
      </div>
    `;

    const searchInput = container.querySelector('#wali-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        filterSearch = e.target.value;
        const pos = e.target.selectionStart;
        render();
        const nextInput = container.querySelector('#wali-search');
        if (nextInput) {
          nextInput.focus();
          nextInput.setSelectionRange(pos, pos);
        }
      });
    }
  }

  await loadWaliData();
}
