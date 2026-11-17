/**
 * js/siswa.js
 * Fitur CRUD Data Siswa (tabel `roodoh_students`) di Supabase.
 */

import { getSupabaseClient, escapeHtml } from './config.js';
import { isAdmin, isGuru, getAssignedClasses, canAccessClass } from './auth.js';
import { fetchAccessibleClasses } from './kelas.js';
import { showToast, showConfirmModal } from './ui.js';

/**
 * Mengambil daftar siswa sesuai hak akses role.
 * @param {object} session
 * @returns {Promise<Array<object>>}
 */
export async function fetchAccessibleStudents(session) {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  if (isAdmin(session)) {
    const { data, error } = await supabase
      .from('roodoh_students')
      .select('*')
      .order('kelas', { ascending: true })
      .order('nama', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  }

  if (isGuru(session)) {
    const assigned = getAssignedClasses(session);
    if (assigned.length === 0) return [];
    const { data, error } = await supabase
      .from('roodoh_students')
      .select('*')
      .in('kelas', assigned)
      .order('kelas', { ascending: true })
      .order('nama', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  }

  if (session?.role === 'wali' && session.student?.id) {
    const { data, error } = await supabase
      .from('roodoh_students')
      .select('*')
      .eq('id', session.student.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? [data] : [];
  }

  return [];
}

function formatBaseline(val) {
  if (val === true || val === 'true' || val === 'Tuntas' || val === 1) {
    return { label: 'Tuntas', isDone: true };
  }
  return { label: 'Belum Tuntas', isDone: false };
}

/**
 * Merender halaman manajemen Data Siswa.
 * @param {HTMLElement} container
 * @param {object} session
 * @param {(route: string) => void} [onNavigate]
 */
export async function renderSiswaView(container, session, onNavigate) {
  const admin = isAdmin(session);
  const assignedClasses = getAssignedClasses(session);

  let students = [];
  let classes = [];
  let loading = true;
  let loadError = '';

  let searchQuery = '';
  let filterKelas = 'all';
  let editingStudent = null;

  container.innerHTML = `
    <div class="space-y-6">
      <div class="border-b border-slate-200 pb-4">
        <h2 class="text-xl font-bold text-slate-900">Data Siswa</h2>
        <p class="text-sm text-slate-600 mt-0.5">
          ${
            admin
              ? 'Kelola seluruh data siswa Madrasah Ibtidaiyah (MI) yang terhubung ke Supabase.'
              : `Kelola data siswa untuk kelas binaan Anda (${escapeHtml(assignedClasses.join(', ') || 'Belum ada kelas')}).`
          }
        </p>
      </div>
      <div id="siswa-content"></div>
    </div>
  `;

  const contentEl = container.querySelector('#siswa-content');

  async function loadData() {
    loading = true;
    loadError = '';
    render();

    const supabase = getSupabaseClient();
    if (!supabase) {
      loading = false;
      loadError = 'Koneksi Supabase belum dikonfigurasi pada file js/config.js.';
      render();
      return;
    }

    try {
      const [clsList, stdList] = await Promise.all([
        fetchAccessibleClasses(session),
        fetchAccessibleStudents(session),
      ]);
      classes = clsList;
      students = stdList;
    } catch (err) {
      loadError = err?.message || 'Gagal memuat data siswa dari Supabase.';
    } finally {
      loading = false;
      render();
    }
  }

  function render() {
    if (loading) {
      contentEl.innerHTML = `
        <div class="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <div class="h-5 w-48 bg-slate-100 rounded animate-pulse"></div>
          <div class="h-10 w-full bg-slate-100 rounded animate-pulse"></div>
          <div class="h-10 w-full bg-slate-100 rounded animate-pulse"></div>
          <div class="h-10 w-full bg-slate-100 rounded animate-pulse"></div>
        </div>
      `;
      return;
    }

    if (loadError) {
      contentEl.innerHTML = `
        <div class="bg-white border border-red-200 rounded-xl p-6 text-sm text-red-700">
          <p class="font-semibold">Gagal Memuat Data Siswa</p>
          <p class="mt-1">${escapeHtml(loadError)}</p>
        </div>
      `;
      return;
    }

    const availableClassNames = admin
      ? Array.from(new Set([...classes.map((c) => c.nama), ...students.map((s) => s.kelas)].filter(Boolean))).sort()
      : assignedClasses;

    const filteredStudents = students.filter((s) => {
      const matchClass = filterKelas === 'all' || s.kelas === filterKelas;
      const q = searchQuery.trim().toLowerCase();
      const matchQuery =
        !q ||
        String(s.nama || '').toLowerCase().includes(q) ||
        String(s.nisn || '').toLowerCase().includes(q) ||
        String(s.nama_wali || '').toLowerCase().includes(q);
      return matchClass && matchQuery;
    });

    const isEditing = Boolean(editingStudent);
    const baselineChecked = editingStudent
      ? formatBaseline(editingStudent.juz30_tuntas_baseline).isDone
      : false;

    contentEl.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- Form Tambah / Edit Siswa -->
        <div class="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-bold text-slate-900">
              ${isEditing ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
            </h3>
            ${
              isEditing
                ? `<button type="button" id="btn-cancel-edit-student" class="text-xs font-medium text-slate-500 hover:text-slate-800">Batal Edit</button>`
                : ''
            }
          </div>

          ${
            !admin && availableClassNames.length === 0
              ? `
            <div class="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-800">
              Anda belum memiliki kelas binaan pada <code class="font-mono text-xs">assigned_classes</code>. Hubungi Admin untuk penugasan kelas.
            </div>
          `
              : `
            <form id="form-student" class="space-y-3.5">
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
                <div>
                  <label for="std-nisn" class="block text-xs font-medium text-slate-700 mb-1">NISN</label>
                  <input
                    id="std-nisn"
                    type="text"
                    required
                    value="${escapeHtml(editingStudent?.nisn || '')}"
                    placeholder="Contoh: 0134567890"
                    class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <label for="std-kelas" class="block text-xs font-medium text-slate-700">Kelas</label>
                    ${
                      admin && onNavigate
                        ? `<button type="button" id="btn-quick-add-class" class="text-xs font-semibold text-emerald-700 hover:text-emerald-900">+ Tambah Kelas</button>`
                        : ''
                    }
                  </div>
                  <select
                    id="std-kelas"
                    required
                    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  >
                    <option value="">Pilih Kelas</option>
                    ${availableClassNames
                      .map(
                        (cls) =>
                          `<option value="${escapeHtml(cls)}" ${editingStudent?.kelas === cls ? 'selected' : ''}>${escapeHtml(cls)}</option>`
                      )
                      .join('')}
                  </select>
                </div>
              </div>
              ${
                admin && availableClassNames.length === 0 && onNavigate
                  ? `
                <div class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-center justify-between gap-2">
                  <span>Belum ada kelas di database. Buat kelas dulu (misal: 1A).</span>
                  <button type="button" id="btn-empty-create-class" class="shrink-0 font-semibold text-emerald-800 underline hover:text-emerald-950">
                    Buat Kelas
                  </button>
                </div>
              `
                  : ''
              }

              <div>
                <label for="std-nama" class="block text-xs font-medium text-slate-700 mb-1">Nama Lengkap Siswa</label>
                <input
                  id="std-nama"
                  type="text"
                  required
                  value="${escapeHtml(editingStudent?.nama || '')}"
                  placeholder="Nama lengkap sesuai absen"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
                <div>
                  <label for="std-jk" class="block text-xs font-medium text-slate-700 mb-1">Jenis Kelamin</label>
                  <select
                    id="std-jk"
                    required
                    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  >
                    <option value="L" ${editingStudent?.jenis_kelamin === 'L' || editingStudent?.jenis_kelamin === 'Laki-laki' ? 'selected' : ''}>Laki-laki (L)</option>
                    <option value="P" ${editingStudent?.jenis_kelamin === 'P' || editingStudent?.jenis_kelamin === 'Perempuan' ? 'selected' : ''}>Perempuan (P)</option>
                  </select>
                </div>
                <div>
                  <label for="std-guru" class="block text-xs font-medium text-slate-700 mb-1">Guru Pembimbing</label>
                  <input
                    id="std-guru"
                    type="text"
                    value="${escapeHtml(editingStudent?.guru_pembimbing || (!isEditing && !admin ? session.user?.nama || '' : ''))}"
                    placeholder="Nama ustadz/ustadzah"
                    class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>
              </div>

              <div>
                <label for="std-wali" class="block text-xs font-medium text-slate-700 mb-1">Nama Wali Murid</label>
                <input
                  id="std-wali"
                  type="text"
                  value="${escapeHtml(editingStudent?.nama_wali || '')}"
                  placeholder="Nama orang tua / wali"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <label class="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
                <input
                  id="std-juz30"
                  type="checkbox"
                  ${baselineChecked ? 'checked' : ''}
                  class="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                />
                <span class="text-sm text-slate-700 leading-snug">
                  Baseline Juz 30 Tuntas
                  <span class="block text-xs text-slate-500">Tandai jika siswa sudah menuntaskan hafalan Juz Amma sebelumnya.</span>
                </span>
              </label>

              <div>
                <label for="std-catatan" class="block text-xs font-medium text-slate-700 mb-1">Catatan Semester</label>
                <textarea
                  id="std-catatan"
                  rows="2"
                  placeholder="Catatan perkembangan semester (opsional)"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                >${escapeHtml(editingStudent?.catatan_semester || '')}</textarea>
              </div>

              <button
                type="submit"
                id="btn-save-student"
                class="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 transition-colors disabled:opacity-60"
              >
                ${isEditing ? 'Simpan Perubahan' : 'Tambah Siswa'}
              </button>
            </form>
          `
          }
        </div>

        <!-- Tabel Daftar Siswa -->
        <div class="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div class="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-2 flex-1">
              <input
                id="search-student"
                type="search"
                value="${escapeHtml(searchQuery)}"
                placeholder="Cari nama, NISN, atau wali..."
                class="w-full sm:max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
              <select
                id="filter-student-class"
                class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              >
                <option value="all">Semua Kelas</option>
                ${availableClassNames
                  .map(
                    (cls) =>
                      `<option value="${escapeHtml(cls)}" ${filterKelas === cls ? 'selected' : ''}>Kelas ${escapeHtml(cls)}</option>`
                  )
                  .join('')}
              </select>
            </div>
            <div class="text-xs font-medium text-slate-500 tabular-nums whitespace-nowrap">
              ${filteredStudents.length} dari ${students.length} siswa
            </div>
          </div>

          ${
            filteredStudents.length === 0
              ? `
            <div class="p-10 text-center">
              <p class="text-sm font-semibold text-slate-800">Belum ada data siswa yang cocok</p>
              <p class="text-xs text-slate-500 mt-1">Tambahkan siswa baru melalui formulir di samping atau ubah kata kunci pencarian.</p>
            </div>
          `
              : `
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th class="py-3 px-4">Siswa &amp; NISN</th>
                    <th class="py-3 px-3">Kelas</th>
                    <th class="py-3 px-3">Pembimbing &amp; Wali</th>
                    <th class="py-3 px-3">Baseline Juz 30</th>
                    <th class="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-sm">
                  ${filteredStudents
                    .map((s) => {
                      const base = formatBaseline(s.juz30_tuntas_baseline);
                      return `
                        <tr class="hover:bg-slate-50/70 transition-colors">
                          <td class="py-3 px-4">
                            <div class="font-semibold text-slate-900">${escapeHtml(s.nama)}</div>
                            <div class="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                              NISN ${escapeHtml(s.nisn)} · ${escapeHtml(s.jenis_kelamin || '-')}
                            </div>
                          </td>
                          <td class="py-3 px-3 font-medium text-slate-800 whitespace-nowrap">
                            ${escapeHtml(s.kelas)}
                          </td>
                          <td class="py-3 px-3 text-xs text-slate-600">
                            <div>Guru: <span class="text-slate-800 font-medium">${escapeHtml(s.guru_pembimbing || '-')}</span></div>
                            <div class="mt-0.5">Wali: ${escapeHtml(s.nama_wali || '-')}</div>
                          </td>
                          <td class="py-3 px-3 whitespace-nowrap">
                            <span class="text-xs font-semibold ${base.isDone ? 'text-emerald-700' : 'text-slate-500'}">
                              ${base.label}
                            </span>
                          </td>
                          <td class="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              data-view-raport="${escapeHtml(s.id)}"
                              class="text-xs font-semibold text-blue-600 hover:text-blue-800 mr-3"
                            >
                              Rapot
                            </button>
                            <button
                              type="button"
                              data-edit-student="${escapeHtml(s.id)}"
                              class="text-xs font-semibold text-emerald-700 hover:text-emerald-900 mr-3"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              data-delete-student="${escapeHtml(s.id)}"
                              class="text-xs font-semibold text-red-600 hover:text-red-800"
                            >
                              Hapus
                            </button>
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
        </div>
      </div>
    `;

    const searchInput = contentEl.querySelector('#search-student');
    const filterSelect = contentEl.querySelector('#filter-student-class');
    const cancelBtn = contentEl.querySelector('#btn-cancel-edit-student');
    const formStudent = contentEl.querySelector('#form-student');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        const pos = e.target.selectionStart;
        render();
        const nextInput = contentEl.querySelector('#search-student');
        if (nextInput) {
          nextInput.focus();
          nextInput.setSelectionRange(pos, pos);
        }
      });
    }

    if (filterSelect) {
      filterSelect.addEventListener('change', (e) => {
        filterKelas = e.target.value;
        render();
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        editingStudent = null;
        render();
      });
    }

    if (onNavigate) {
      contentEl.querySelector('#btn-quick-add-class')?.addEventListener('click', () => onNavigate('kelas'));
      contentEl.querySelector('#btn-empty-create-class')?.addEventListener('click', () => onNavigate('kelas'));
    }

    // Event listener untuk tombol lihat rapot
    contentEl.querySelectorAll('[data-view-raport]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-view-raport');
        if (typeof renderRapotView === 'function') {
          renderRapotView('siswa-content', id);
        } else {
          showToast('Modul rapot belum dimuat.', 'error');
        }
      });
    });

    contentEl.querySelectorAll('[data-edit-student]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-edit-student');
        const found = students.find((item) => String(item.id) === String(id));
        if (found) {
          editingStudent = found;
          render();
          contentEl.querySelector('#std-nisn')?.focus();
        }
      });
    });

    contentEl.querySelectorAll('[data-delete-student]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-delete-student');
        const found = students.find((item) => String(item.id) === String(id));
        if (!found) return;
        if (!canAccessClass(session, found.kelas)) {
          showToast('Anda tidak memiliki izin menghapus siswa kelas ini.', 'error');
          return;
        }
        showConfirmModal({
          title: 'Hapus Data Siswa',
          message: `Hapus siswa "${found.nama}" (NISN ${found.nisn}) dari kelas ${found.kelas}? Riwayat jurnal terkait mungkin ikut terpengaruh.`,
          confirmText: 'Ya, Hapus',
          onConfirm: async () => {
            const supabase = getSupabaseClient();
            const { error } = await supabase.from('roodoh_students').delete().eq('id', found.id);
            if (error) {
              showToast(`Gagal menghapus siswa: ${error.message}`, 'error');
              return;
            }
            if (editingStudent && String(editingStudent.id) === String(found.id)) {
              editingStudent = null;
            }
            showToast('Data siswa berhasil dihapus.', 'success');
            await loadData();
          },
        });
      });
    });

    if (formStudent) {
      formStudent.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = contentEl.querySelector('#btn-save-student');
        const payload = {
          nisn: contentEl.querySelector('#std-nisn').value.trim(),
          kelas: contentEl.querySelector('#std-kelas').value.trim(),
          nama: contentEl.querySelector('#std-nama').value.trim(),
          jenis_kelamin: contentEl.querySelector('#std-jk').value,
          guru_pembimbing: contentEl.querySelector('#std-guru').value.trim(),
          nama_wali: contentEl.querySelector('#std-wali').value.trim(),
          juz30_tuntas_baseline: contentEl.querySelector('#std-juz30').checked,
          catatan_semester: contentEl.querySelector('#std-catatan').value.trim(),
        };

        if (!canAccessClass(session, payload.kelas)) {
          showToast('Anda tidak berhak menyimpan siswa di luar kelas binaan Anda.', 'error');
          return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Menyimpan...';

        try {
          const supabase = getSupabaseClient();
          if (editingStudent) {
            const { error } = await supabase
              .from('roodoh_students')
              .update(payload)
              .eq('id', editingStudent.id);
            if (error) throw error;
            editingStudent = null;
            showToast('Data siswa berhasil diperbarui.', 'success');
          } else {
            const { error } = await supabase.from('roodoh_students').insert([payload]);
            if (error) throw error;
            showToast('Siswa baru berhasil ditambahkan ke Supabase.', 'success');
          }
          await loadData();
        } catch (err) {
          showToast(`Gagal menyimpan siswa: ${err.message}`, 'error');
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = editingStudent ? 'Simpan Perubahan' : 'Tambah Siswa';
        }
      });
    }
  }

  await loadData();
}
