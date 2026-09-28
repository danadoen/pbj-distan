
import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Download, Edit, Trash2, CheckCircle2, X, Zap, Loader2, AlertTriangle
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
      'Pagu Anggaran (Rp)': item.pagu,
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Realisasi");
    XLSX.writeFile(workbook, `Laporan_${type}_2026.xlsx`);
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
        <div className="flex items-center gap-2">
          <button onClick={exportToExcel} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 bg-white rounded-xl text-xs font-bold hover:bg-slate-50 shadow-sm transition-all"><Download size={14} /> Export Excel</button>
          <button onClick={() => { setForm(initialForm); setEditingItem(null); setIsModalOpen(true); }} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all"><Plus size={14} /> Tambah Data</button>
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
                               <input type="number" className="w-full p-4 border border-slate-100 rounded-2xl text-sm font-black text-slate-500 bg-slate-100 outline-none" value={form.pagu} readOnly tabIndex={-1} />
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
