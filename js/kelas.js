/**
 * js/kelas.js
 * Fitur CRUD Data Kelas (tabel `roodoh_classes`) di Supabase.
 */

import { getSupabaseClient, escapeHtml } from './config.js';
import { isAdmin, isGuru, getAssignedClasses } from './auth.js';
import { showToast, showConfirmModal } from './ui.js';

/**
 * Mengambil daftar kelas sesuai hak akses role.
 * @param {object} session
 * @returns {Promise<Array<object>>}
 */
export async function fetchAccessibleClasses(session) {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  if (isAdmin(session)) {
    const { data, error } = await supabase
      .from('roodoh_classes')
      .select('*')
      .order('tingkat', { ascending: true })
      .order('nama', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  }

  if (isGuru(session)) {
    const assigned = getAssignedClasses(session);
    if (assigned.length === 0) return [];
    const { data, error } = await supabase
      .from('roodoh_classes')
      .select('*')
      .in('nama', assigned)
      .order('tingkat', { ascending: true })
      .order('nama', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  }

  return [];
}

/**
 * Merender halaman manajemen Data Kelas.
 * @param {HTMLElement} container
 * @param {object} session
 */
export async function renderKelasView(container, session) {
  const admin = isAdmin(session);
  const assignedClasses = getAssignedClasses(session);

  let classes = [];
  let students = [];
  let loading = true;
  let loadError = '';
  let editingClass = null;

  container.innerHTML = `
    <div class="space-y-6">
      <div class="border-b border-slate-200 pb-4">
        <h2 class="text-xl font-bold text-slate-900">Data Kelas</h2>
        <p class="text-sm text-slate-600 mt-0.5">
          ${
            admin
              ? 'Kelola daftar kelas / rombongan belajar Madrasah Ibtidaiyah (MI) di Supabase.'
              : `Daftar kelas binaan Anda (${escapeHtml(assignedClasses.join(', ') || 'Belum ada kelas')}).`
          }
        </p>
      </div>
      <div id="kelas-content"></div>
    </div>
  `;

  const contentEl = container.querySelector('#kelas-content');

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
      classes = await fetchAccessibleClasses(session);
      const { data: stdData, error: stdErr } = await supabase
        .from('roodoh_students')
        .select('id, kelas');
      if (stdErr) throw new Error(stdErr.message);
      students = stdData || [];
    } catch (err) {
      loadError = err?.message || 'Gagal memuat data kelas.';
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
        </div>
      `;
      return;
    }

    if (loadError) {
      contentEl.innerHTML = `
        <div class="bg-white border border-red-200 rounded-xl p-6 text-sm text-red-700">
          <p class="font-semibold">Gagal Memuat Data Kelas</p>
          <p class="mt-1">${escapeHtml(loadError)}</p>
        </div>
      `;
      return;
    }

    const isEditing = Boolean(editingClass);

    contentEl.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        ${
          admin
            ? `
          <div class="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-base font-bold text-slate-900">
                ${isEditing ? 'Edit Data Kelas' : 'Tambah Kelas Baru'}
              </h3>
              ${
                isEditing
                  ? `<button type="button" id="btn-cancel-edit-class" class="text-xs font-medium text-slate-500 hover:text-slate-800">Batal Edit</button>`
                  : ''
              }
            </div>

            <form id="form-class" class="space-y-3.5">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="cls-nama" class="block text-xs font-medium text-slate-700 mb-1">Nama Kelas</label>
                  <input
                    id="cls-nama"
                    type="text"
                    required
                    value="${escapeHtml(editingClass?.nama || '')}"
                    placeholder="Contoh: 1A"
                    class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>
                <div>
                  <label for="cls-tingkat" class="block text-xs font-medium text-slate-700 mb-1">Tingkat (MI 1–6)</label>
                  <select
                    id="cls-tingkat"
                    required
                    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  >
                    ${[1, 2, 3, 4, 5, 6]
                      .map(
                        (t) =>
                          `<option value="${t}" ${Number(editingClass?.tingkat) === t ? 'selected' : ''}>Kelas ${t}</option>`
                      )
                      .join('')}
                  </select>
                </div>
              </div>

              <div>
                <label for="cls-guru" class="block text-xs font-medium text-slate-700 mb-1">Guru Pembimbing Ngaji</label>
                <input
                  id="cls-guru"
                  type="text"
                  value="${escapeHtml(editingClass?.guru_pembimbing || '')}"
                  placeholder="Nama guru pembimbing"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div>
                <label for="cls-wali" class="block text-xs font-medium text-slate-700 mb-1">Wali Kelas</label>
                <input
                  id="cls-wali"
                  type="text"
                  value="${escapeHtml(editingClass?.wali_kelas || '')}"
                  placeholder="Nama wali kelas"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <button
                type="submit"
                id="btn-save-class"
                class="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 transition-colors disabled:opacity-60"
              >
                ${isEditing ? 'Simpan Perubahan' : 'Tambah Kelas'}
              </button>
            </form>
          </div>
        `
            : ''
        }

        <div class="${admin ? 'lg:col-span-8' : 'lg:col-span-12'} bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div class="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 class="text-sm font-bold text-slate-900">Daftar Rombongan Belajar</h3>
            <span class="text-xs text-slate-500 tabular-nums">${classes.length} kelas</span>
          </div>

          ${
            classes.length === 0
              ? `
            <div class="p-10 text-center">
              <p class="text-sm font-semibold text-slate-800">Belum ada data kelas</p>
              <p class="text-xs text-slate-500 mt-1">
                ${admin ? 'Tambahkan kelas pertama seperti 1A, 1B, dst. menggunakan formulir di samping.' : 'Belum ada kelas yang ditugaskan kepada akun Anda.'}
              </p>
            </div>
          `
              : `
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th class="py-3 px-4">Kelas</th>
                    <th class="py-3 px-3">Tingkat</th>
                    <th class="py-3 px-3">Guru Pembimbing</th>
                    <th class="py-3 px-3">Wali Kelas</th>
                    <th class="py-3 px-3 text-right">Jumlah Siswa</th>
                    ${admin ? '<th class="py-3 px-4 text-right">Aksi</th>' : ''}
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-sm">
                  ${classes
                    .map((c) => {
                      const count = students.filter((s) => s.kelas === c.nama).length;
                      return `
                        <tr class="hover:bg-slate-50/70 transition-colors">
                          <td class="py-3 px-4 font-bold text-slate-900">${escapeHtml(c.nama)}</td>
                          <td class="py-3 px-3 text-slate-600 tabular-nums">Tingkat ${escapeHtml(c.tingkat)}</td>
                          <td class="py-3 px-3 text-slate-700">${escapeHtml(c.guru_pembimbing || '-')}</td>
                          <td class="py-3 px-3 text-slate-700">${escapeHtml(c.wali_kelas || '-')}</td>
                          <td class="py-3 px-3 text-right font-mono tabular-nums text-slate-800">${count}</td>
                          ${
                            admin
                              ? `
                            <td class="py-3 px-4 text-right whitespace-nowrap">
                              <button type="button" data-edit-class="${escapeHtml(c.id)}" class="text-xs font-semibold text-emerald-700 hover:text-emerald-900 mr-3">Edit</button>
                              <button type="button" data-delete-class="${escapeHtml(c.id)}" class="text-xs font-semibold text-red-600 hover:text-red-800">Hapus</button>
                            </td>
                          `
                              : ''
                          }
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

    if (!admin) return;

    contentEl.querySelector('#btn-cancel-edit-class')?.addEventListener('click', () => {
      editingClass = null;
      render();
    });

    contentEl.querySelectorAll('[data-edit-class]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-edit-class');
        const found = classes.find((item) => String(item.id) === String(id));
        if (found) {
          editingClass = found;
          render();
          contentEl.querySelector('#cls-nama')?.focus();
        }
      });
    });

    contentEl.querySelectorAll('[data-delete-class]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-delete-class');
        const found = classes.find((item) => String(item.id) === String(id));
        if (!found) return;
        showConfirmModal({
          title: 'Hapus Kelas',
          message: `Hapus kelas "${found.nama}" dari daftar rombongan belajar?`,
          confirmText: 'Ya, Hapus',
          onConfirm: async () => {
            const supabase = getSupabaseClient();
            const { error } = await supabase.from('roodoh_classes').delete().eq('id', found.id);
            if (error) {
              showToast(`Gagal menghapus kelas: ${error.message}`, 'error');
              return;
            }
            if (editingClass && String(editingClass.id) === String(found.id)) {
              editingClass = null;
            }
            showToast('Kelas berhasil dihapus.', 'success');
            await loadData();
          },
        });
      });
    });

    const formClass = contentEl.querySelector('#form-class');
    formClass?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = contentEl.querySelector('#btn-save-class');
      const payload = {
        nama: contentEl.querySelector('#cls-nama').value.trim(),
        tingkat: parseInt(contentEl.querySelector('#cls-tingkat').value, 10) || 1,
        guru_pembimbing: contentEl.querySelector('#cls-guru').value.trim(),
        wali_kelas: contentEl.querySelector('#cls-wali').value.trim(),
      };

      saveBtn.disabled = true;
      saveBtn.textContent = 'Menyimpan...';

      try {
        const supabase = getSupabaseClient();
        if (editingClass) {
          const { error } = await supabase
            .from('roodoh_classes')
            .update(payload)
            .eq('id', editingClass.id);
          if (error) throw error;
          editingClass = null;
          showToast('Data kelas berhasil diperbarui.', 'success');
        } else {
          const { error } = await supabase.from('roodoh_classes').insert([payload]);
          if (error) throw error;
          showToast('Kelas baru berhasil ditambahkan ke Supabase.', 'success');
        }
        await loadData();
      } catch (err) {
        showToast(`Gagal menyimpan kelas: ${err.message}`, 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = editingClass ? 'Simpan Perubahan' : 'Tambah Kelas';
      }
    });
  }

  await loadData();
}
