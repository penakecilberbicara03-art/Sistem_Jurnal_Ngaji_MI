/**
 * js/guru.js
 * Fitur CRUD Akun Guru & Admin serta penugasan kelas (tabel `roodoh_users`).
 * Khusus diakses oleh Admin.
 */

import { getSupabaseClient, escapeHtml } from './config.js';
import { isAdmin } from './auth.js';
import { fetchAccessibleClasses } from './kelas.js';
import { showToast, showConfirmModal } from './ui.js';

/**
 * Merender halaman manajemen Guru & Akun Pengguna (Admin Only).
 * @param {HTMLElement} container
 * @param {object} session
 */
export async function renderGuruView(container, session) {
  if (!isAdmin(session)) {
    container.innerHTML = `
      <div class="bg-white border border-red-200 rounded-xl p-6 text-sm text-red-700">
        Halaman ini hanya dapat diakses oleh Admin.
      </div>
    `;
    return;
  }

  let users = [];
  let classes = [];
  let loading = true;
  let loadError = '';
  let editingUser = null;

  container.innerHTML = `
    <div class="space-y-6">
      <div class="border-b border-slate-200 pb-4">
        <h2 class="text-xl font-bold text-slate-900">Guru &amp; Akun Pengguna</h2>
        <p class="text-sm text-slate-600 mt-0.5">
          Kelola akun Admin dan Guru Pembimbing serta atur kelas binaan masing-masing guru.
        </p>
      </div>
      <div id="guru-content"></div>
    </div>
  `;

  const contentEl = container.querySelector('#guru-content');

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
      const [clsList, usrRes] = await Promise.all([
        fetchAccessibleClasses(session),
        supabase
          .from('roodoh_users')
          .select('id, username, password, role, nama, jabatan, assigned_classes, created_at')
          .order('role', { ascending: true })
          .order('nama', { ascending: true }),
      ]);
      if (usrRes.error) throw new Error(usrRes.error.message);
      classes = clsList;
      users = usrRes.data || [];
    } catch (err) {
      loadError = err?.message || 'Gagal memuat data akun pengguna.';
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
          <p class="font-semibold">Gagal Memuat Akun</p>
          <p class="mt-1">${escapeHtml(loadError)}</p>
        </div>
      `;
      return;
    }

    const isEditing = Boolean(editingUser);
    const currentAssigned = Array.isArray(editingUser?.assigned_classes)
      ? editingUser.assigned_classes
      : [];
    const availableClassNames = classes.map((c) => c.nama);

    contentEl.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div class="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-bold text-slate-900">
              ${isEditing ? 'Edit Akun Pengguna' : 'Tambah Akun Guru / Admin'}
            </h3>
            ${
              isEditing
                ? `<button type="button" id="btn-cancel-edit-user" class="text-xs font-medium text-slate-500 hover:text-slate-800">Batal Edit</button>`
                : ''
            }
          </div>

          <form id="form-user" class="space-y-3.5">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="usr-username" class="block text-xs font-medium text-slate-700 mb-1">Username</label>
                <input
                  id="usr-username"
                  type="text"
                  required
                  value="${escapeHtml(editingUser?.username || '')}"
                  placeholder="Contoh: ustadz_ahmad"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>
              <div>
                <label for="usr-password" class="block text-xs font-medium text-slate-700 mb-1">Password</label>
                <input
                  id="usr-password"
                  type="text"
                  required
                  value="${escapeHtml(editingUser?.password || '')}"
                  placeholder="Password login"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>
            </div>

            <div>
              <label for="usr-nama" class="block text-xs font-medium text-slate-700 mb-1">Nama Lengkap</label>
              <input
                id="usr-nama"
                type="text"
                required
                value="${escapeHtml(editingUser?.nama || '')}"
                placeholder="Nama ustadz / admin"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="usr-role" class="block text-xs font-medium text-slate-700 mb-1">Role</label>
                <select
                  id="usr-role"
                  required
                  class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                >
                  <option value="guru" ${editingUser?.role !== 'admin' ? 'selected' : ''}>Guru</option>
                  <option value="admin" ${editingUser?.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
              </div>
              <div>
                <label for="usr-jabatan" class="block text-xs font-medium text-slate-700 mb-1">Jabatan</label>
                <input
                  id="usr-jabatan"
                  type="text"
                  value="${escapeHtml(editingUser?.jabatan || '')}"
                  placeholder="Wali Kelas / Koord."
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>
            </div>

            <div>
              <span class="block text-xs font-medium text-slate-700 mb-1.5">Penugasan Kelas (khusus Guru)</span>
              ${
                availableClassNames.length === 0
                  ? `<p class="text-xs text-slate-500">Tambahkan data kelas terlebih dahulu di menu Data Kelas agar dapat dipilih di sini.</p>`
                  : `
                <div class="grid grid-cols-3 gap-2 max-h-36 overflow-y-auto p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                  ${availableClassNames
                    .map(
                      (cls) => `
                      <label class="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          name="assigned_class"
                          value="${escapeHtml(cls)}"
                          ${currentAssigned.includes(cls) ? 'checked' : ''}
                          class="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                        />
                        <span>${escapeHtml(cls)}</span>
                      </label>
                    `
                    )
                    .join('')}
                </div>
              `
              }
            </div>

            <button
              type="submit"
              id="btn-save-user"
              class="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 transition-colors disabled:opacity-60"
            >
              ${isEditing ? 'Simpan Perubahan Akun' : 'Tambah Akun'}
            </button>
          </form>
        </div>

        <div class="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div class="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 class="text-sm font-bold text-slate-900">Daftar Admin &amp; Guru Pembimbing</h3>
            <span class="text-xs text-slate-500 tabular-nums">${users.length} akun</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th class="py-3 px-4">Nama &amp; Username</th>
                  <th class="py-3 px-3">Role &amp; Jabatan</th>
                  <th class="py-3 px-3">Kelas Binaan</th>
                  <th class="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-sm">
                ${users
                  .map((u) => {
                    const clsArr = Array.isArray(u.assigned_classes) ? u.assigned_classes : [];
                    return `
                      <tr class="hover:bg-slate-50/70 transition-colors">
                        <td class="py-3 px-4">
                          <div class="font-semibold text-slate-900">${escapeHtml(u.nama)}</div>
                          <div class="text-xs text-slate-500 font-mono mt-0.5">@${escapeHtml(u.username)}</div>
                        </td>
                        <td class="py-3 px-3">
                          <div class="text-xs font-semibold ${u.role === 'admin' ? 'text-emerald-700' : 'text-slate-800'} uppercase">${escapeHtml(u.role)}</div>
                          <div class="text-xs text-slate-500">${escapeHtml(u.jabatan || '-')}</div>
                        </td>
                        <td class="py-3 px-3 text-xs text-slate-700">
                          ${u.role === 'admin' ? '<span class="text-emerald-700 font-medium">Semua Kelas</span>' : escapeHtml(clsArr.join(', ') || 'Belum diatur')}
                        </td>
                        <td class="py-3 px-4 text-right whitespace-nowrap">
                          <button type="button" data-edit-user="${escapeHtml(u.id)}" class="text-xs font-semibold text-emerald-700 hover:text-emerald-900 mr-3">Edit</button>
                          <button type="button" data-delete-user="${escapeHtml(u.id)}" class="text-xs font-semibold text-red-600 hover:text-red-800">Hapus</button>
                        </td>
                      </tr>
                    `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    contentEl.querySelector('#btn-cancel-edit-user')?.addEventListener('click', () => {
      editingUser = null;
      render();
    });

    contentEl.querySelectorAll('[data-edit-user]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-edit-user');
        const found = users.find((item) => String(item.id) === String(id));
        if (found) {
          editingUser = found;
          render();
          contentEl.querySelector('#usr-username')?.focus();
        }
      });
    });

    contentEl.querySelectorAll('[data-delete-user]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-delete-user');
        const found = users.find((item) => String(item.id) === String(id));
        if (!found) return;
        if (String(found.id) === String(session.user?.id)) {
          showToast('Anda tidak dapat menghapus akun yang sedang aktif digunakan.', 'error');
          return;
        }
        showConfirmModal({
          title: 'Hapus Akun Pengguna',
          message: `Hapus akun "${found.nama}" (@${found.username})?`,
          confirmText: 'Ya, Hapus',
          onConfirm: async () => {
            const supabase = getSupabaseClient();
            const { error } = await supabase.from('roodoh_users').delete().eq('id', found.id);
            if (error) {
              showToast(`Gagal menghapus akun: ${error.message}`, 'error');
              return;
            }
            if (editingUser && String(editingUser.id) === String(found.id)) {
              editingUser = null;
            }
            showToast('Akun pengguna berhasil dihapus.', 'success');
            await loadData();
          },
        });
      });
    });

    const formUser = contentEl.querySelector('#form-user');
    formUser?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = contentEl.querySelector('#btn-save-user');
      const role = contentEl.querySelector('#usr-role').value;
      const checkedClasses = Array.from(
        contentEl.querySelectorAll('input[name="assigned_class"]:checked')
      ).map((el) => el.value);

      const payload = {
        username: contentEl.querySelector('#usr-username').value.trim(),
        password: contentEl.querySelector('#usr-password').value,
        nama: contentEl.querySelector('#usr-nama').value.trim(),
        role,
        jabatan: contentEl.querySelector('#usr-jabatan').value.trim(),
        assigned_classes: role === 'admin' ? [] : checkedClasses,
      };

      saveBtn.disabled = true;
      saveBtn.textContent = 'Menyimpan...';

      try {
        const supabase = getSupabaseClient();
        if (editingUser) {
          const { error } = await supabase
            .from('roodoh_users')
            .update(payload)
            .eq('id', editingUser.id);
          if (error) throw error;
          editingUser = null;
          showToast('Akun pengguna berhasil diperbarui.', 'success');
        } else {
          const { error } = await supabase.from('roodoh_users').insert([payload]);
          if (error) throw error;
          showToast('Akun pengguna baru berhasil ditambahkan ke Supabase.', 'success');
        }
        await loadData();
      } catch (err) {
        showToast(`Gagal menyimpan akun: ${err.message}`, 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = editingUser ? 'Simpan Perubahan Akun' : 'Tambah Akun';
      }
    });
  }

  await loadData();
}
