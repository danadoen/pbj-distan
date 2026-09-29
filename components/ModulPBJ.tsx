import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Search, Download, Upload, FileSpreadsheet, ClipboardPaste, Edit, Trash2, CheckCircle2, X, Zap, Loader2, AlertTriangle, Info, Table, Save, Sparkles
} from 'lucide-react';
import { LaporanPBJ, Modul, Role, ReferensiRUP, User } from '../types';
import { dbService } from '../services/dbService';
import {
  parseExcelTSV,
  worksheetToGrid,
  smartParseLaporanGrid,
  downloadExcelTemplate,
} from '../services/excelImportParser';
import * as XLSX from 'xlsx';

interface ModulPBJProps {
  type: Modul;
  user: User;
}

const ModulPBJ: React.FC<ModulPBJProps> = ({ type, user }) => {
  const [data, setData] = useState<LaporanPBJ[]>([]);
  const [referensi, setReferensi] = useState<ReferensiRUP[]>([]);
  const [bidangList, setBidangList] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBidang, setFilterBidang] = useState(user.role === Role.STAFF ? user.bidang || '' : '');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<LaporanPBJ | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [lookupError, setLookupError] = useState(false);
  const [lookupSuccess, setLookupSuccess] = useState(false);

  // Bulk Import / Excel Import States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importMode, setImportMode] = useState<'paste' | 'file'>('paste');
  const [pasteContent, setPasteContent] = useState('');
  const [parsedItems, setParsedItems] = useState<LaporanPBJ[]>([]);
  const [detectedHeaderInfo, setDetectedHeaderInfo] = useState('');
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [defaultImportBidang, setDefaultImportBidang] = useState<string>(
    user.role === Role.STAFF ? user.bidang || '' : ''
  );
  const [syncToRUP, setSyncToRUP] = useState(true);
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const [isSavingImport, setIsSavingImport] = useState(false);
  const [importStatusMsg, setImportStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Excel Workbook Multi-sheet support
  const [workbookRef, setWorkbookRef] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const initialForm: LaporanPBJ = {
    modul: type,
    bidang: user.role === Role.STAFF ? user.bidang || '' : '',
    kode_rup: '',
    satuan_kerja: '',
    nama_paket: '',
    metode_pengadaan: '',
    sumber_dana: '',
    pagu: 0,
    hps: 0,
    kontrak_nomor: '',
    kontrak_nilai: 0,
    kontrak_tanggal: '',
    penyedia: '',
    realisasi_keuangan: 0,
    fisik_rencana: 0,
    fisik_realisasi: 0,
    nomor_sp2d: '',
    tgl_sp2d: ''
  };
  const [form, setForm] = useState<LaporanPBJ>(initialForm);

  useEffect(() => {
    loadData();
    setDefaultImportBidang(user.role === Role.STAFF ? user.bidang || '' : '');
  }, [type, user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const targetBidang = user.role === Role.STAFF ? user.bidang : undefined;
      const [laporan, ref, bList] = await Promise.all([
        dbService.getLaporan(type, targetBidang),
        dbService.getReferensiRUP(),
        dbService.getBidang()
      ]);
      setData(Array.isArray(laporan) ? laporan : []);
      setReferensi(Array.isArray(ref) ? ref.filter(r => r.jenis_pengadaan === type) : []);
      setBidangList(Array.isArray(bList) ? bList : []);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.bidang) {
      alert("Bidang harus dipilih.");
      return;
    }
    try {
      if (editingItem && editingItem.id) {
        await dbService.updateLaporan({ ...form, id: editingItem.id });
      } else {
        await dbService.addLaporan(form);
      }
      setIsModalOpen(false);
      setEditingItem(null);
      setForm(initialForm);
      await loadData();
    } catch (err) {
      alert("Gagal menyimpan data: " + (err as any).message);
    }
  };

  const triggerDelete = (id: number | undefined) => {
    if (!id) return;
    setItemToDelete(id);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await dbService.deleteLaporan(itemToDelete);
      setIsDeleteConfirmOpen(false);
      setItemToDelete(null);
      await loadData();
    } catch (err) {
      alert("Gagal menghapus data.");
    } finally {
      setIsDeleting(false);
    }
  };

  const manualRUPLookup = () => {
    setLookupError(false);
    setLookupSuccess(false);
    const selected = referensi.find(r => String(r.kode_rup).trim().toLowerCase() === String(form.kode_rup).trim().toLowerCase());
    if (selected) {
      setForm({
        ...form,
        kode_rup: selected.kode_rup,
        nama_paket: selected.nama_paket,
        pagu: selected.pagu,
        satuan_kerja: selected.satuan_kerja || '-',
        metode_pengadaan: selected.metode_pengadaan || '-',
        sumber_dana: selected.sumber_dana || '-'
      });
      setLookupSuccess(true);
      setTimeout(() => setLookupSuccess(false), 2000);
    } else {
      setLookupError(true);
      setTimeout(() => setLookupError(false), 3000);
    }
  };

  const filteredData = (Array.isArray(data) ? data : []).filter(item => {
    const nama = (item?.nama_paket || '').toLowerCase();
    const kode = (item?.kode_rup || '').toLowerCase();
    const s = searchTerm.toLowerCase();
    const matchesSearch = nama.includes(s) || kode.includes(s);
    const matchesBidang = user.role === Role.ADMIN ? (filterBidang === '' || item?.bidang === filterBidang) : true;
    return matchesSearch && matchesBidang;
  });

  const exportToExcel = () => {
    const bidangHeader = type === Modul.SWAKELOLA ? 'BIDANG' : 'Bidang';
    const row1 = [
      'Kode RUP',
      'Satuan Kerja',
      'Nama Paket',
      'Metode Pengadaan',
      'Jenis Pengadaan',
      'Sumber Dana',
      'Nilai Pagu (Rp)',
      'HPS (Rp)',
      'DATA KONTRAK AWAL DAN ADDENDUM',
      '',
      '',
      '',
      'KEUANGAN',
      '',
      'FISIK',
      '',
      '',
      'SP2D',
      '',
      'SISA ANGGARAN (Rp)',
      bidangHeader,
    ];

    const row2 = [
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'NOMOR',
      'NILAI (Rp,)',
      'TANGGAL/MASA PELAKSANAAN',
      'PENYEDIA\n(PT, CV, UD, dll)',
      'REALISASI (Rp.)',
      '%',
      'RENCANA (%)',
      'REALISASI (%)',
      'DEVIASI (%)',
      'NOMOR',
      'TGL',
      '',
      '',
    ];

    const row3 =
      type === Modul.PENYEDIA
        ? ['1', '2', '', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14,00', '15,00', '16,00', '17,00', '18', '19', '20', '']
        : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', ''];

    const dataRows = filteredData.map((item) => {
      const persenKeu = item.kontrak_nilai > 0 ? Number(((item.realisasi_keuangan / item.kontrak_nilai) * 100).toFixed(2)) : 0;
      const deviasiFisik = Number((Number(item.fisik_rencana) - Number(item.fisik_realisasi)).toFixed(2));
      const sisaAnggaran = Number(item.kontrak_nilai) - Number(item.realisasi_keuangan);

      return [
        item.kode_rup || '',
        item.satuan_kerja || 'Dinas Pertanian Lombok Barat',
        item.nama_paket || '',
        item.metode_pengadaan || '-',
        type,
        item.sumber_dana || 'APBD',
        Number(item.pagu) || 0,
        Number(item.hps) || 0,
        item.kontrak_nomor || '',
        Number(item.kontrak_nilai) || 0,
        item.kontrak_tanggal || '',
        item.penyedia || '',
        Number(item.realisasi_keuangan) || 0,
        persenKeu,
        Number(item.fisik_rencana) || 0,
        Number(item.fisik_realisasi) || 0,
        deviasiFisik,
        item.nomor_sp2d || '',
        item.tgl_sp2d || '',
        sisaAnggaran,
        item.bidang || '',
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([row1, row2, row3, ...dataRows]);
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
      { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } },
      { s: { r: 0, c: 3 }, e: { r: 1, c: 3 } },
      { s: { r: 0, c: 4 }, e: { r: 1, c: 4 } },
      { s: { r: 0, c: 5 }, e: { r: 1, c: 5 } },
      { s: { r: 0, c: 6 }, e: { r: 1, c: 6 } },
      { s: { r: 0, c: 7 }, e: { r: 1, c: 7 } },
      { s: { r: 0, c: 8 }, e: { r: 0, c: 11 } },
      { s: { r: 0, c: 12 }, e: { r: 0, c: 13 } },
      { s: { r: 0, c: 14 }, e: { r: 0, c: 16 } },
      { s: { r: 0, c: 17 }, e: { r: 0, c: 18 } },
      { s: { r: 0, c: 19 }, e: { r: 1, c: 19 } },
      { s: { r: 0, c: 20 }, e: { r: 1, c: 20 } },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Laporan ${type}`);
    XLSX.writeFile(workbook, `Laporan_${type}_2026.xlsx`);
  };

  // ==========================================
  // BULK IMPORT / EXCEL IMPORT HANDLERS
  // ==========================================
  const openImportModal = () => {
    setPasteContent('');
    setParsedItems([]);
    setDetectedHeaderInfo('');
    setImportWarnings([]);
    setImportStatusMsg(null);
    setWorkbookRef(null);
    setSheetNames([]);
    setSelectedSheet('');
    setUploadedFileName('');
    setDefaultImportBidang(user.role === Role.STAFF ? user.bidang || '' : filterBidang || '');
    setIsImportModalOpen(true);
  };

  const runSmartGridParse = (grid: string[][], fallbackBidangOverride?: string) => {
    const activeFallbackBidang =
      fallbackBidangOverride !== undefined ? fallbackBidangOverride : defaultImportBidang;
    const result = smartParseLaporanGrid(grid, type, {
      bidangList,
      defaultBidang: activeFallbackBidang,
      referensiList: referensi,
    });
    setParsedItems(result.items);
    setDetectedHeaderInfo(result.detectedHeaderInfo);
    setImportWarnings(result.warnings);
    if (result.items.length === 0) {
      setImportStatusMsg({
        type: 'error',
        text: 'Tidak ada baris data paket yang terdeteksi. Pastikan data memiliki Kode RUP atau Nama Paket.',
      });
    } else {
      setImportStatusMsg(null);
    }
  };

  const handleProcessPaste = () => {
    if (!pasteContent || !pasteContent.trim()) {
      setImportStatusMsg({
        type: 'error',
        text: 'Silakan tempel (paste) data dari Excel terlebih dahulu.',
      });
      return;
    }
    setIsProcessingImport(true);
    try {
      // Do NOT call .trim() on pasteContent so leading tabs on sub-header rows are preserved
      const grid = parseExcelTSV(pasteContent);
      runSmartGridParse(grid);
    } catch (err: any) {
      setImportStatusMsg({
        type: 'error',
        text: 'Gagal memproses teks dari Excel: ' + (err?.message || 'Format tidak dikenali'),
      });
    } finally {
      setIsProcessingImport(false);
    }
  };

  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setIsProcessingImport(true);
    setImportStatusMsg(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        setWorkbookRef(wb);
        const sheets = wb.SheetNames || [];
        setSheetNames(sheets);

        // Smartly pick sheet matching current modul (Penyedia / Swakelola) if available
        const matchingSheet =
          sheets.find((s) => s.toLowerCase().includes(type.toLowerCase())) || sheets[0] || '';
        setSelectedSheet(matchingSheet);

        if (matchingSheet && wb.Sheets[matchingSheet]) {
          const grid = worksheetToGrid(wb.Sheets[matchingSheet]);
          runSmartGridParse(grid);
        }
      } catch (err: any) {
        setImportStatusMsg({
          type: 'error',
          text: 'Gagal membaca file Excel: ' + (err?.message || 'Pastikan file berformat .xlsx / .xls / .csv'),
        });
      } finally {
        setIsProcessingImport(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSheetChange = (sheetName: string) => {
    setSelectedSheet(sheetName);
    if (workbookRef && workbookRef.Sheets[sheetName]) {
      const grid = worksheetToGrid(workbookRef.Sheets[sheetName]);
      runSmartGridParse(grid);
    }
  };

  const handleDefaultBidangChange = (newBidang: string) => {
    setDefaultImportBidang(newBidang);
    if (parsedItems.length > 0 && newBidang) {
      // Fill empty bidang in parsedItems automatically
      const updated = parsedItems.map((it) => ({
        ...it,
        bidang: it.bidang || newBidang,
      }));
      setParsedItems(updated);
      const stillMissing = updated.filter((it) => !it.bidang).length;
      setImportWarnings(
        stillMissing > 0 ? [`${stillMissing} baris belum memiliki Bidang.`] : []
      );
    }
  };

  const applyBidangToAllParsed = () => {
    if (!defaultImportBidang) return;
    setParsedItems((prev) => prev.map((it) => ({ ...it, bidang: defaultImportBidang })));
    setImportWarnings([]);
  };

  const handleUpdateParsedRowBidang = (idx: number, bidangVal: string) => {
    setParsedItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], bidang: bidangVal };
      const missing = next.filter((it) => !it.bidang).length;
      setImportWarnings(missing > 0 ? [`${missing} baris belum memiliki Bidang.`] : []);
      return next;
    });
  };

  const handleRemoveParsedRow = (idx: number) => {
    setParsedItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleConfirmBulkImport = async () => {
    if (parsedItems.length === 0) return;

    const missingBidang = parsedItems.some((it) => !it.bidang || !it.bidang.trim());
    if (missingBidang) {
      setImportStatusMsg({
        type: 'error',
        text: 'Masih ada baris data yang belum memiliki Bidang. Silakan pilih Default Bidang di bagian atas atau lengkapi pada tabel pratinjau.',
      });
      return;
    }

    setIsSavingImport(true);
    setImportStatusMsg(null);
    try {
      // If there are new bidang names in the imported rows that aren't in bidangList yet, add them
      const existingLower = new Set(bidangList.map((b) => b.toLowerCase()));
      const newBidangs = Array.from(
        new Set<string>(
          parsedItems
            .map((it) => it.bidang.trim())
            .filter((b) => b && !existingLower.has(b.toLowerCase()))
        )
      );
      if (newBidangs.length > 0) {
        try {
          await dbService.addBidangBulk(newBidangs);
        } catch {
          // ignore if bidang already exists
        }
      }

      await dbService.importLaporan(parsedItems, syncToRUP);
      setImportStatusMsg({
        type: 'success',
        text: `Berhasil mengimpor ${parsedItems.length} data realisasi ${type} ke database!`,
      });
      await loadData();
      setTimeout(() => {
        setIsImportModalOpen(false);
        setParsedItems([]);
        setPasteContent('');
      }, 900);
    } catch (err: any) {
      setImportStatusMsg({
        type: 'error',
        text: 'Gagal menyimpan ke database: ' + (err?.message || 'Terjadi kesalahan jaringan'),
      });
    } finally {
      setIsSavingImport(false);
    }
  };

  const sp2dHeaderLabel = type === Modul.PENYEDIA ? "SP2D/KUITANSI" : "SP2D";

  return (
    <div className="space-y-4 px-2 md:px-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Cari paket..." className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 shadow-sm outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          {user.role === Role.ADMIN && (
            <select className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 shadow-sm outline-none" value={filterBidang} onChange={(e) => setFilterBidang(e.target.value)}>
              <option value="">Semua Bidang</option>
              {bidangList.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportToExcel}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 bg-white rounded-xl text-xs font-bold hover:bg-slate-50 shadow-sm transition-all cursor-pointer"
          >
            <Download size={14} /> Export Excel
          </button>
          <button
            onClick={openImportModal}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-100 shadow-sm transition-all cursor-pointer"
          >
            <Upload size={14} /> Import / Bulk Excel
          </button>
          <button
            onClick={() => { setForm(initialForm); setEditingItem(null); setIsModalOpen(true); }}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
          >
            <Plus size={14} /> Tambah Data
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[2200px]">
            <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-tight text-slate-500">
              <tr>
                <th rowSpan={2} className="px-4 py-4 border-b border-slate-200 text-center w-12 bg-slate-50">No</th>
                <th rowSpan={2} className="px-4 py-4 border-b border-slate-200 min-w-[350px] bg-slate-50">Nama Paket / RUP</th>
                <th rowSpan={2} className="px-4 py-4 border-b border-slate-200 text-center bg-slate-100/30">Pagu Anggaran</th>
                <th rowSpan={2} className="px-4 py-4 border-b border-slate-200 text-center">HPS (Rp)</th>
                <th colSpan={4} className="px-4 py-2 border-b border-slate-200 text-center bg-blue-50/50">Data Kontrak</th>
                <th colSpan={2} className="px-4 py-2 border-b border-slate-200 text-center bg-emerald-50/50">Keuangan</th>
                <th colSpan={3} className="px-4 py-2 border-b border-slate-200 text-center bg-amber-50/50">Fisik</th>
                <th colSpan={2} className="px-4 py-2 border-b border-slate-200 text-center bg-slate-100/50">{sp2dHeaderLabel}</th>
                <th rowSpan={2} className="px-4 py-4 border-b border-slate-200 text-center">Sisa Kontrak</th>
                <th rowSpan={2} className="px-4 py-4 border-b border-slate-200 text-center">Bidang</th>
                <th rowSpan={2} className="px-4 py-4 border-b border-slate-200 text-center sticky right-0 bg-white shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)] z-20">Aksi</th>
              </tr>
              <tr>
                <th className="px-2 py-3 border-b border-slate-200 text-[9px] bg-blue-50/30">Nomor</th>
                <th className="px-2 py-3 border-b border-slate-200 text-[9px] bg-blue-50/30">Nilai (Rp)</th>
                <th className="px-2 py-3 border-b border-slate-200 text-[9px] bg-blue-50/30">Tgl/Masa</th>
                <th className="px-2 py-3 border-b border-slate-200 text-[9px] bg-blue-50/30">Penyedia</th>
                <th className="px-2 py-3 border-b border-slate-200 text-[9px] bg-emerald-50/30">Realisasi (Rp)</th>
                <th className="px-2 py-3 border-b border-slate-200 text-[9px] bg-emerald-50/30">%</th>
                <th className="px-2 py-3 border-b border-slate-200 text-[9px] bg-amber-50/30">Rencana (%)</th>
                <th className="px-2 py-3 border-b border-slate-200 text-[9px] bg-amber-50/30">Realisasi (%)</th>
                <th className="px-2 py-3 border-b border-slate-200 text-[9px] bg-amber-50/30">Deviasi (%)</th>
                <th className="px-2 py-3 border-b border-slate-200 text-[9px] bg-slate-100/30">Nomor</th>
                <th className="px-2 py-3 border-b border-slate-200 text-[9px] bg-slate-100/30">Tgl</th>
              </tr>
            </thead>
            <tbody className="text-[11px] divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={19} className="px-4 py-20 text-center text-slate-300 italic">Memuat data realisasi...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan={19} className="px-4 py-20 text-center text-slate-300 italic">Data belum tersedia.</td></tr>
              ) : filteredData.map((item, idx) => {
                const sisa = Number(item.kontrak_nilai) - Number(item.realisasi_keuangan);
                const persenK = item.kontrak_nilai > 0 ? (item.realisasi_keuangan / item.kontrak_nilai) * 100 : 0;
                const dev = Number(item.fisik_rencana) - Number(item.fisik_realisasi);
                const isDelay = dev > 0;

                return (
                  <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-4 py-4 text-center text-slate-400 font-bold">{idx + 1}</td>
                    <td className="px-4 py-4">
                      <div className="font-bold text-slate-800 whitespace-normal break-words leading-relaxed">{item.nama_paket}</div>
                      <div className="text-[9px] font-black text-blue-600 bg-blue-50 w-fit px-1.5 rounded mt-1 uppercase">{item.kode_rup}</div>
                    </td>
                    <td className="px-4 py-4 font-mono font-black text-center text-slate-900 bg-slate-50/30">Rp {item.pagu.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-4 font-mono font-bold text-center text-slate-600">{item.hps.toLocaleString('id-ID')}</td>
                    <td className="px-2 py-4 truncate max-w-[100px] text-slate-500">{item.kontrak_nomor || '-'}</td>
                    <td className="px-2 py-4 font-mono font-bold text-blue-700">{item.kontrak_nilai.toLocaleString('id-ID')}</td>
                    <td className="px-2 py-4 text-center text-slate-500">{item.kontrak_tanggal || '-'}</td>
                    <td className="px-2 py-4 font-bold text-slate-700 truncate max-w-[120px]">{item.penyedia || '-'}</td>
                    <td className="px-2 py-4 font-mono font-black text-emerald-600">{item.realisasi_keuangan.toLocaleString('id-ID')}</td>
                    <td className="px-2 py-4 text-center font-black text-slate-700">{persenK.toFixed(1)}%</td>
                    <td className="px-2 py-4 text-center text-slate-400">{item.fisik_rencana}%</td>
                    <td className="px-2 py-4 text-center font-black text-blue-600">{item.fisik_realisasi}%</td>
                    <td className="px-2 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full font-black ${isDelay ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {isDelay ? `+${dev.toFixed(1)}` : dev.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-2 py-4 truncate max-w-[100px] text-slate-500">{item.nomor_sp2d || '-'}</td>
                    <td className="px-2 py-4 text-center text-slate-500">{item.tgl_sp2d || '-'}</td>
                    <td className="px-4 py-4 font-mono text-right text-rose-500 font-black">{sisa.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-4 text-center">
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest">{item.bidang}</span>
                    </td>
                    <td className="px-4 py-4 text-center sticky right-0 bg-white group-hover:bg-slate-50 shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)] z-10">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => { setForm(item); setEditingItem(item); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Edit Data"><Edit size={16} /></button>
                        <button onClick={() => triggerDelete(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Hapus Data"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL BULK IMPORT / IMPORT EXCEL (PINTAR MENCARI HEADER)              */}
      {/* ===================================================================== */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-w-7xl my-auto shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20">
                  <FileSpreadsheet size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                      Bulk Import Data {type}
                    </h2>
                    <span className="px-2.5 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                      <Sparkles size={11} /> Smart Header Detector
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">
                    Import file Excel (.xlsx/.xls/.csv) atau Copy-Paste langsung dari tabel Excel {type}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadExcelTemplate(type, defaultImportBidang)}
                  className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <Download size={14} /> Unduh Template {type}
                </button>
                <button
                  onClick={() => setIsImportModalOpen(false)}
                  className="p-2.5 hover:bg-slate-200/70 rounded-full transition-all text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1">
              {/* Top Configuration Bar: Mode Switcher + Default Bidang + RUP Sync */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <div className="lg:col-span-5 flex gap-1.5 p-1 bg-slate-200/80 rounded-xl w-full sm:w-fit">
                  <button
                    type="button"
                    onClick={() => setImportMode('paste')}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      importMode === 'paste'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ClipboardPaste size={15} /> Copy-Paste dari Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode('file')}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      importMode === 'file'
                        ? 'bg-white text-emerald-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FileSpreadsheet size={15} /> Upload File Excel
                  </button>
                </div>

                <div className="lg:col-span-4 flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                      Default Bidang (Jika Kolom Bidang Kosong)
                    </label>
                    <div className="flex gap-1.5">
                      <select
                        className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                        value={defaultImportBidang}
                        onChange={(e) => handleDefaultBidangChange(e.target.value)}
                      >
                        <option value="">-- Pilih Default Bidang --</option>
                        {bidangList.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                      {parsedItems.length > 0 && defaultImportBidang && (
                        <button
                          type="button"
                          onClick={applyBidangToAllParsed}
                          className="px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer"
                          title="Terapkan bidang ini ke seluruh baris di pratinjau"
                        >
                          Set Semua
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-3 flex items-center justify-end">
                  <label className="flex items-center gap-2.5 text-xs font-bold text-slate-600 cursor-pointer select-none bg-white px-3.5 py-2.5 rounded-xl border border-slate-200">
                    <input
                      type="checkbox"
                      checked={syncToRUP}
                      onChange={(e) => setSyncToRUP(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Sinkronkan juga ke RUP</span>
                  </label>
                </div>
              </div>

              {/* Input Area + Preview Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Input Method + Smart Header Reference */}
                <div className="lg:col-span-5 space-y-4">
                  {importMode === 'paste' ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                          <ClipboardPaste size={16} className="text-blue-600" /> Tempel Data Tabel Excel ({type})
                        </label>
                        {pasteContent && (
                          <button
                            type="button"
                            onClick={() => {
                              setPasteContent('');
                              setParsedItems([]);
                              setDetectedHeaderInfo('');
                              setImportStatusMsg(null);
                            }}
                            className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
                          >
                            Bersihkan
                          </button>
                        )}
                      </div>
                      <textarea
                        className="w-full h-56 p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-[11px] font-mono focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                        placeholder={`Blok & Copy (Ctrl+C) tabel dari Excel ${type} (boleh beserta header bertingkat maupun langsung baris datanya), lalu Paste (Ctrl+V) di sini...`}
                        value={pasteContent}
                        onChange={(e) => setPasteContent(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={handleProcessPaste}
                        disabled={isProcessingImport}
                        className="w-full py-3.5 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-blue-600 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-98 disabled:opacity-50 cursor-pointer"
                      >
                        {isProcessingImport ? (
                          <>
                            <Loader2 size={16} className="animate-spin" /> Memindai Header & Memproses...
                          </>
                        ) : (
                          <>
                            <Sparkles size={16} /> Deteksi Header & Proses Data
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                        <FileSpreadsheet size={16} className="text-emerald-600" /> Pilih File Excel (.xlsx, .xls, .csv)
                      </label>
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50/80 transition-all rounded-2xl p-8 text-center cursor-pointer flex flex-col items-center justify-center gap-3 min-h-[200px]"
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          className="hidden"
                          onChange={handleExcelFileChange}
                        />
                        <div className="w-14 h-14 rounded-2xl bg-emerald-600/10 text-emerald-600 flex items-center justify-center">
                          <Upload size={28} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-800">
                            {uploadedFileName ? uploadedFileName : 'Klik untuk memilih file Excel'}
                          </p>
                          <p className="text-[11px] text-slate-500 font-medium mt-1">
                            Sistem otomatis mencari baris Header meskipun ada judul laporan di baris atas
                          </p>
                        </div>
                      </div>

                      {sheetNames.length > 1 && (
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                          <span className="text-xs font-bold text-slate-600">Pilih Sheet Excel:</span>
                          <select
                            value={selectedSheet}
                            onChange={(e) => handleSheetChange(e.target.value)}
                            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-blue-600 outline-none"
                          >
                            {sheetNames.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Smart Header Specification Info Box */}
                  <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 space-y-2.5 text-[10px] text-slate-600">
                    <div className="flex items-center gap-2 font-black text-blue-800 uppercase tracking-wider">
                      <Info size={14} className="text-blue-600 shrink-0" />
                      <span>Format Header {type} yang Dikenali Otomatis:</span>
                    </div>
                    <div className="space-y-1.5 font-mono text-[9.5px] bg-white/90 p-3 rounded-xl border border-blue-100/80 leading-relaxed text-slate-700 overflow-x-auto">
                      <div>
                        <span className="font-black text-blue-700">Baris 1:</span> Kode RUP | Satuan Kerja | Nama Paket | Metode Pengadaan | Jenis Pengadaan | Sumber Dana | Nilai Pagu (Rp) | HPS (Rp) | DATA KONTRAK AWAL DAN ADDENDUM | KEUANGAN | FISIK | SP2D | SISA ANGGARAN (Rp) | {type === Modul.SWAKELOLA ? 'BIDANG' : 'Bidang'}
                      </div>
                      <div>
                        <span className="font-black text-emerald-700">Baris 2 (Sub):</span> NOMOR | NILAI (Rp,) | TANGGAL/MASA PELAKSANAAN | PENYEDIA (PT, CV, UD, dll) | REALISASI (Rp.) | % | RENCANA (%) | REALISASI (%) | DEVIASI (%) | NOMOR | TGL
                      </div>
                      <div>
                        <span className="font-black text-amber-700">Baris 3 (No Kolom):</span>{' '}
                        {type === Modul.PENYEDIA
                          ? '1 | 2 |  | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14,00 | 15,00 | 16,00 | 17,00 | 18 | 19 | 20 (Dilewati Otomatis)'
                          : '1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 (Dilewati Otomatis)'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Parsed Preview Table */}
                <div className="lg:col-span-7 bg-slate-50 rounded-3xl p-5 border border-slate-200 flex flex-col min-h-[420px]">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div>
                      <h3 className="text-sm font-black flex items-center gap-2 text-slate-800 uppercase tracking-tight">
                        <Table size={18} className="text-blue-600" /> Pratinjau Hasil Deteksi ({parsedItems.length} Paket)
                      </h3>
                      {detectedHeaderInfo && (
                        <p className="text-[10px] font-bold text-emerald-600 mt-0.5 flex items-center gap-1">
                          <CheckCircle2 size={12} /> {detectedHeaderInfo}
                        </p>
                      )}
                    </div>

                    {parsedItems.length > 0 && (
                      <button
                        type="button"
                        onClick={handleConfirmBulkImport}
                        disabled={isSavingImport}
                        className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        {isSavingImport ? (
                          <>
                            <Loader2 size={15} className="animate-spin" /> Menyimpan...
                          </>
                        ) : (
                          <>
                            <Save size={15} /> Simpan {parsedItems.length} Data ke Database
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {importWarnings.length > 0 && (
                    <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] font-bold text-amber-800 flex items-center gap-2">
                      <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                      <span>{importWarnings.join(' ')}</span>
                    </div>
                  )}

                  {importStatusMsg && (
                    <div
                      className={`mb-3 p-3 rounded-xl text-xs font-bold flex items-center gap-2 border ${
                        importStatusMsg.type === 'success'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-rose-50 border-rose-200 text-rose-600'
                      }`}
                    >
                      {importStatusMsg.type === 'success' ? (
                        <CheckCircle2 size={16} className="shrink-0" />
                      ) : (
                        <AlertTriangle size={16} className="shrink-0" />
                      )}
                      <span>{importStatusMsg.text}</span>
                    </div>
                  )}

                  <div className="flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-inner max-h-[380px]">
                    {parsedItems.length === 0 ? (
                      <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3 text-slate-400">
                          <FileSpreadsheet size={30} />
                        </div>
                        <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">
                          Menunggu Data Excel / Copy-Paste
                        </p>
                        <p className="text-[11px] text-slate-400 max-w-md">
                          Tempelkan baris dari Excel di sebelah kiri lalu klik <b>Deteksi Header & Proses Data</b>, atau unggah file Excel secara langsung.
                        </p>
                      </div>
                    ) : (
                      <table className="w-full text-left text-[10px] border-collapse min-w-[1350px]">
                        <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10 text-[9px] font-black uppercase text-slate-600">
                          <tr>
                            <th className="px-2.5 py-3 text-center w-8">#</th>
                            <th className="px-2.5 py-3">Kode RUP</th>
                            <th className="px-2.5 py-3 min-w-[200px]">Nama Paket</th>
                            <th className="px-2.5 py-3">Metode / Sumber</th>
                            <th className="px-2.5 py-3 text-right">Nilai Pagu</th>
                            <th className="px-2.5 py-3 text-right">HPS</th>
                            <th className="px-2.5 py-3">No. Kontrak</th>
                            <th className="px-2.5 py-3 text-right">Nilai Kontrak</th>
                            <th className="px-2.5 py-3">Tgl/Masa</th>
                            <th className="px-2.5 py-3">Penyedia</th>
                            <th className="px-2.5 py-3 text-right">Realisasi Keu</th>
                            <th className="px-2.5 py-3 text-center">Fisik (R/R)</th>
                            <th className="px-2.5 py-3">SP2D (No/Tgl)</th>
                            <th className="px-2.5 py-3 min-w-[130px]">Bidang</th>
                            <th className="px-2.5 py-3 text-center">Hapus</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {parsedItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                              <td className="px-2.5 py-2.5 text-center font-bold text-slate-400">{idx + 1}</td>
                              <td className="px-2.5 py-2.5 font-mono font-bold text-blue-600">{item.kode_rup || '-'}</td>
                              <td className="px-2.5 py-2.5 font-bold text-slate-800 max-w-[220px] truncate" title={item.nama_paket}>
                                {item.nama_paket}
                              </td>
                              <td className="px-2.5 py-2.5 text-slate-500">
                                <div className="truncate max-w-[110px] font-semibold">{item.metode_pengadaan}</div>
                                <div className="text-[9px] text-slate-400">{item.sumber_dana}</div>
                              </td>
                              <td className="px-2.5 py-2.5 text-right font-mono font-bold text-slate-900">
                                {item.pagu.toLocaleString('id-ID')}
                              </td>
                              <td className="px-2.5 py-2.5 text-right font-mono text-slate-600">
                                {item.hps.toLocaleString('id-ID')}
                              </td>
                              <td className="px-2.5 py-2.5 font-mono text-slate-600 truncate max-w-[100px]">
                                {item.kontrak_nomor || '-'}
                              </td>
                              <td className="px-2.5 py-2.5 text-right font-mono font-bold text-blue-700">
                                {item.kontrak_nilai.toLocaleString('id-ID')}
                              </td>
                              <td className="px-2.5 py-2.5 text-slate-500 truncate max-w-[90px]">
                                {item.kontrak_tanggal || '-'}
                              </td>
                              <td className="px-2.5 py-2.5 font-semibold text-slate-700 truncate max-w-[110px]">
                                {item.penyedia || '-'}
                              </td>
                              <td className="px-2.5 py-2.5 text-right font-mono font-bold text-emerald-600">
                                {item.realisasi_keuangan.toLocaleString('id-ID')}
                              </td>
                              <td className="px-2.5 py-2.5 text-center font-mono">
                                <span className="text-slate-500">{item.fisik_rencana}%</span> /{' '}
                                <span className="font-bold text-blue-600">{item.fisik_realisasi}%</span>
                              </td>
                              <td className="px-2.5 py-2.5 text-slate-500">
                                <div className="truncate max-w-[90px]">{item.nomor_sp2d || '-'}</div>
                                <div className="text-[9px] text-slate-400">{item.tgl_sp2d || ''}</div>
                              </td>
                              <td className="px-2.5 py-2.5">
                                <select
                                  value={item.bidang}
                                  onChange={(e) => handleUpdateParsedRowBidang(idx, e.target.value)}
                                  className={`w-full px-2 py-1 rounded-lg text-[10px] font-black uppercase border outline-none ${
                                    item.bidang
                                      ? 'bg-slate-50 border-slate-200 text-slate-700'
                                      : 'bg-rose-50 border-rose-300 text-rose-600'
                                  }`}
                                >
                                  <option value="">-- Pilih --</option>
                                  {bidangList.map((b) => (
                                    <option key={b} value={b}>
                                      {b}
                                    </option>
                                  ))}
                                  {item.bidang && !bidangList.includes(item.bidang) && (
                                    <option value={item.bidang}>{item.bidang}</option>
                                  )}
                                </select>
                              </td>
                              <td className="px-2.5 py-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveParsedRow(idx)}
                                  className="p-1 text-slate-300 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                  title="Hapus baris ini dari pratinjau"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-white rounded-[3rem] w-full max-w-6xl my-auto shadow-2xl animate-in zoom-in-95 duration-300 border-none">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{editingItem ? 'Edit Data Realisasi' : 'Input Realisasi Baru'}</h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Lengkapi form sesuai dokumen pendukung</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-slate-100 rounded-full transition-all text-slate-400"><X size={24} /></button>
            </div>
            <form onSubmit={handleSave} className="p-10 bg-slate-50/40">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                 {/* Panel 1: RUP & HPS */}
                 <div className="space-y-6">
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-5">
                       <label className="text-[11px] font-black uppercase text-slate-400 tracking-[0.2em] px-1 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Identitas & HPS
                       </label>
                       <div className="flex gap-2">
                          <input type="text" placeholder="KODE RUP" className={`flex-1 p-4 border rounded-2xl text-sm font-black tracking-widest focus:ring-4 focus:ring-blue-500/10 outline-none transition-all ${lookupError ? 'border-rose-300 bg-rose-50' : lookupSuccess ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`} value={form.kode_rup} onChange={(e) => setForm({ ...form, kode_rup: e.target.value })} />
                          <button type="button" onClick={manualRUPLookup} className="p-4 bg-slate-900 text-white rounded-2xl hover:bg-blue-600 transition-all shadow-lg active:scale-95"><Zap size={20} /></button>
                       </div>
                       <textarea rows={4} placeholder="NAMA PAKET PEKERJAAN" className="w-full p-4 border border-slate-200 rounded-2xl text-sm font-bold bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" value={form.nama_paket} onChange={(e) => setForm({ ...form, nama_paket: e.target.value })} />
                       
                       <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1.5 block">BIDANG PENGAMPU</label>
                            <select 
                              className="w-full p-4 border border-rose-200 rounded-2xl text-sm font-black text-rose-600 bg-rose-50/30 outline-none focus:ring-4 focus:ring-rose-500/10"
                              value={form.bidang}
                              onChange={(e) => setForm({ ...form, bidang: e.target.value })}
                              required
                            >
                              <option value="">-- PILIH BIDANG --</option>
                              {bidangList.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1.5 block tracking-tight">PAGU RUP (AUTO)</label>
                            <div className="relative">
                               <input type="number" className="w-full p-4 border border-slate-100 rounded-2xl text-sm font-black text-slate-500 bg-slate-100 outline-none" value={form.pagu} onChange={(e) => setForm({ ...form, pagu: Number(e.target.value) })} />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-blue-600 uppercase ml-2 mb-1.5 block tracking-tight">NILAI HPS (RP)</label>
                            <input type="number" placeholder="INPUT HPS" className="w-full p-4 border border-blue-100 rounded-2xl text-sm font-black text-blue-700 bg-blue-50/30 outline-none focus:ring-4 focus:ring-blue-500/10" value={form.hps} onChange={(e) => setForm({ ...form, hps: Number(e.target.value) })} />
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* Panel 2: Kontrak */}
                 <div className="space-y-6">
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-5">
                       <label className="text-[11px] font-black uppercase text-slate-400 tracking-[0.2em] px-1 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Data Kontrak
                       </label>
                       <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1.5 block">NOMOR KONTRAK / SPMK</label>
                          <input type="text" placeholder="INPUT NOMOR KONTRAK" className="w-full p-4 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10" value={form.kontrak_nomor} onChange={(e) => setForm({ ...form, kontrak_nomor: e.target.value })} />
                       </div>
                       <div>
                          <label className="text-[10px] font-black text-blue-600 uppercase ml-2 mb-1.5 block">NILAI KONTRAK (RP)</label>
                          <input type="number" placeholder="INPUT NILAI KONTRAK" className="w-full p-4 border border-slate-200 rounded-2xl text-sm font-black text-blue-800 outline-none focus:ring-4 focus:ring-blue-500/10" value={form.kontrak_nilai} onChange={(e) => setForm({ ...form, kontrak_nilai: Number(e.target.value) })} />
                       </div>
                       <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1.5 block">TANGGAL / MASA PELAKSANAAN</label>
                          <input type="text" placeholder="CONTOH: 15 MEI 2026 / 120 HK" className="w-full p-4 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-4 focus:ring-blue-500/10" value={form.kontrak_tanggal} onChange={(e) => setForm({ ...form, kontrak_tanggal: e.target.value })} />
                       </div>
                       <div>
                          <label className="text-[10px] font-black text-slate-900 uppercase ml-2 mb-1.5 block">PENYEDIA (PT, CV, UD, DLL)</label>
                          <input type="text" placeholder="NAMA PERUSAHAAN / PELAKSANA" className="w-full p-4 border border-slate-200 rounded-2xl text-sm font-black outline-none focus:ring-4 focus:ring-blue-500/10" value={form.penyedia} onChange={(e) => setForm({ ...form, penyedia: e.target.value })} />
                       </div>
                    </div>
                    <div className="bg-slate-900 p-6 rounded-[2rem] text-white shadow-xl">
                       <div className="flex justify-between items-center opacity-60 mb-1">
                          <span className="text-[10px] font-black uppercase tracking-widest">Sisa Kontrak</span>
                          <span className="text-[10px] font-black uppercase tracking-widest">Rp</span>
                       </div>
                       <div className="text-2xl font-black text-rose-400 leading-none">
                          {(form.kontrak_nilai - form.realisasi_keuangan).toLocaleString('id-ID')}
                       </div>
                    </div>
                 </div>

                 {/* Panel 3: Realisasi & SP2D */}
                 <div className="space-y-6">
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-5">
                       <label className="text-[11px] font-black uppercase text-slate-400 tracking-[0.2em] px-1 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Keuangan & Fisik
                       </label>
                       <div>
                          <label className="text-[10px] font-black text-emerald-600 uppercase ml-2 mb-1.5 block">REALISASI KEUANGAN (RP)</label>
                          <input type="number" placeholder="INPUT REALISASI (AKUMULATIF)" className="w-full p-4 border border-emerald-100 rounded-2xl text-sm font-black text-emerald-700 bg-emerald-50/20 outline-none focus:ring-4 focus:ring-emerald-500/10" value={form.realisasi_keuangan} onChange={(e) => setForm({ ...form, realisasi_keuangan: Number(e.target.value) })} />
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          <div>
                             <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1.5 block">FISIK RENCANA (%)</label>
                             <input type="number" step="0.1" className="w-full p-4 border border-slate-200 rounded-2xl text-sm font-bold outline-none" value={form.fisik_rencana} onChange={(e) => setForm({ ...form, fisik_rencana: Number(e.target.value) })} />
                          </div>
                          <div>
                             <label className="text-[10px] font-black text-blue-600 uppercase ml-2 mb-1.5 block">FISIK REALISASI (%)</label>
                             <input type="number" step="0.1" className="w-full p-4 border border-blue-100 rounded-2xl text-sm font-black text-blue-700 outline-none focus:ring-4 focus:ring-blue-500/10" value={form.fisik_realisasi} onChange={(e) => setForm({ ...form, fisik_realisasi: Number(e.target.value) })} />
                          </div>
                       </div>
                    </div>
                    
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-5">
                       <label className="text-[11px] font-black uppercase text-slate-400 tracking-[0.2em] px-1 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span> Data {sp2dHeaderLabel}
                       </label>
                       <div className="grid grid-cols-1 gap-4">
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1.5 block">NOMOR {sp2dHeaderLabel}</label>
                            <input type="text" placeholder="INPUT NOMOR" className="w-full p-4 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10" value={form.nomor_sp2d} onChange={(e) => setForm({ ...form, nomor_sp2d: e.target.value })} />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1.5 block">TANGGAL {sp2dHeaderLabel}</label>
                            <input type="text" placeholder="CONTOH: 15/05/2026" className="w-full p-4 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-4 focus:ring-blue-500/10" value={form.tgl_sp2d} onChange={(e) => setForm({ ...form, tgl_sp2d: e.target.value })} />
                          </div>
                       </div>
                    </div>

                    <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black text-sm hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 active:scale-95 flex items-center justify-center gap-3">
                       <CheckCircle2 size={24} /> SIMPAN DATA REALISASI
                    </button>
                 </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-10 text-center shadow-2xl animate-in zoom-in-95 duration-200 border-none">
            <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
               <AlertTriangle size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">Hapus Realisasi</h3>
            <p className="text-sm text-slate-500 mb-8 font-medium">Apakah Anda yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan.</p>
            <div className="flex gap-4">
              <button onClick={() => setIsDeleteConfirmOpen(false)} className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-slate-400 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all">Batal</button>
              <button onClick={confirmDelete} disabled={isDeleting} className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-white bg-rose-600 hover:bg-rose-700 rounded-2xl shadow-lg shadow-rose-600/20 transition-all flex items-center justify-center">
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModulPBJ;
