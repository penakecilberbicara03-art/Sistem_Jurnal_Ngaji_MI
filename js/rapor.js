// js/rapot.js - Modul Cetak Rapot / Nilai Akhir Semester (Gaya Ringkas & Elegan)

async function renderRapotView(containerId, studentId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  var sb = getSb(); // Mengambil koneksi Supabase dari config.js
  if (!sb) {
    container.innerHTML = '<div class="p-6 text-center text-red-500">Koneksi database belum siap!</div>';
    return;
  }

  container.innerHTML = '<div class="p-8 text-center text-gray-500">Memuat data rapot siswa...</div>';

  try {
    // 1. Ambil data siswa
    const { data: student, error: errStu } = await sb
      .from('roodoh_students')
      .select('*')
      .eq('id', studentId)
      .single();

    if (errStu || !student) {
      container.innerHTML = '<div class="p-6 text-center text-red-500">Data siswa tidak ditemukan.</div>';
      return;
    }

    // 2. Ambil data jurnal ngaji siswa tersebut
    const { data: journals, error: errJrn } = await sb
      .from('jurnal_ngaji')
      .select('*')
      .eq('siswa_id', studentId)
      .order('tanggal', { ascending: false });

    if (errJrn) throw errJrn;

    // Hitung rekap kehadiran
    let totalHadir = 0;
    let totalSakit = 0;
    let totalIzin = 0;
    let totalSetoran = journals ? journals.length : 0;

    if (journals) {
      journals.forEach(j => {
        if (j.kehadiran === 'Hadir') totalHadir++;
        else if (j.kehadiran === 'Sakit') totalSakit++;
        else if (j.kehadiran === 'Izin') totalIzin++;
      });
    }

    // Ambil aktivitas terakhir
    let lastJournal = journals && journals.length > 0 ? journals[0] : null;

    // Render tampilan rapot gaya struk / laporan ringkas
    var html = `
      <div class="mx-auto max-w-2xl rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm sm:p-8 print:border-none print:shadow-none">
        <!-- Header Madrasah -->
        <div class="border-b border-dashed border-emerald-300 pb-4 text-center">
          <h2 class="text-xl font-bold text-emerald-900">MADRASAH IBTIDAIYAH (MI)</h2>
          <p class="text-xs font-medium text-emerald-700">LAPORAN CAPAIAN HASIL BELAJAR MENGAJI (RAPOT KONTRAK)</p>
          <p class="mt-1 text-[11px] text-gray-400">Tahun Ajaran 2026/2027 · Semester Ganjil</p>
        </div>

        <!-- Identitas Siswa -->
        <div class="my-4 grid grid-cols-2 gap-2 rounded-xl bg-emerald-50/50 p-4 text-sm text-gray-700">
          <div>
            <p><span class="font-semibold text-gray-900">Nama:</span> ${escapeHtml(student.nama)}</p>
            <p><span class="font-semibold text-gray-900">NISN:</span> ${escapeHtml(student.nisn)}</p>
          </div>
          <div>
            <p><span class="font-semibold text-gray-900">Kelas:</span> ${escapeHtml(student.kelas)}</p>
            <p><span class="font-semibold text-gray-900">Wali Kelas:</span> ${escapeHtml(student.guru_pembimbing || '-')}</p>
          </div>
        </div>

        <!-- Rekap Kehadiran -->
        <div class="mb-6">
          <h3 class="text-xs font-bold uppercase tracking-wider text-emerald-800">I. Rekapitulasi Kehadiran</h3>
          <div class="mt-2 grid grid-cols-3 gap-2 text-center">
            <div class="rounded-lg border border-emerald-100 bg-gray-50 p-2">
              <p class="text-xs text-gray-500">Hadir</p>
              <p class="text-lg font-bold text-emerald-700">${totalHadir}</p>
            </div>
            <div class="rounded-lg border border-emerald-100 bg-gray-50 p-2">
              <p class="text-xs text-gray-500">Sakit</p>
              <p class="text-lg font-bold text-amber-600">${totalSakit}</p>
            </div>
            <div class="rounded-lg border border-emerald-100 bg-gray-50 p-2">
              <p class="text-xs text-gray-500">Izin</p>
              <p class="text-lg font-bold text-blue-600">${totalIzin}</p>
            </div>
          </div>
        </div>

        <!-- Capaian Tilawah & Tahfidz -->
        <div class="mb-6 space-y-3">
          <h3 class="text-xs font-bold uppercase tracking-wider text-emerald-800">II. Capaian Kompetensi Mengaji</h3>
          
          <div class="rounded-xl border border-gray-100 bg-gray-50/60 p-3.5 text-sm">
            <p class="font-semibold text-emerald-900">A. Membaca Al-Qur'an (Tilawah / Iqro)</p>
            <p class="mt-1 text-xs text-gray-600">
              ${lastJournal && lastJournal.jenis_bacaan ? `${lastJournal.jenis_bacaan}: ${lastJournal.detail_bacaan}` : 'Belum ada data setoran bacaan.'}
            </p>
            <p class="mt-0.5 text-[11px] text-emerald-700 font-medium">Predikat Kelancaran Terakhir: ${lastJournal?.nilai_bacaan || '-'}</p>
          </div>

          <div class="rounded-xl border border-gray-100 bg-gray-50/60 p-3.5 text-sm">
            <p class="font-semibold text-emerald-900">B. Hafalan Tahfidz (Juz 30 & Surat Pilihan)</p>
            <p class="mt-1 text-xs text-gray-600">
              ${lastJournal && lastJournal.nama_surat ? `Kategori: ${lastJournal.kategori_hafalan} · QS. ${lastJournal.nama_surat} (${lastJournal.ayat_hafalan})` : 'Proses setoran Juz 30.'}
            </p>
            <p class="mt-0.5 text-[11px] text-emerald-700 font-medium">Predikat Nilai Hafalan: ${lastJournal?.nilai_hafalan || '-'}</p>
          </div>
        </div>

        <!-- Catatan Wali Kelas -->
        <div class="mb-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3 text-xs text-gray-600">
          <p class="font-semibold text-gray-800">Catatan & Evaluasi Guru Pembimbing:</p>
          <p class="mt-1 italic">"${escapeHtml(student.catatan_semester || lastJournal?.catatan_guru || 'Siswa menunjukkan perkembangan yang baik dan disiplin dalam mengikuti kegiatan mengaji.')}"</p>
        </div>

        <!-- Tombol Aksi Cetak -->
        <div class="flex items-center justify-between pt-2 print:hidden">
          <button onclick="window.print()" class="rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800">
            Cetak / Simpan PDF
          </button>
          <p class="text-[11px] text-gray-400">Dicetak otomatis dari Sistem Jurnal MI</p>
        </div>
      </div>
    `;

    container.innerHTML = html;

  } catch (err) {
    console.error("Gagal memuat rapot:", err);
    container.innerHTML = '<div class="p-6 text-center text-red-500">Terjadi kesalahan saat memuat data rapot.</div>';
  }
}

// Helper escape HTML sederhana agar aman
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
