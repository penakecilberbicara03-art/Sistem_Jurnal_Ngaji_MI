/**
 * js/jurnal.js
 * Logika form input pencatatan jurnal mengaji harian & tampilan riwayat jurnal (jurnal_ngaji).
 * Mendukung 2 kategori:
 * - Kategori A (Bacaan / Binadzor): Iqro' (Jilid 1-6 & Halaman) dan Binadzor Al-Qur'an (Juz 1-30, Surat, Ayat)
 * - Kategori B (Hafalan / Tahfidz): Juz 30 (Juz Amma) & 5 Surat Pilihan (Al-Mulk, Al-Waqiah, Ar-Rahman, Yasin, Al-Kahfi)
 * Urutan riwayat selalu terbaru di atas: tanggal DESC, created_at DESC.
 */

import { getSupabaseClient, escapeHtml, formatTanggalID, getTodayISO } from './config.js';
import { isAdmin, isWali, getAssignedClasses } from './auth.js';
import { fetchAccessibleStudents } from './siswa.js';
import { showToast, showConfirmModal } from './ui.js';

export const PREDIKAT_NILAI = ['Mumtaz', 'Jayyid Jiddan', 'Jayyid', 'Cukup'];
export const KEHADIRAN_LIST = ['Hadir', 'Izin', 'Sakit', 'Alpha'];
export const LIMA_SURAT_PILIHAN = ['Al-Mulk', 'Al-Waqiah', 'Ar-Rahman', 'Yasin', 'Al-Kahfi'];

export const SURAT_JUZ_30 = [
  "An-Naba'", "An-Nazi'at", 'Abasa', 'At-Takwir', 'Al-Infitar', 'Al-Mutaffifin',
  'Al-Insyiqaq', 'Al-Buruj', 'At-Tariq', "Al-A'la", 'Al-Gasyiyah', 'Al-Fajr',
  'Al-Balad', 'Asy-Syams', 'Al-Lail', 'Ad-Duha', 'Al-Insyirah', 'At-Tin',
  "Al-'Alaq", 'Al-Qadr', 'Al-Bayyinah', 'Az-Zalzalah', "Al-'Adiyat", "Al-Qari'ah",
  'At-Takasur', "Al-'Asr", 'Al-Humazah', 'Al-Fil', 'Quraisy', "Al-Ma'un",
  'Al-Kausar', 'Al-Kafirun', 'An-Nasr', 'Al-Lahab', 'Al-Ikhlas', 'Al-Falaq', 'An-Nas',
];

export const ALL_SURAH_QURAN = [
  'Al-Fatihah', 'Al-Baqarah', 'Ali Imran', 'An-Nisa', "Al-Ma'idah", "Al-An'am",
  "Al-A'raf", 'Al-Anfal', 'At-Taubah', 'Yunus', 'Hud', 'Yusuf', "Ar-Ra'd", 'Ibrahim',
  'Al-Hijr', 'An-Nahl', 'Al-Isra', 'Al-Kahfi', 'Maryam', 'Taha', 'Al-Anbiya',
  'Al-Hajj', "Al-Mu'minun", 'An-Nur', 'Al-Furqan', "Asy-Syu'ara", 'An-Naml',
  'Al-Qasas', 'Al-Ankabut', 'Ar-Rum', 'Luqman', 'As-Sajdah', 'Al-Ahzab', "Saba'",
  'Fatir', 'Yasin', 'As-Saffat', 'Sad', 'Az-Zumar', 'Gafir', 'Fussilat',
  'Asy-Syura', 'Az-Zukhruf', 'Ad-Dukhan', 'Al-Jasiyah', 'Al-Ahqaf', 'Muhammad',
  'Al-Fath', 'Al-Hujurat', 'Qaf', 'Az-Zariyat', 'At-Tur', 'An-Najm', 'Al-Qamar',
  'Ar-Rahman', 'Al-Waqiah', 'Al-Hadid', 'Al-Mujadalah', 'Al-Hasyr', 'Al-Mumtahanah',
  'As-Saff', "Al-Jumu'ah", 'Al-Munafiqun', 'At-Tagabun', 'At-Talaq', 'At-Tahrim',
  'Al-Mulk', 'Al-Qalam', 'Al-Haqqah', "Al-Ma'arij", 'Nuh', 'Al-Jinn', 'Al-Muzzammil',
  'Al-Muddassir', 'Al-Qiyamah', 'Al-Insan', 'Al-Mursalat', ...SURAT_JUZ_30,
];

/**
 * Mengambil riwayat jurnal mengaji sesuai hak akses role.
 * Selalu diurutkan berdasarkan tanggal DESC, lalu created_at DESC.
 * @param {object} session
 * @param {Array<object>} accessibleStudents
 * @returns {Promise<Array<object>>}
 */
export async function fetchAccessibleJournals(session, accessibleStudents = []) {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  if (isWali(session)) {
    const sid = session.student?.id;
    if (!sid) return [];
    const { data, error } = await supabase
      .from('jurnal_ngaji')
      .select('*')
      .eq('siswa_id', sid)
      .order('tanggal', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  }

  if (isAdmin(session)) {
    const { data, error } = await supabase
      .from('jurnal_ngaji')
      .select('*')
      .order('tanggal', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return data || [];
  }

  // Guru: filter berdasarkan siswa yang berada di assigned_classes
  const studentIds = accessibleStudents.map((s) => s.id).filter((id) => id !== null && id !== undefined);
  if (studentIds.length === 0) return [];

  const { data, error } = await supabase
    .from('jurnal_ngaji')
    .select('*')
    .in('siswa_id', studentIds)
    .order('tanggal', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Membantu warna teks semantik untuk predikat nilai tanpa badge kapsul berlebihan.
 */
export function getNilaiTextClass(nilai) {
  switch (nilai) {
    case 'Mumtaz':
      return 'text-emerald-700 font-semibold';
    case 'Jayyid Jiddan':
      return 'text-teal-700 font-semibold';
    case 'Jayyid':
      return 'text-sky-700 font-semibold';
    case 'Cukup':
      return 'text-amber-700 font-semibold';
    default:
      return 'text-slate-400';
  }
}

export function getKehadiranTextClass(kehadiran) {
  switch (kehadiran) {
    case 'Hadir':
      return 'text-emerald-700 font-semibold';
    case 'Izin':
      return 'text-sky-700 font-semibold';
    case 'Sakit':
      return 'text-amber-700 font-semibold';
    case 'Alpha':
      return 'text-red-700 font-semibold';
    default:
      return 'text-slate-600';
  }
}

/**
 * Memecah string detail_bacaan kembali ke komponen form saat mode Edit.
 */
function parseDetailBacaan(jenis, detail) {
  const result = { jilid: '1', halaman: '', juz: '1', surat: 'Al-Fatihah', ayat: '' };
  if (!detail) return result;

  if (jenis === "Iqro'") {
    const jilidMatch = detail.match(/Jilid\s*(\d+)/i);
    const halMatch = detail.match(/Hal\.?\s*([^·,]+)$/i);
    if (jilidMatch) result.jilid = jilidMatch[1];
    if (halMatch) result.halaman = halMatch[1].trim();
  } else if (jenis === "Binadzor Al-Qur'an") {
    const juzMatch = detail.match(/Juz\s*(\d+)/i);
    const parts = detail.split('·');
    if (juzMatch) result.juz = juzMatch[1];
    if (parts[1]) {
      const [surahPart, ayatPart] = parts[1].split(':');
      if (surahPart) result.surat = surahPart.trim();
      if (ayatPart) result.ayat = ayatPart.trim();
    }
  }
  return result;
}

/**
 * Merender halaman Input & Riwayat Jurnal Mengaji untuk Admin & Guru.
 * @param {HTMLElement} container
 * @param {object} session
 */
export async function renderJurnalView(container, session) {
  const admin = isAdmin(session);
  const assignedClasses = getAssignedClasses(session);

  let students = [];
  let journals = [];
  let loading = true;
  let loadError = '';

  let editingJournal = null;

  // Filter state
  let filterClass = 'all';
  let filterSearch = '';
  let filterTanggal = '';
  let filterKehadiran = 'all';

  // Form dynamic state
  let formSelectedClass = '';
  let formJenisBacaan = "Iqro'";
  let formKategoriHafalan = 'Juz 30';
  let formDraft = {
    siswa_id: '',
    tanggal: getTodayISO(),
    kehadiran: 'Hadir',
    iqro_jilid: '1',
    iqro_halaman: '',
    bina_juz: '1',
    bina_surat: 'Al-Fatihah',
    bina_ayat: '',
    nilai_bacaan: '',
    nama_surat: '',
    ayat_hafalan: '',
    nilai_hafalan: '',
    catatan_guru: '',
  };

  function resetFormDraft() {
    formSelectedClass = '';
    formJenisBacaan = "Iqro'";
    formKategoriHafalan = 'Juz 30';
    formDraft = {
      siswa_id: '',
      tanggal: getTodayISO(),
      kehadiran: 'Hadir',
      iqro_jilid: '1',
      iqro_halaman: '',
      bina_juz: '1',
      bina_surat: 'Al-Fatihah',
      bina_ayat: '',
      nilai_bacaan: '',
      nama_surat: '',
      ayat_hafalan: '',
      nilai_hafalan: '',
      catatan_guru: '',
    };
  }

  function populateDraftFromJournal(journal) {
    const parsed = parseDetailBacaan(journal.jenis_bacaan, journal.detail_bacaan);
    formJenisBacaan = journal.jenis_bacaan || '-';
    formKategoriHafalan = journal.kategori_hafalan || '-';
    formSelectedClass = '';
    formDraft = {
      siswa_id: String(journal.siswa_id || ''),
      tanggal: journal.tanggal || getTodayISO(),
      kehadiran: journal.kehadiran || 'Hadir',
      iqro_jilid: parsed.jilid,
      iqro_halaman: parsed.halaman,
      bina_juz: parsed.juz,
      bina_surat: parsed.surat,
      bina_ayat: parsed.ayat,
      nilai_bacaan: journal.nilai_bacaan || '',
      nama_surat: journal.nama_surat || '',
      ayat_hafalan: journal.ayat_hafalan || '',
      nilai_hafalan: journal.nilai_hafalan || '',
      catatan_guru: journal.catatan_guru || '',
    };
  }

  function captureFormDraft() {
    const getVal = (sel) => workspace.querySelector(sel)?.value;
    if (getVal('#jrn-siswa') !== undefined) formDraft.siswa_id = getVal('#jrn-siswa');
    if (getVal('#jrn-tanggal') !== undefined) formDraft.tanggal = getVal('#jrn-tanggal');
    if (getVal('#jrn-kehadiran') !== undefined) formDraft.kehadiran = getVal('#jrn-kehadiran');
    if (getVal('#jrn-iqro-jilid') !== undefined) formDraft.iqro_jilid = getVal('#jrn-iqro-jilid');
    if (getVal('#jrn-iqro-halaman') !== undefined) formDraft.iqro_halaman = getVal('#jrn-iqro-halaman');
    if (getVal('#jrn-bina-juz') !== undefined) formDraft.bina_juz = getVal('#jrn-bina-juz');
    if (getVal('#jrn-bina-surat') !== undefined) formDraft.bina_surat = getVal('#jrn-bina-surat');
    if (getVal('#jrn-bina-ayat') !== undefined) formDraft.bina_ayat = getVal('#jrn-bina-ayat');
    if (getVal('#jrn-nilai-bacaan') !== undefined) formDraft.nilai_bacaan = getVal('#jrn-nilai-bacaan');
    if (getVal('#jrn-hafalan-surat') !== undefined) formDraft.nama_surat = getVal('#jrn-hafalan-surat');
    if (getVal('#jrn-hafalan-ayat') !== undefined) formDraft.ayat_hafalan = getVal('#jrn-hafalan-ayat');
    if (getVal('#jrn-nilai-hafalan') !== undefined) formDraft.nilai_hafalan = getVal('#jrn-nilai-hafalan');
    if (getVal('#jrn-catatan') !== undefined) formDraft.catatan_guru = getVal('#jrn-catatan');
  }

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-4">
        <div>
          <h2 class="text-xl font-bold text-slate-900">Jurnal Mengaji Harian</h2>
          <p class="text-sm text-slate-600 mt-0.5">
            Catat setoran Binadzor (Iqro' / Al-Qur'an) dan Tahfidz (Juz 30 / 5 Surat Pilihan) siswa secara kronologis.
          </p>
        </div>
        ${
          !admin
            ? `<div class="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 self-start">
                Kelas Binaan: ${escapeHtml(assignedClasses.join(', ') || 'Belum ada')}
              </div>`
            : ''
        }
      </div>

      <div id="jurnal-workspace"></div>
    </div>
  `;

  const workspace = container.querySelector('#jurnal-workspace');

  async function loadData() {
    loading = true;
    loadError = '';
    renderWorkspace();

    try {
      students = await fetchAccessibleStudents(session);
      journals = await fetchAccessibleJournals(session, students);
    } catch (err) {
      loadError = err?.message || 'Gagal memuat data jurnal mengaji.';
    } finally {
      loading = false;
      renderWorkspace();
    }
  }

  function renderWorkspace() {
    if (loading) {
      workspace.innerHTML = `
        <div class="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <div class="h-6 w-52 bg-slate-100 rounded animate-pulse"></div>
          <div class="h-12 w-full bg-slate-100 rounded animate-pulse"></div>
          <div class="h-12 w-full bg-slate-100 rounded animate-pulse"></div>
          <div class="h-12 w-full bg-slate-100 rounded animate-pulse"></div>
        </div>
      `;
      return;
    }

    if (loadError) {
      workspace.innerHTML = `
        <div class="bg-white border border-red-200 rounded-xl p-6 text-sm text-red-700">
          <p class="font-semibold">Gagal Memuat Jurnal</p>
          <p class="mt-1">${escapeHtml(loadError)}</p>
        </div>
      `;
      return;
    }

    const studentMap = new Map(students.map((s) => [String(s.id), s]));
    const classNames = Array.from(new Set(students.map((s) => s.kelas).filter(Boolean))).sort();

    const filteredStudentsForForm = formSelectedClass
      ? students.filter((s) => s.kelas === formSelectedClass)
      : students;

    const filteredJournals = journals.filter((j) => {
      const std = studentMap.get(String(j.siswa_id));
      const matchClass = filterClass === 'all' || (std && std.kelas === filterClass);
      const matchTanggal = !filterTanggal || String(j.tanggal || '').startsWith(filterTanggal);
      const matchKehadiran = filterKehadiran === 'all' || j.kehadiran === filterKehadiran;
      const q = filterSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        (std && String(std.nama || '').toLowerCase().includes(q)) ||
        (std && String(std.nisn || '').toLowerCase().includes(q)) ||
        String(j.detail_bacaan || '').toLowerCase().includes(q) ||
        String(j.nama_surat || '').toLowerCase().includes(q) ||
        String(j.catatan_guru || '').toLowerCase().includes(q);
      return matchClass && matchTanggal && matchKehadiran && matchSearch;
    });

    const isEditMode = Boolean(editingJournal);
    const defaultTanggal = formDraft.tanggal || getTodayISO();
    const defaultKehadiran = formDraft.kehadiran || 'Hadir';
    const defaultNilaiBacaan = formDraft.nilai_bacaan || '';
    const defaultNilaiHafalan = formDraft.nilai_hafalan || '';
    const defaultSuratHafalan = formDraft.nama_surat || '';
    const defaultAyatHafalan = formDraft.ayat_hafalan || '';
    const defaultCatatan = formDraft.catatan_guru || '';

    const surahHafalanOptions =
      formKategoriHafalan === '5 Surat Pilihan' ? LIMA_SURAT_PILIHAN : SURAT_JUZ_30;

    workspace.innerHTML = `
      <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <!-- FORM INPUT JURNAL HARIAN -->
        <div class="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-5">
          <div class="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 class="text-base font-bold text-slate-900">
                ${isEditMode ? 'Edit Catatan Jurnal' : 'Input Jurnal Mengaji'}
              </h3>
              <p class="text-xs text-slate-500 mt-0.5">
                Lengkapi kategori bacaan &amp; hafalan sesuai capaian hari ini.
              </p>
            </div>
            ${
              isEditMode
                ? `<button type="button" id="btn-cancel-journal-edit" class="text-xs font-semibold text-slate-500 hover:text-slate-900">Batal Edit</button>`
                : ''
            }
          </div>

          ${
            students.length === 0
              ? `
            <div class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Belum ada data siswa yang tersedia untuk dicatat. Tambahkan siswa terlebih dahulu di menu <strong>Data Siswa &amp; Kelas</strong>.
            </div>
          `
              : `
            <form id="form-jurnal" class="space-y-4">
              <!-- Identitas Siswa & Tanggal -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label for="jrn-filter-kelas" class="block text-xs font-medium text-slate-700 mb-1">Filter Kelas</label>
                  <select
                    id="jrn-filter-kelas"
                    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  >
                    <option value="">Semua Kelas (${students.length})</option>
                    ${classNames
                      .map(
                        (cls) =>
                          `<option value="${escapeHtml(cls)}" ${formSelectedClass === cls ? 'selected' : ''}>Kelas ${escapeHtml(cls)}</option>`
                      )
                      .join('')}
                  </select>
                </div>

                <div>
                  <label for="jrn-tanggal" class="block text-xs font-medium text-slate-700 mb-1">Tanggal</label>
                  <input
                    id="jrn-tanggal"
                    type="date"
                    required
                    value="${escapeHtml(defaultTanggal)}"
                    class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div class="sm:col-span-2">
                  <label for="jrn-siswa" class="block text-xs font-medium text-slate-700 mb-1">Nama Siswa</label>
                  <select
                    id="jrn-siswa"
                    required
                    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  >
                    <option value="">-- Pilih Siswa --</option>
                    ${filteredStudentsForForm
                      .map(
                        (s) =>
                          `<option value="${escapeHtml(s.id)}" ${String(formDraft.siswa_id) === String(s.id) ? 'selected' : ''}>${escapeHtml(s.nama)} (${escapeHtml(s.kelas)})</option>`
                      )
                      .join('')}
                  </select>
                </div>

                <div>
                  <label for="jrn-kehadiran" class="block text-xs font-medium text-slate-700 mb-1">Kehadiran</label>
                  <select
                    id="jrn-kehadiran"
                    required
                    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  >
                    ${KEHADIRAN_LIST.map(
                      (k) => `<option value="${k}" ${defaultKehadiran === k ? 'selected' : ''}>${k}</option>`
                    ).join('')}
                  </select>
                </div>
              </div>

              <!-- KATEGORI A: BACAAN / BINADZOR -->
              <div class="pt-3 border-t border-slate-200 space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-emerald-800 tracking-wide">Kategori A · Bacaan / Binadzor</span>
                </div>

                <div>
                  <label for="jrn-jenis-bacaan" class="block text-xs font-medium text-slate-700 mb-1">Tahap Bacaan</label>
                  <select
                    id="jrn-jenis-bacaan"
                    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  >
                    <option value="Iqro'" ${formJenisBacaan === "Iqro'" ? 'selected' : ''}>Tahap 1: Iqro' (Jilid 1–6)</option>
                    <option value="Binadzor Al-Qur'an" ${formJenisBacaan === "Binadzor Al-Qur'an" ? 'selected' : ''}>Tahap 2: Binadzor Al-Qur'an (Juz 1–30)</option>
                    <option value="-" ${formJenisBacaan === '-' ? 'selected' : ''}>Tidak Ada Setoran Bacaan</option>
                  </select>
                </div>

                ${
                  formJenisBacaan === "Iqro'"
                    ? `
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label for="jrn-iqro-jilid" class="block text-xs font-medium text-slate-700 mb-1">Jilid Iqro'</label>
                      <select
                        id="jrn-iqro-jilid"
                        class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                      >
                        ${[1, 2, 3, 4, 5, 6]
                          .map(
                            (j) =>
                              `<option value="${j}" ${String(formDraft.iqro_jilid) === String(j) ? 'selected' : ''}>Jilid ${j}</option>`
                          )
                          .join('')}
                      </select>
                    </div>
                    <div>
                      <label for="jrn-iqro-halaman" class="block text-xs font-medium text-slate-700 mb-1">Halaman</label>
                      <input
                        id="jrn-iqro-halaman"
                        type="text"
                        value="${escapeHtml(formDraft.iqro_halaman)}"
                        placeholder="Contoh: 14-15"
                        class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                      />
                    </div>
                  </div>
                `
                    : ''
                }

                ${
                  formJenisBacaan === "Binadzor Al-Qur'an"
                    ? `
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label for="jrn-bina-juz" class="block text-xs font-medium text-slate-700 mb-1">Juz (1–30)</label>
                      <select
                        id="jrn-bina-juz"
                        class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                      >
                        ${Array.from({ length: 30 }, (_, i) => i + 1)
                          .map(
                            (juz) =>
                              `<option value="${juz}" ${String(formDraft.bina_juz) === String(juz) ? 'selected' : ''}>Juz ${juz}</option>`
                          )
                          .join('')}
                      </select>
                    </div>
                    <div>
                      <label for="jrn-bina-surat" class="block text-xs font-medium text-slate-700 mb-1">Nama Surat</label>
                      <select
                        id="jrn-bina-surat"
                        class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                      >
                        ${ALL_SURAH_QURAN.map(
                          (surah) =>
                            `<option value="${escapeHtml(surah)}" ${formDraft.bina_surat === surah ? 'selected' : ''}>${escapeHtml(surah)}</option>`
                        ).join('')}
                      </select>
                    </div>
                    <div>
                      <label for="jrn-bina-ayat" class="block text-xs font-medium text-slate-700 mb-1">Rentang Ayat</label>
                      <input
                        id="jrn-bina-ayat"
                        type="text"
                        value="${escapeHtml(formDraft.bina_ayat)}"
                        placeholder="Contoh: 1-15"
                        class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                      />
                    </div>
                  </div>
                `
                    : ''
                }

                ${
                  formJenisBacaan !== '-'
                    ? `
                  <div>
                    <label for="jrn-nilai-bacaan" class="block text-xs font-medium text-slate-700 mb-1">Predikat Nilai Bacaan</label>
                    <select
                      id="jrn-nilai-bacaan"
                      class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                    >
                      <option value="">-- Pilih Predikat --</option>
                      ${PREDIKAT_NILAI.map(
                        (n) => `<option value="${n}" ${defaultNilaiBacaan === n ? 'selected' : ''}>${n}</option>`
                      ).join('')}
                    </select>
                  </div>
                `
                    : ''
                }
              </div>

              <!-- KATEGORI B: HAFALAN / TAHFIDZ -->
              <div class="pt-3 border-t border-slate-200 space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-emerald-800 tracking-wide">Kategori B · Hafalan / Tahfidz</span>
                </div>

                <div>
                  <label for="jrn-kategori-hafalan" class="block text-xs font-medium text-slate-700 mb-1">Target Hafalan</label>
                  <select
                    id="jrn-kategori-hafalan"
                    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  >
                    <option value="Juz 30" ${formKategoriHafalan === 'Juz 30' ? 'selected' : ''}>Juz 30 (Juz Amma)</option>
                    <option value="5 Surat Pilihan" ${formKategoriHafalan === '5 Surat Pilihan' ? 'selected' : ''}>5 Surat Pilihan (Al-Mulk, Al-Waqiah, Ar-Rahman, Yasin, Al-Kahfi)</option>
                    <option value="-" ${formKategoriHafalan === '-' ? 'selected' : ''}>Tidak Ada Setoran Hafalan</option>
                  </select>
                </div>

                ${
                  formKategoriHafalan !== '-'
                    ? `
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label for="jrn-hafalan-surat" class="block text-xs font-medium text-slate-700 mb-1">Nama Surat</label>
                      <select
                        id="jrn-hafalan-surat"
                        class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                      >
                        <option value="">-- Pilih Surat --</option>
                        ${surahHafalanOptions
                          .map(
                            (s) =>
                              `<option value="${escapeHtml(s)}" ${defaultSuratHafalan === s ? 'selected' : ''}>${escapeHtml(s)}</option>`
                          )
                          .join('')}
                      </select>
                    </div>
                    <div>
                      <label for="jrn-hafalan-ayat" class="block text-xs font-medium text-slate-700 mb-1">Ayat Hafalan</label>
                      <input
                        id="jrn-hafalan-ayat"
                        type="text"
                        value="${escapeHtml(defaultAyatHafalan)}"
                        placeholder="Contoh: 1-10"
                        class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="jrn-nilai-hafalan" class="block text-xs font-medium text-slate-700 mb-1">Predikat Nilai Hafalan</label>
                    <select
                      id="jrn-nilai-hafalan"
                      class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                    >
                      <option value="">-- Pilih Predikat --</option>
                      ${PREDIKAT_NILAI.map(
                        (n) => `<option value="${n}" ${defaultNilaiHafalan === n ? 'selected' : ''}>${n}</option>`
                      ).join('')}
                    </select>
                  </div>
                `
                    : ''
                }
              </div>

              <!-- Catatan Guru -->
              <div class="pt-3 border-t border-slate-200">
                <label for="jrn-catatan" class="block text-xs font-medium text-slate-700 mb-1">Catatan Guru Pembimbing</label>
                <textarea
                  id="jrn-catatan"
                  rows="2"
                  placeholder="Catatan tajwid, kelancaran makhraj, atau pesan untuk wali murid..."
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                >${escapeHtml(defaultCatatan)}</textarea>
              </div>

              <button
                type="submit"
                id="btn-save-journal"
                class="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 transition-colors disabled:opacity-60"
              >
                ${isEditMode ? 'Simpan Perubahan Jurnal' : 'Simpan Jurnal Harian'}
              </button>
            </form>
          `
          }
        </div>

        <!-- RIWAYAT JURNAL MENGAJI -->
        <div class="xl:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div class="p-4 border-b border-slate-200 space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-bold text-slate-900">Riwayat Jurnal Mengaji</h3>
              <span class="text-xs text-slate-500 tabular-nums">${filteredJournals.length} catatan (terbaru di atas)</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <input
                id="flt-jrn-search"
                type="search"
                value="${escapeHtml(filterSearch)}"
                placeholder="Cari siswa / surat..."
                class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
              <select
                id="flt-jrn-class"
                class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              >
                <option value="all">Semua Kelas</option>
                ${classNames
                  .map(
                    (cls) =>
                      `<option value="${escapeHtml(cls)}" ${filterClass === cls ? 'selected' : ''}>Kelas ${escapeHtml(cls)}</option>`
                  )
                  .join('')}
              </select>
              <select
                id="flt-jrn-kehadiran"
                class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              >
                <option value="all">Semua Kehadiran</option>
                ${KEHADIRAN_LIST.map(
                  (k) => `<option value="${k}" ${filterKehadiran === k ? 'selected' : ''}>${k}</option>`
                ).join('')}
              </select>
              <input
                id="flt-jrn-tanggal"
                type="date"
                value="${escapeHtml(filterTanggal)}"
                class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm tabular-nums focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>
          </div>

          ${
            filteredJournals.length === 0
              ? `
            <div class="p-10 text-center">
              <p class="text-sm font-semibold text-slate-800">Belum ada riwayat jurnal mengaji</p>
              <p class="text-xs text-slate-500 mt-1">Catat setoran mengaji pertama menggunakan formulir di sebelah kiri.</p>
            </div>
          `
              : `
            <div class="divide-y divide-slate-100">
              ${filteredJournals
                .map((j) => {
                  const std = studentMap.get(String(j.siswa_id));
                  const stdNama = std?.nama || `Siswa #${j.siswa_id}`;
                  const stdKelas = std?.kelas || '-';
                  return `
                    <article class="p-4 hover:bg-slate-50/70 transition-colors">
                      <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div>
                          <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <h4 class="text-sm font-bold text-slate-900">${escapeHtml(stdNama)}</h4>
                            <span class="text-xs text-slate-400" aria-hidden="true">·</span>
                            <span class="text-xs font-medium text-slate-600">Kelas ${escapeHtml(stdKelas)}</span>
                            <span class="text-xs text-slate-400" aria-hidden="true">·</span>
                            <span class="text-xs font-mono tabular-nums text-slate-500">${escapeHtml(formatTanggalID(j.tanggal))}</span>
                          </div>
                        </div>

                        <div class="flex items-center gap-3 shrink-0">
                          <span class="text-xs ${getKehadiranTextClass(j.kehadiran)}">${escapeHtml(j.kehadiran || 'Hadir')}</span>
                          <button type="button" data-edit-journal="${escapeHtml(j.id)}" class="text-xs font-semibold text-emerald-700 hover:text-emerald-900">Edit</button>
                          <button type="button" data-delete-journal="${escapeHtml(j.id)}" class="text-xs font-semibold text-red-600 hover:text-red-800">Hapus</button>
                        </div>
                      </div>

                      <div class="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div class="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                          <div class="text-slate-500 font-medium">Bacaan (${escapeHtml(j.jenis_bacaan || '-')})</div>
                          <div class="mt-0.5 text-slate-900 font-semibold">
                            ${escapeHtml(j.detail_bacaan || 'Tidak ada setoran')}
                          </div>
                          ${
                            j.nilai_bacaan
                              ? `<div class="mt-1 ${getNilaiTextClass(j.nilai_bacaan)}">Predikat: ${escapeHtml(j.nilai_bacaan)}</div>`
                              : ''
                          }
                        </div>

                        <div class="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                          <div class="text-slate-500 font-medium">Hafalan (${escapeHtml(j.kategori_hafalan || '-')})</div>
                          <div class="mt-0.5 text-slate-900 font-semibold">
                            ${
                              j.nama_surat
                                ? `${escapeHtml(j.nama_surat)}${j.ayat_hafalan ? ` · Ayat ${escapeHtml(j.ayat_hafalan)}` : ''}`
                                : 'Tidak ada setoran'
                            }
                          </div>
                          ${
                            j.nilai_hafalan
                              ? `<div class="mt-1 ${getNilaiTextClass(j.nilai_hafalan)}">Predikat: ${escapeHtml(j.nilai_hafalan)}</div>`
                              : ''
                          }
                        </div>
                      </div>

                      ${
                        j.catatan_guru
                          ? `<p class="mt-2 text-xs text-slate-600 leading-relaxed"><span class="font-semibold text-slate-700">Catatan:</span> ${escapeHtml(j.catatan_guru)}</p>`
                          : ''
                      }
                    </article>
                  `;
                })
                .join('')}
            </div>
          `
          }
        </div>
      </div>
    `;

    // Bind dynamic form controls (preserve current input values before re-rendering section)
    const fltClassEl = workspace.querySelector('#jrn-filter-kelas');
    const jenisBacaanEl = workspace.querySelector('#jrn-jenis-bacaan');
    const katHafalanEl = workspace.querySelector('#jrn-kategori-hafalan');
    const cancelEditBtn = workspace.querySelector('#btn-cancel-journal-edit');
    const formEl = workspace.querySelector('#form-jurnal');

    if (fltClassEl) {
      fltClassEl.addEventListener('change', (e) => {
        captureFormDraft();
        formSelectedClass = e.target.value;
        renderWorkspace();
      });
    }

    if (jenisBacaanEl) {
      jenisBacaanEl.addEventListener('change', (e) => {
        captureFormDraft();
        formJenisBacaan = e.target.value;
        renderWorkspace();
      });
    }

    if (katHafalanEl) {
      katHafalanEl.addEventListener('change', (e) => {
        captureFormDraft();
        formKategoriHafalan = e.target.value;
        renderWorkspace();
      });
    }

    if (cancelEditBtn) {
      cancelEditBtn.addEventListener('click', () => {
        editingJournal = null;
        resetFormDraft();
        renderWorkspace();
      });
    }

    // Filter riwayat bindings
    const fltSearchEl = workspace.querySelector('#flt-jrn-search');
    const fltListClassEl = workspace.querySelector('#flt-jrn-class');
    const fltKehadiranEl = workspace.querySelector('#flt-jrn-kehadiran');
    const fltTanggalEl = workspace.querySelector('#flt-jrn-tanggal');

    if (fltSearchEl) {
      fltSearchEl.addEventListener('input', (e) => {
        captureFormDraft();
        filterSearch = e.target.value;
        const pos = e.target.selectionStart;
        renderWorkspace();
        const restored = workspace.querySelector('#flt-jrn-search');
        if (restored) {
          restored.focus();
          restored.setSelectionRange(pos, pos);
        }
      });
    }
    if (fltListClassEl) {
      fltListClassEl.addEventListener('change', (e) => {
        captureFormDraft();
        filterClass = e.target.value;
        renderWorkspace();
      });
    }
    if (fltKehadiranEl) {
      fltKehadiranEl.addEventListener('change', (e) => {
        captureFormDraft();
        filterKehadiran = e.target.value;
        renderWorkspace();
      });
    }
    if (fltTanggalEl) {
      fltTanggalEl.addEventListener('change', (e) => {
        captureFormDraft();
        filterTanggal = e.target.value;
        renderWorkspace();
      });
    }

    // Edit & Delete buttons
    workspace.querySelectorAll('[data-edit-journal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-edit-journal');
        const found = journals.find((item) => String(item.id) === String(id));
        if (!found) return;
        editingJournal = found;
        populateDraftFromJournal(found);
        renderWorkspace();
        workspace.querySelector('#jrn-siswa')?.focus();
      });
    });

    workspace.querySelectorAll('[data-delete-journal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-delete-journal');
        const found = journals.find((item) => String(item.id) === String(id));
        if (!found) return;
        const std = studentMap.get(String(found.siswa_id));
        showConfirmModal({
          title: 'Hapus Catatan Jurnal',
          message: `Hapus catatan jurnal milik "${std?.nama || 'Siswa'}" pada tanggal ${formatTanggalID(found.tanggal)}?`,
          confirmText: 'Ya, Hapus',
          onConfirm: async () => {
            const supabase = getSupabaseClient();
            const { error } = await supabase.from('jurnal_ngaji').delete().eq('id', found.id);
            if (error) {
              showToast(`Gagal menghapus jurnal: ${error.message}`, 'error');
              return;
            }
            if (editingJournal && String(editingJournal.id) === String(found.id)) {
              editingJournal = null;
            }
            showToast('Catatan jurnal berhasil dihapus.', 'success');
            await loadData();
          },
        });
      });
    });

    // Submit form insert/update jurnal_ngaji
    if (formEl) {
      formEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = workspace.querySelector('#btn-save-journal');

        const siswaIdVal = workspace.querySelector('#jrn-siswa').value;
        const siswaIdNum = Number(siswaIdVal);
        const tanggal = workspace.querySelector('#jrn-tanggal').value;
        const kehadiran = workspace.querySelector('#jrn-kehadiran').value;
        const jenisBacaan = workspace.querySelector('#jrn-jenis-bacaan').value;
        const kategoriHafalan = workspace.querySelector('#jrn-kategori-hafalan').value;
        const catatanGuru = workspace.querySelector('#jrn-catatan').value.trim();

        let detailBacaan = '';
        let nilaiBacaan = '';
        if (jenisBacaan === "Iqro'") {
          const jilid = workspace.querySelector('#jrn-iqro-jilid')?.value || '1';
          const hal = workspace.querySelector('#jrn-iqro-halaman')?.value.trim() || '';
          detailBacaan = hal ? `Iqro' Jilid ${jilid} · Hal. ${hal}` : `Iqro' Jilid ${jilid}`;
          nilaiBacaan = workspace.querySelector('#jrn-nilai-bacaan')?.value || '';
        } else if (jenisBacaan === "Binadzor Al-Qur'an") {
          const juz = workspace.querySelector('#jrn-bina-juz')?.value || '1';
          const surat = workspace.querySelector('#jrn-bina-surat')?.value || '';
          const ayat = workspace.querySelector('#jrn-bina-ayat')?.value.trim() || '';
          detailBacaan = ayat ? `Juz ${juz} · ${surat} : ${ayat}` : `Juz ${juz} · ${surat}`;
          nilaiBacaan = workspace.querySelector('#jrn-nilai-bacaan')?.value || '';
        }

        let namaSurat = '';
        let ayatHafalan = '';
        let nilaiHafalan = '';
        if (kategoriHafalan !== '-') {
          namaSurat = workspace.querySelector('#jrn-hafalan-surat')?.value || '';
          ayatHafalan = workspace.querySelector('#jrn-hafalan-ayat')?.value.trim() || '';
          nilaiHafalan = workspace.querySelector('#jrn-nilai-hafalan')?.value || '';
        }

        const payload = {
          siswa_id: Number.isNaN(siswaIdNum) ? siswaIdVal : siswaIdNum,
          tanggal,
          kehadiran,
          jenis_bacaan: jenisBacaan === '-' ? '' : jenisBacaan,
          detail_bacaan: detailBacaan,
          nilai_bacaan: nilaiBacaan,
          kategori_hafalan: kategoriHafalan === '-' ? '' : kategoriHafalan,
          nama_surat: namaSurat,
          ayat_hafalan: ayatHafalan,
          nilai_hafalan: nilaiHafalan,
          catatan_guru: catatanGuru,
        };

        saveBtn.disabled = true;
        saveBtn.textContent = 'Menyimpan...';

        try {
          const supabase = getSupabaseClient();
          if (editingJournal) {
            const { error } = await supabase
              .from('jurnal_ngaji')
              .update(payload)
              .eq('id', editingJournal.id);
            if (error) throw error;
            editingJournal = null;
            showToast('Catatan jurnal berhasil diperbarui.', 'success');
          } else {
            const { error } = await supabase.from('jurnal_ngaji').insert([payload]);
            if (error) throw error;
            showToast('Jurnal mengaji harian berhasil disimpan.', 'success');
          }
          resetFormDraft();
          await loadData();
        } catch (err) {
          showToast(`Gagal menyimpan jurnal: ${err.message}`, 'error');
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = editingJournal ? 'Simpan Perubahan Jurnal' : 'Simpan Jurnal Harian';
        }
      });
    }
  }

  await loadData();
}

