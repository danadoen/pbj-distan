
import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Download, Edit, Trash2, CheckCircle2, X, Database, Zap, Info, Check, Lock, Loader2, AlertTriangle
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
    // Logic for excel remains same as before but uses filtered data
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(filteredData);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Realisasi");
    XLSX.writeFile(workbook, `Laporan_${type}_2026.xlsx`);
  };

  return (
    <div className="space-y-4 px-2 md:px-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Cari paket..." className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          {user.role === Role.ADMIN && (
            <select className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 shadow-sm" value={filterBidang} onChange={(e) => setFilterBidang(e.target.value)}>
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
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-tighter text-slate-400">
              <tr>
                <th rowSpan={2} className="px-4 py-4 border-b border-slate-100 text-center w-12">No</th>
                <th rowSpan={2} className="px-4 py-4 border-b border-slate-100">Paket & RUP</th>
                <th colSpan={3} className="px-4 py-2 border-b border-slate-100 text-center bg-blue-50/30 text-blue-700">Anggaran (Rp)</th>
                <th colSpan={3} className="px-4 py-2 border-b border-slate-100 text-center bg-emerald-50/30 text-emerald-700">Realisasi Keuangan</th>
                <th colSpan={3} className="px-4 py-2 border-b border-slate-100 text-center bg-amber-50/30 text-amber-700">Fisik (%)</th>
                <th rowSpan={2} className="px-4 py-4 border-b border-slate-100 text-center">Aksi</th>
              </tr>
              <tr>
                <th className="px-4 py-2 border-b border-slate-100">Pagu</th>
                <th className="px-4 py-2 border-b border-slate-100">HPS</th>
                <th className="px-4 py-2 border-b border-slate-100">Kontrak</th>
                <th className="px-4 py-2 border-b border-slate-100">Realisasi</th>
                <th className="px-4 py-2 border-b border-slate-100">Sisa</th>
                <th className="px-4 py-2 border-b border-slate-100">%</th>
                <th className="px-4 py-2 border-b border-slate-100">Rencana</th>
                <th className="px-4 py-2 border-b border-slate-100">Realisasi</th>
                <th className="px-4 py-2 border-b border-slate-100">Deviasi</th>
              </tr>
            </thead>
            <tbody className="text-[11px] divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={13} className="px-4 py-20 text-center text-slate-300 italic">Sinkronisasi data...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan={13} className="px-4 py-20 text-center text-slate-300 italic italic">Tidak ditemukan data realisasi.</td></tr>
              ) : filteredData.map((item, idx) => {
                // LOGIKA WARNA DEVIASI (Rencana - Realisasi)
                // Jika positif (+), artinya rencana > realisasi = TERLAMBAT (MERAH)
                const isLate = (Number(item.fisik_rencana) - Number(item.fisik_realisasi)) > 0;
                const devVal = (Number(item.fisik_rencana) - Number(item.fisik_realisasi)).toFixed(1);

                return (
                  <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-4 py-4 text-center text-slate-400 font-bold">{idx + 1}</td>
                    <td className="px-4 py-4">
                      <div className="font-bold text-slate-800 line-clamp-1 group-hover:line-clamp-none max-w-xs">{item.nama_paket}</div>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-1 rounded">{item.kode_rup}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{item.bidang}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 font-mono">{item.pagu.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-4 font-mono text-slate-400">{item.hps.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-4 font-mono font-bold text-slate-600">{item.kontrak_nilai.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-4 font-mono font-black text-emerald-600">{item.realisasi_keuangan.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-4 font-mono text-rose-500">{item.sisa_kontrak?.toLocaleString('id-ID')}</td>
                    <td className="px-4 py-4 font-black text-slate-700">{item.persen_keuangan?.toFixed(1)}%</td>
                    <td className="px-4 py-4 text-center font-bold text-slate-400">{item.fisik_rencana}%</td>
                    <td className="px-4 py-4 text-center font-black text-blue-600">{item.fisik_realisasi}%</td>
                    <td className="px-4 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full font-black ${isLate ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {isLate ? `+${devVal}` : devVal}%
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => { setForm(item); setEditingItem(item); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Edit size={14} /></button>
                        <button onClick={() => triggerDelete(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={14} /></button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{editingItem ? 'Edit Data' : 'Tambah Realisasi'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <div className="space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                       <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Integrasi RUP</label>
                       <div className="flex gap-2">
                          <input type="text" placeholder="Kode RUP" className={`flex-1 p-3 border rounded-2xl text-sm font-mono focus:ring-4 focus:ring-blue-500/10 outline-none ${lookupError ? 'border-rose-300 bg-rose-50' : lookupSuccess ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`} value={form.kode_rup} onChange={(e) => setForm({ ...form, kode_rup: e.target.value })} />
                          <button type="button" onClick={manualRUPLookup} className="p-3 bg-slate-900 text-white rounded-2xl hover:bg-blue-600 transition-all shadow-lg active:scale-95"><Zap size={18} /></button>
                       </div>
                       <textarea rows={2} placeholder="Nama Paket Pekerjaan" className="w-full p-3 border border-slate-200 rounded-2xl text-sm font-bold bg-white focus:ring-4 focus:ring-blue-500/10 outline-none" value={form.nama_paket} onChange={(e) => setForm({ ...form, nama_paket: e.target.value })} />
                       <div className="grid grid-cols-2 gap-4">
                          <input type="number" placeholder="Nilai Pagu" className="w-full p-3 border border-slate-200 rounded-2xl text-sm font-mono bg-slate-50" value={form.pagu} readOnly />
                          <input type="text" placeholder="Bidang" className="w-full p-3 border border-slate-200 rounded-2xl text-sm font-black bg-blue-50 text-blue-700" value={form.bidang} readOnly />
                       </div>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                       <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Data Kontrak</label>
                       <input type="text" placeholder="Penyedia / Pelaksana" className="w-full p-3 border border-slate-200 rounded-2xl text-sm" value={form.penyedia} onChange={(e) => setForm({ ...form, penyedia: e.target.value })} />
                       <div className="grid grid-cols-2 gap-4">
                          <input type="number" placeholder="Nilai Kontrak" className="w-full p-3 border border-slate-200 rounded-2xl text-sm font-bold text-blue-700" value={form.kontrak_nilai} onChange={(e) => setForm({ ...form, kontrak_nilai: Number(e.target.value) })} />
                          <input type="date" className="w-full p-3 border border-slate-200 rounded-2xl text-sm" value={form.kontrak_tanggal} onChange={(e) => setForm({ ...form, kontrak_tanggal: e.target.value })} />
                       </div>
                    </div>
                 </div>
                 <div className="space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                       <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Realisasi & Progres</label>
                       <input type="number" placeholder="Realisasi Keuangan (Rp)" className="w-full p-3 border border-slate-200 rounded-2xl text-sm font-black text-emerald-600" value={form.realisasi_keuangan} onChange={(e) => setForm({ ...form, realisasi_keuangan: Number(e.target.value) })} />
                       <div className="grid grid-cols-2 gap-4">
                          <div>
                             <label className="text-[9px] font-bold text-slate-400 uppercase ml-2 mb-1 block">Fisik Rencana %</label>
                             <input type="number" step="0.1" className="w-full p-3 border border-slate-200 rounded-2xl text-sm font-bold" value={form.fisik_rencana} onChange={(e) => setForm({ ...form, fisik_rencana: Number(e.target.value) })} />
                          </div>
                          <div>
                             <label className="text-[9px] font-bold text-slate-400 uppercase ml-2 mb-1 block">Fisik Realisasi %</label>
                             <input type="number" step="0.1" className="w-full p-3 border border-slate-200 rounded-2xl text-sm font-black text-blue-600" value={form.fisik_realisasi} onChange={(e) => setForm({ ...form, fisik_realisasi: Number(e.target.value) })} />
                          </div>
                       </div>
                       <div className="p-3 bg-slate-900 rounded-2xl text-white flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase opacity-60">Live Deviasi</span>
                          <span className={`text-sm font-black ${(form.fisik_rencana - form.fisik_realisasi) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                             {((form.fisik_rencana - form.fisik_realisasi)).toFixed(1)}%
                          </span>
                       </div>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                       <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Pembayaran (SP2D)</label>
                       <input type="text" placeholder="Nomor SP2D" className="w-full p-3 border border-slate-200 rounded-2xl text-sm" value={form.nomor_sp2d} onChange={(e) => setForm({ ...form, nomor_sp2d: e.target.value })} />
                       <input type="date" className="w-full p-3 border border-slate-200 rounded-2xl text-sm" value={form.tgl_sp2d} onChange={(e) => setForm({ ...form, tgl_sp2d: e.target.value })} />
                    </div>
                    <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-3xl font-black text-sm hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2">
                       <CheckCircle2 size={18} /> Simpan Laporan
                    </button>
                 </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModulPBJ;
