
import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Download, Edit, Trash2, CheckCircle2, X, Zap, Loader2, AlertTriangle, Info
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

  const filteredData = data.filter(item => {
    const matchesSearch = (item.nama_paket?.toLowerCase() || "").includes(searchTerm.toLowerCase()) || 
                          (item.kode_rup?.toLowerCase() || "").includes(searchTerm.toLowerCase());
    const matchesBidang = user.role === Role.ADMIN ? (filterBidang === '' || item.bidang === filterBidang) : true;
    return matchesSearch && matchesBidang;
  });

  const exportToExcel = () => {
    const exportData = filteredData.map((item, idx) => ({
      'No': idx + 1,
      'Nama Paket': item.nama_paket,
      'Kode RUP': item.kode_rup,
      'HPS (Rp)': item.hps,
      'Nomor Kontrak': item.kontrak_nomor,
      'Nilai Kontrak (Rp)': item.kontrak_nilai,
      'Tanggal Kontrak': item.kontrak_tanggal,
      'Penyedia': item.penyedia,
      'Realisasi Keuangan (Rp)': item.realisasi_keuangan,
      'Persen Keuangan (%)': (item.kontrak_nilai > 0 ? (item.realisasi_keuangan / item.kontrak_nilai) * 100 : 0).toFixed(2),
      'Fisik Rencana (%)': item.fisik_rencana,
      'Fisik Realisasi (%)': item.fisik_realisasi,
      'Deviasi Fisik (%)': (Number(item.fisik_rencana) - Number(item.fisik_realisasi)).toFixed(2),
      'Nomor SP2D': item.nomor_sp2d,
      'Tanggal SP2D': item.tgl_sp2d,
      'Sisa Kontrak (Rp)': Number(item.kontrak_nilai) - Number(item.realisasi_keuangan),
      'Bidang': item.bidang
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Realisasi");
    XLSX.writeFile(workbook, `Laporan_${type}_2026.xlsx`);
  };

  const sp2dHeader = type === Modul.PENYEDIA ? "SP2D/KUITANSI" : "SP2D";

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
        <div className="flex items-center gap-2">
          <button onClick={exportToExcel} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 bg-white rounded-xl text-xs font-bold hover:bg-slate-50 shadow-sm transition-all"><Download size={14} /> Excel</button>
          <button onClick={() => { setForm(initialForm); setEditingItem(null); setIsModalOpen(true); }} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all"><Plus size={14} /> Tambah</button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left border-collapse min-w-[1500px]">
            <thead className="bg-slate-50 text-[9px] uppercase font-black tracking-tighter text-slate-500">
              <tr>
                <th rowSpan={2} className="px-3 py-4 border-b border-slate-100 text-center w-10">No</th>
                <th rowSpan={2} className="px-3 py-4 border-b border-slate-100 min-w-[200px]">Paket & RUP</th>
                <th rowSpan={2} className="px-3 py-4 border-b border-slate-100 text-center">HPS (Rp)</th>
                <th colSpan={4} className="px-3 py-2 border-b border-slate-100 text-center bg-blue-50/50">Data Kontrak</th>
                <th colSpan={2} className="px-3 py-2 border-b border-slate-100 text-center bg-emerald-50/50">Keuangan</th>
                <th colSpan={3} className="px-3 py-2 border-b border-slate-100 text-center bg-amber-50/50">Fisik</th>
                <th colSpan={2} className="px-3 py-2 border-b border-slate-100 text-center bg-slate-100/50">{sp2dHeader}</th>
                <th rowSpan={2} className="px-3 py-4 border-b border-slate-100 text-center">Sisa Kontrak</th>
                <th rowSpan={2} className="px-3 py-4 border-b border-slate-100 text-center">Bidang</th>
                <th rowSpan={2} className="px-3 py-4 border-b border-slate-100 text-center">Aksi</th>
              </tr>
              <tr>
                <th className="px-2 py-2 border-b border-slate-100 text-[8px] bg-blue-50/20">Nomor</th>
                <th className="px-2 py-2 border-b border-slate-100 text-[8px] bg-blue-50/20">Nilai (Rp)</th>
                <th className="px-2 py-2 border-b border-slate-100 text-[8px] bg-blue-50/20">Tgl/Masa</th>
                <th className="px-2 py-2 border-b border-slate-100 text-[8px] bg-blue-50/20">Penyedia</th>
                <th className="px-2 py-2 border-b border-slate-100 text-[8px] bg-emerald-50/20">Realisasi (Rp)</th>
                <th className="px-2 py-2 border-b border-slate-100 text-[8px] bg-emerald-50/20">%</th>
                <th className="px-2 py-2 border-b border-slate-100 text-[8px] bg-amber-50/20">Rencana (%)</th>
                <th className="px-2 py-2 border-b border-slate-100 text-[8px] bg-amber-50/20">Realisasi (%)</th>
                <th className="px-2 py-2 border-b border-slate-100 text-[8px] bg-amber-50/20">Deviasi (%)</th>
                <th className="px-2 py-2 border-b border-slate-100 text-[8px] bg-slate-100/20">Nomor</th>
                <th className="px-2 py-2 border-b border-slate-100 text-[8px] bg-slate-100/20">Tgl</th>
              </tr>
            </thead>
            <tbody className="text-[10px] divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={18} className="px-4 py-20 text-center text-slate-300 italic">Sinkronisasi data...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan={18} className="px-4 py-20 text-center text-slate-300 italic">Tidak ditemukan data realisasi.</td></tr>
              ) : filteredData.map((item, idx) => {
                const sisaKontrak = Number(item.kontrak_nilai) - Number(item.realisasi_keuangan);
                const persenKeu = item.kontrak_nilai > 0 ? (item.realisasi_keuangan / item.kontrak_nilai) * 100 : 0;
                const deviasi = Number(item.fisik_rencana) - Number(item.fisik_realisasi);
                const isLate = deviasi > 0;

                return (
                  <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-3 py-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                    <td className="px-3 py-3">
                      <div className="font-bold text-slate-800 line-clamp-1 group-hover:line-clamp-none">{item.nama_paket}</div>
                      <div className="text-[8px] font-black text-blue-600 mt-0.5">{item.kode_rup}</div>
                    </td>
                    <td className="px-3 py-3 font-mono text-center">{item.hps.toLocaleString('id-ID')}</td>
                    <td className="px-2 py-3 truncate max-w-[80px]">{item.kontrak_nomor || '-'}</td>
                    <td className="px-2 py-3 font-mono font-bold text-blue-700">{item.kontrak_nilai.toLocaleString('id-ID')}</td>
                    <td className="px-2 py-3 text-center">{item.kontrak_tanggal || '-'}</td>
                    <td className="px-2 py-3 truncate max-w-[100px]">{item.penyedia || '-'}</td>
                    <td className="px-2 py-3 font-mono font-black text-emerald-600">{item.realisasi_keuangan.toLocaleString('id-ID')}</td>
                    <td className="px-2 py-3 text-center font-bold">{persenKeu.toFixed(1)}%</td>
                    <td className="px-2 py-3 text-center text-slate-400">{item.fisik_rencana}%</td>
                    <td className="px-2 py-3 text-center font-black text-blue-600">{item.fisik_realisasi}%</td>
                    <td className="px-2 py-3 text-center">
                      <span className={`font-black ${isLate ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {isLate ? `+${deviasi.toFixed(1)}` : deviasi.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-2 py-3 truncate max-w-[80px]">{item.nomor_sp2d || '-'}</td>
                    <td className="px-2 py-3 text-center">{item.tgl_sp2d || '-'}</td>
                    <td className="px-3 py-3 font-mono text-right text-rose-500 font-bold">{sisaKontrak.toLocaleString('id-ID')}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-black text-[8px]">{item.bidang}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => { setForm(item); setEditingItem(item); setIsModalOpen(true); }} className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"><Edit size={12} /></button>
                        <button onClick={() => triggerDelete(item.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-w-5xl my-auto shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{editingItem ? 'Edit Data Realisasi' : 'Input Realisasi Baru'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="p-8 bg-slate-50/30">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 {/* Kolom 1: Informasi Paket */}
                 <div className="space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                       <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Integrasi RUP & Pagu</label>
                       <div className="flex gap-2">
                          <input type="text" placeholder="Kode RUP" className={`flex-1 p-3 border rounded-2xl text-sm font-mono focus:ring-4 focus:ring-blue-500/10 outline-none ${lookupError ? 'border-rose-300 bg-rose-50' : lookupSuccess ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`} value={form.kode_rup} onChange={(e) => setForm({ ...form, kode_rup: e.target.value })} />
                          <button type="button" onClick={manualRUPLookup} className="p-3 bg-slate-900 text-white rounded-2xl hover:bg-blue-600 transition-all active:scale-95"><Zap size={18} /></button>
                       </div>
                       <textarea rows={3} placeholder="Nama Paket Pekerjaan" className="w-full p-3 border border-slate-200 rounded-2xl text-sm font-bold bg-white focus:ring-4 focus:ring-blue-500/10 outline-none" value={form.nama_paket} onChange={(e) => setForm({ ...form, nama_paket: e.target.value })} />
                       <div className="space-y-4">
                          <div>
                             <label className="text-[9px] font-bold text-slate-400 uppercase ml-2 mb-1 block">Nilai Pagu (Rp)</label>
                             <input type="number" className="w-full p-3 border border-slate-100 rounded-2xl text-sm font-mono bg-slate-50 outline-none" value={form.pagu} readOnly />
                          </div>
                          <div>
                             <label className="text-[9px] font-bold text-blue-600 uppercase ml-2 mb-1 block">HPS (Rp)</label>
                             <input type="number" placeholder="Input HPS" className="w-full p-3 border border-blue-100 rounded-2xl text-sm font-bold text-blue-700 bg-blue-50/20 outline-none focus:ring-4 focus:ring-blue-500/10" value={form.hps} onChange={(e) => setForm({ ...form, hps: Number(e.target.value) })} />
                          </div>
                          <div>
                             <label className="text-[9px] font-black text-rose-500 uppercase ml-2 mb-1 block">Pilih Bidang Pengampu</label>
                             <select 
                               className="w-full p-3 border border-rose-100 rounded-2xl text-sm font-black text-rose-600 bg-rose-50/20 outline-none focus:ring-4 focus:ring-rose-500/10" 
                               value={form.bidang} 
                               onChange={(e) => setForm({ ...form, bidang: e.target.value })}
                               required
                             >
                                <option value="">-- PILIH BIDANG --</option>
                                {bidangList.map(b => <option key={b} value={b}>{b}</option>)}
                             </select>
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* Kolom 2: Data Kontrak */}
                 <div className="space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                       <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Data Kontrak / Pelaksanaan</label>
                       <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase ml-2 mb-1 block">Nomor Kontrak</label>
                          <input type="text" placeholder="Masukkan nomor kontrak" className="w-full p-3 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-4 focus:ring-blue-500/10" value={form.kontrak_nomor} onChange={(e) => setForm({ ...form, kontrak_nomor: e.target.value })} />
                       </div>
                       <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase ml-2 mb-1 block">Nilai Kontrak (Rp)</label>
                          <input type="number" placeholder="Input Nilai Kontrak" className="w-full p-3 border border-slate-200 rounded-2xl text-sm font-black text-blue-700 outline-none focus:ring-4 focus:ring-blue-500/10" value={form.kontrak_nilai} onChange={(e) => setForm({ ...form, kontrak_nilai: Number(e.target.value) })} />
                       </div>
                       <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase ml-2 mb-1 block">Tanggal / Masa Pelaksanaan</label>
                          <input type="text" placeholder="Contoh: 15 Mei 2026 atau 120 HK" className="w-full p-3 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-blue-500/10" value={form.kontrak_tanggal} onChange={(e) => setForm({ ...form, kontrak_tanggal: e.target.value })} />
                       </div>
                       <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase ml-2 mb-1 block">Penyedia (PT, CV, UD, dll)</label>
                          <input type="text" placeholder="Nama Perusahaan / Pelaksana" className="w-full p-3 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10" value={form.penyedia} onChange={(e) => setForm({ ...form, penyedia: e.target.value })} />
                       </div>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                       <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Sisa Kontrak (Otomatis)</label>
                       <div className="p-4 bg-slate-900 rounded-2xl text-white flex justify-between items-center shadow-inner">
                          <span className="text-[10px] font-bold uppercase opacity-60">Sisa Anggaran</span>
                          <span className="text-sm font-black text-rose-400">Rp {(form.kontrak_nilai - form.realisasi_keuangan).toLocaleString('id-ID')}</span>
                       </div>
                    </div>
                 </div>

                 {/* Kolom 3: Keuangan & Fisik & SP2D */}
                 <div className="space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                       <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Keuangan & Fisik (%)</label>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2">
                             <label className="text-[9px] font-bold text-emerald-600 uppercase ml-2 mb-1 block">Realisasi Keuangan (Rp)</label>
                             <input type="number" placeholder="Input Realisasi Rp" className="w-full p-3 border border-emerald-100 rounded-2xl text-sm font-black text-emerald-700 bg-emerald-50/10 outline-none focus:ring-4 focus:ring-emerald-500/10" value={form.realisasi_keuangan} onChange={(e) => setForm({ ...form, realisasi_keuangan: Number(e.target.value) })} />
                          </div>
                          <div>
                             <label className="text-[9px] font-bold text-slate-400 uppercase ml-2 mb-1 block">Fisik Rencana (%)</label>
                             <input type="number" step="0.1" className="w-full p-3 border border-slate-200 rounded-2xl text-sm font-bold outline-none" value={form.fisik_rencana} onChange={(e) => setForm({ ...form, fisik_rencana: Number(e.target.value) })} />
                          </div>
                          <div>
                             <label className="text-[9px] font-bold text-blue-600 uppercase ml-2 mb-1 block">Fisik Realisasi (%)</label>
                             <input type="number" step="0.1" className="w-full p-3 border border-blue-100 rounded-2xl text-sm font-black text-blue-700 bg-blue-50/10 outline-none" value={form.fisik_realisasi} onChange={(e) => setForm({ ...form, fisik_realisasi: Number(e.target.value) })} />
                          </div>
                       </div>
                    </div>
                    
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                       <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Data SP2D / Kuitansi</label>
                       <div className="grid grid-cols-2 gap-4">
                         <div className="col-span-2">
                            <label className="text-[9px] font-bold text-slate-400 uppercase ml-2 mb-1 block">Nomor SP2D</label>
                            <input type="text" placeholder="Masukkan nomor SP2D" className="w-full p-3 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-blue-500/10" value={form.nomor_sp2d} onChange={(e) => setForm({ ...form, nomor_sp2d: e.target.value })} />
                         </div>
                         <div className="col-span-2">
                            <label className="text-[9px] font-bold text-slate-400 uppercase ml-2 mb-1 block">Tanggal SP2D</label>
                            <input type="text" placeholder="Format: Tgl/Bln/Thn" className="w-full p-3 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-blue-500/10" value={form.tgl_sp2d} onChange={(e) => setForm({ ...form, tgl_sp2d: e.target.value })} />
                         </div>
                       </div>
                    </div>

                    <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-3xl font-black text-sm hover:bg-blue-700 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2">
                       <CheckCircle2 size={18} /> Simpan Data Realisasi
                    </button>
                 </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm p-8 text-center shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
               <AlertTriangle size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Hapus Data Realisasi</h3>
            <p className="text-sm text-slate-500 mb-8 px-4">Apakah Anda yakin ingin menghapus data realisasi ini? Tindakan ini tidak dapat dibatalkan.</p>
            <div className="flex gap-3">
              <button onClick={() => setIsDeleteConfirmOpen(false)} className="flex-1 py-3 text-sm font-bold text-slate-500 bg-slate-100 rounded-2xl">Batal</button>
              <button onClick={confirmDelete} disabled={isDeleting} className="flex-1 py-3 text-sm font-bold text-white bg-red-600 rounded-2xl shadow-lg">
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
