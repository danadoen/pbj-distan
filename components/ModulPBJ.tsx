
import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Download, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  X,
  Database,
  Zap,
  Info,
  Check,
  Lock,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { LaporanPBJ, Modul, Role, ReferensiRUP, User } from '../types';
import { dbService } from '../services/dbService';
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
    kontrak_nomor: '-',
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
      setData(laporan);
      setReferensi(ref.filter(r => r.jenis_pengadaan === type));
      setBidangList(bList);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setData(prev => prev.filter(item => item.id !== itemToDelete));
      setIsDeleteConfirmOpen(false);
      setItemToDelete(null);
      await loadData();
    } catch (err) {
      alert("Gagal menghapus data dari server.");
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

  const filteredData = data.filter(item => {
    const matchesSearch = (item.nama_paket?.toLowerCase() || "").includes(searchTerm.toLowerCase()) || 
                          (item.kode_rup?.toLowerCase() || "").includes(searchTerm.toLowerCase());
    const matchesBidang = user.role === Role.ADMIN ? (filterBidang === '' || item.bidang === filterBidang) : true;
    return matchesSearch && matchesBidang;
  });

  const exportToExcel = () => {
    let header1: string[] = [];
    let header2: string[] = [];
    let merges: any[] = [];
    let rows: any[][] = [];

    if (type === Modul.PENYEDIA) {
      header1 = ["NO", "Kode RUP", "Satuan Kerja", "Nama Paket", "SP2D/KUITANSI", "", "SISA KONTRAK", "BIDANG", "Metode Pengadaan", "Jenis Pengadaan", "Sumber Dana", "Nilai Pagu (Rp)", "HPS (Rp)", "DATA KONTRAK", "", "", "", "KEUANGAN", "", "FISIK", "", ""];
      header2 = ["", "", "", "", "NOMOR", "TGL", "", "", "", "", "", "", "", "NOMOR", "NILAI (Rp,)", "TANGGAL/MASA PELAKSANAAN", "PENYEDIA (PT, CV, UD, dll)", "REALISASI (Rp.)", "%", "RENCANA (%)", "REALISASI (%)", "DEVIASI (%)"];
      
      merges = [
        { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
        { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
        { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } },
        { s: { r: 0, c: 3 }, e: { r: 1, c: 3 } },
        { s: { r: 0, c: 4 }, e: { r: 0, c: 5 } },
        { s: { r: 0, c: 6 }, e: { r: 1, c: 6 } },
        { s: { r: 0, c: 7 }, e: { r: 1, c: 7 } },
        { s: { r: 0, c: 8 }, e: { r: 1, c: 8 } },
        { s: { r: 0, c: 9 }, e: { r: 1, c: 9 } },
        { s: { r: 0, c: 10 }, e: { r: 1, c: 10 } },
        { s: { r: 0, c: 11 }, e: { r: 1, c: 11 } },
        { s: { r: 0, c: 12 }, e: { r: 1, c: 12 } },
        { s: { r: 0, c: 13 }, e: { r: 0, c: 16 } },
        { s: { r: 0, c: 17 }, e: { r: 0, c: 18 } },
        { s: { r: 0, c: 19 }, e: { r: 0, c: 21 } },
      ];

      rows = filteredData.map((item, idx) => [
        idx + 1, item.kode_rup, item.satuan_kerja, item.nama_paket, 
        item.nomor_sp2d, item.tgl_sp2d, item.sisa_kontrak, item.bidang, 
        item.metode_pengadaan, item.modul, item.sumber_dana, item.pagu, item.hps,
        item.kontrak_nomor, item.kontrak_nilai, item.kontrak_tanggal, item.penyedia,
        item.realisasi_keuangan, item.persen_keuangan, item.fisik_rencana, item.fisik_realisasi, item.deviasi_fisik
      ]);
    } else {
      header1 = ["NO", "Kode RUP", "Satuan Kerja", "Nama Paket", "SP2D", "", "SISA KONTRAK", "BIDANG", "Metode Pengadaan", "Sumber Dana", "Nilai Pagu (Rp)", "HPS (Rp)", "DATA KONTRAK", "", "", "KEUANGAN", "", "FISIK", "", ""];
      header2 = ["", "", "", "", "NOMOR", "TGL", "", "", "", "", "", "", "NOMOR", "NILAI (Rp,)", "TANGGAL/MASA PELAKSANAAN", "REALISASI (Rp.)", "%", "RENCANA (%)", "REALISASI (%)", "DEVIASI (%)"];
      
      merges = [
        { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
        { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
        { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } },
        { s: { r: 0, c: 3 }, e: { r: 1, c: 3 } },
        { s: { r: 0, c: 4 }, e: { r: 0, c: 5 } },
        { s: { r: 0, c: 6 }, e: { r: 1, c: 6 } },
        { s: { r: 0, c: 7 }, e: { r: 1, c: 7 } },
        { s: { r: 0, c: 8 }, e: { r: 1, c: 8 } },
        { s: { r: 0, c: 9 }, e: { r: 1, c: 10 } },
        { s: { r: 0, c: 10 }, e: { r: 1, c: 10 } },
        { s: { r: 0, c: 11 }, e: { r: 1, c: 11 } },
        { s: { r: 0, c: 12 }, e: { r: 0, c: 14 } },
        { s: { r: 0, c: 15 }, e: { r: 0, c: 16 } },
        { s: { r: 0, c: 17 }, e: { r: 0, c: 19 } },
      ];

      rows = filteredData.map((item, idx) => [
        idx + 1, item.kode_rup, item.satuan_kerja, item.nama_paket, 
        item.nomor_sp2d, item.tgl_sp2d, item.sisa_kontrak, item.bidang, 
        item.metode_pengadaan, item.sumber_dana, item.pagu, item.hps,
        item.kontrak_nomor, item.kontrak_nilai, item.kontrak_tanggal,
        item.realisasi_keuangan, item.persen_keuangan, item.fisik_rencana, item.fisik_realisasi, item.deviasi_fisik
      ]);
    }

    const worksheet = XLSX.utils.aoa_to_sheet([header1, header2, ...rows]);
    worksheet['!merges'] = merges;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Realisasi ${type}`);
    XLSX.writeFile(workbook, `Laporan_PBJ_${type}_2026.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="Cari paket atau kode RUP..." className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          {user.role === Role.ADMIN && (
            <select className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" value={filterBidang} onChange={(e) => setFilterBidang(e.target.value)}>
              <option value="">Semua Bidang</option>
              {bidangList.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white rounded-lg text-sm font-semibold hover:bg-slate-50 transition-all shadow-sm">
            <Download size={16} /> Excel
          </button>
          <button onClick={() => { setForm(initialForm); setEditingItem(null); setIsModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all shadow-md">
            <Plus size={16} /> Tambah Data
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
              <tr>
                <th rowSpan={2} className="px-4 py-4 border-r border-b border-slate-200 text-center">No</th>
                <th rowSpan={2} className="px-4 py-4 border-r border-b border-slate-200">Bidang & Nama Paket</th>
                <th colSpan={3} className="px-4 py-2 border-r border-b border-slate-200 text-center bg-blue-50/50 text-blue-700">Detail Anggaran</th>
                <th colSpan={3} className="px-4 py-2 border-r border-b border-slate-200 text-center bg-emerald-50/50 text-emerald-700">Realisasi Keuangan</th>
                <th colSpan={3} className="px-4 py-2 border-r border-b border-slate-200 text-center bg-amber-50/50 text-amber-700">Progres Fisik</th>
                <th rowSpan={2} className="px-4 py-4 border-b border-slate-200 text-center">Aksi</th>
              </tr>
              <tr>
                <th className="px-4 py-2 border-r border-b border-slate-200 text-[10px]">Pagu</th>
                <th className="px-4 py-2 border-r border-b border-slate-200 text-[10px]">HPS</th>
                <th className="px-4 py-2 border-r border-b border-slate-200 text-[10px]">Kontrak</th>
                <th className="px-4 py-2 border-r border-b border-slate-200 text-[10px]">Realisasi</th>
                <th className="px-4 py-2 border-r border-b border-slate-200 text-[10px]">Sisa</th>
                <th className="px-4 py-2 border-r border-b border-slate-200 text-[10px]">%</th>
                <th className="px-4 py-2 border-r border-b border-slate-200 text-[10px]">Rencana</th>
                <th className="px-4 py-2 border-r border-b border-slate-200 text-[10px]">Realisasi</th>
                <th className="px-4 py-2 border-r border-b border-slate-200 text-[10px]">Deviasi</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={13} className="px-4 py-20 text-center text-slate-400">Memuat data...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan={13} className="px-4 py-20 text-center text-slate-400 italic">Belum ada data realisasi {user.role === Role.STAFF ? `Bidang ${user.bidang}` : type}.</td></tr>
              ) : filteredData.map((item, idx) => (
                <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-4 text-center text-slate-400 font-medium">{idx + 1}</td>
                  <td className="px-4 py-4">
                    <div className="font-bold text-slate-900 leading-snug">{item.nama_paket}</div>
                    <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                       <span className="font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{item.kode_rup}</span>
                       <span className="bg-slate-100 px-1.5 py-0.5 rounded font-medium">{item.bidang}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 font-mono text-[11px]">{item.pagu.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-4 font-mono text-[11px] text-slate-400">{item.hps.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-4 font-mono text-[11px] font-semibold">{item.kontrak_nilai.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-4 font-mono text-[11px] text-emerald-600 font-bold">{item.realisasi_keuangan.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-4 font-mono text-[11px] text-rose-600">{item.sisa_kontrak?.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-4 font-bold text-slate-600">{item.persen_keuangan?.toFixed(1)}%</td>
                  <td className="px-4 py-4 text-center text-slate-400">{item.fisik_rencana}%</td>
                  <td className="px-4 py-4 text-center font-bold text-amber-600">{item.fisik_realisasi}%</td>
                  <td className="px-4 py-4 text-center">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${(item.deviasi_fisik || 0) < 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {item.deviasi_fisik?.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => { setForm(item); setEditingItem(item); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all"><Edit size={16} /></button>
                      {(user.role === Role.ADMIN || item.bidang === user.bidang) && (
                        <button onClick={() => triggerDelete(item.id)} className={`p-1.5 rounded-md transition-all text-slate-400 hover:text-red-600 hover:bg-red-50`}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 p-8 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
               <AlertTriangle size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Konfirmasi Hapus</h3>
            <p className="text-sm text-slate-500 mb-8 px-4">Apakah Anda yakin ingin menghapus data laporan ini secara permanen?</p>
            <div className="flex gap-3">
              <button onClick={() => setIsDeleteConfirmOpen(false)} className="flex-1 py-3 text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all">Tidak, Batal</button>
              <button onClick={confirmDelete} disabled={isDeleting} className="flex-1 py-3 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-2xl shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2">
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${editingItem ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                  {editingItem ? <Edit size={20} /> : <Plus size={20} />}
                </div>
                <h2 className="text-xl font-bold text-slate-800">
                  {editingItem ? 'Edit Laporan Realisasi' : 'Input Realisasi Baru'}
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded ml-3 font-bold uppercase tracking-widest">{form.bidang}</span>
                </h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-200 rounded-full transition-all"><X size={20} /></button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-8 bg-white">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-6">
                  <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-5">
                    <h3 className="text-xs font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2">
                      <Database size={14} /> Sinkronisasi Database RUP
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Kode RUP</label>
                        <div className="flex gap-2">
                          <input type="text" required placeholder="Lookup RUP..." className={`flex-1 p-2.5 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all ${lookupError ? 'border-red-300 bg-red-50' : lookupSuccess ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`} value={form.kode_rup} onChange={(e) => setForm({ ...form, kode_rup: e.target.value })} />
                          <button type="button" onClick={manualRUPLookup} className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm active:scale-95 transition-all ${lookupSuccess ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                            {lookupSuccess ? <Check size={14} /> : <Zap size={14} fill="currentColor" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Bidang Pelaksana</label>
                        <div className="relative">
                          <select required disabled={user.role === Role.STAFF} className={`w-full p-2.5 border border-slate-200 rounded-lg text-sm outline-none appearance-none ${user.role === Role.STAFF ? 'bg-slate-100 text-slate-500 font-bold' : 'focus:ring-2 focus:ring-blue-500'}`} value={form.bidang} onChange={(e) => setForm({ ...form, bidang: e.target.value })}>
                            <option value="">Pilih Bidang</option>
                            {bidangList.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                          {user.role === Role.STAFF && <Lock size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Nama Paket Pekerjaan</label>
                      <textarea required rows={2} className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50/80 focus:ring-2 focus:ring-blue-500 outline-none" value={form.nama_paket} onChange={(e) => setForm({ ...form, nama_paket: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Satuan Kerja</label>
                        <input type="text" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-100" value={form.satuan_kerja} readOnly />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Metode</label>
                        <input type="text" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-100" value={form.metode_pengadaan} readOnly />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Sumber Dana</label>
                        <input type="text" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-100" value={form.sumber_dana} readOnly />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-5">
                      <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-2"><Info size={14} /> Detail Anggaran</h3>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Pagu Anggaran (Rp)</label>
                          <input type="number" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-bold bg-slate-100" value={form.pagu} readOnly />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Nilai Kontrak (Rp)</label>
                          <input type="number" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-blue-700" value={form.kontrak_nilai} onChange={(e) => setForm({ ...form, kontrak_nilai: Number(e.target.value) })} />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-5">
                      <h3 className="text-xs font-bold text-amber-600 uppercase tracking-widest flex items-center gap-2"><CheckCircle2 size={14} /> Informasi Kontrak</h3>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Penyedia / Rekanan</label>
                          <input type="text" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm" placeholder="Nama Perusahaan" value={form.penyedia} onChange={(e) => setForm({ ...form, penyedia: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Tanggal Kontrak</label>
                          <input type="date" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm" value={form.kontrak_tanggal} onChange={(e) => setForm({ ...form, kontrak_tanggal: e.target.value })} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-4 space-y-6">
                   <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-5">
                    <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Realisasi & Progres</h3>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Realisasi Keuangan (Rp)</label>
                        <input type="number" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-bold text-emerald-600" value={form.realisasi_keuangan} onChange={(e) => setForm({ ...form, realisasi_keuangan: Number(e.target.value) })} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Fisik Rencana %</label>
                          <input type="number" max="100" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm" value={form.fisik_rencana} onChange={(e) => setForm({ ...form, fisik_rencana: Number(e.target.value) })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Fisik Realisasi %</label>
                          <input type="number" max="100" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-bold text-blue-600" value={form.fisik_realisasi} onChange={(e) => setForm({ ...form, fisik_realisasi: Number(e.target.value) })} />
                        </div>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-slate-200 space-y-4">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pencairan (SP2D)</h4>
                      <div className="space-y-3">
                        <input type="text" placeholder="Nomor SP2D" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm" value={form.nomor_sp2d} onChange={(e) => setForm({ ...form, nomor_sp2d: e.target.value })} />
                        <input type="date" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm" value={form.tgl_sp2d} onChange={(e) => setForm({ ...form, tgl_sp2d: e.target.value })} />
                      </div>
                    </div>
                   </div>
                   <div className="p-5 bg-slate-900 rounded-2xl text-white shadow-xl">
                      <p className="text-[9px] font-black uppercase opacity-60 mb-4 tracking-[0.2em]">Live Validation</p>
                      <div className="space-y-4">
                        <div className="flex justify-between items-end border-b border-slate-800 pb-3">
                          <span className="text-[10px] font-bold opacity-70 italic">Sisa Anggaran:</span>
                          <span className="text-sm font-mono font-bold">Rp {(form.pagu - form.realisasi_keuangan).toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between items-end">
                          <span className="text-[10px] font-bold opacity-70 italic">Deviasi Fisik:</span>
                          <span className={`text-sm font-mono font-bold ${(form.fisik_realisasi - form.fisik_rencana) < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {(form.fisik_realisasi - form.fisik_rencana).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                   </div>
                </div>
              </div>
              <div className="mt-10 pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all">Batal</button>
                <button type="submit" className="px-10 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xl shadow-blue-500/20 transition-all flex items-center gap-2">
                  <CheckCircle2 size={18} /> Simpan Realisasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModulPBJ;
