
import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Trash2, 
  X, 
  CheckCircle2, 
  Library,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { ReferensiRUP, Modul, Role } from '../types';
import { dbService } from '../services/dbService';

const ReferensiRUPManager: React.FC<{ userRole: Role }> = ({ userRole }) => {
  const [data, setData] = useState<ReferensiRUP[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [rupToDelete, setRupToDelete] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAdmin = userRole === Role.ADMIN;

  const initialForm: ReferensiRUP = {
    kode_rup: '',
    nama_paket: '',
    pagu: 0,
    jenis_pengadaan: Modul.PENYEDIA,
    satuan_kerja: '',
    metode_pengadaan: '',
    sumber_dana: ''
  };
  const [form, setForm] = useState<ReferensiRUP>(initialForm);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await dbService.getReferensiRUP();
      setData(res);
    } catch (err) {
      console.error("Error loading RUP:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dbService.addReferensiRUP(form);
      setIsModalOpen(false);
      setForm(initialForm);
      await loadData();
    } catch (err) {
      alert("Gagal menyimpan data RUP: " + (err as any).message);
    }
  };

  const triggerRupDelete = (id: number | undefined) => {
    if (!id) return;
    setRupToDelete(id);
    setIsDeleteConfirmOpen(true);
  };

  const confirmRupDelete = async () => {
    if (!rupToDelete) return;
    setIsDeleting(true);
    try {
      await dbService.deleteReferensiRUP(rupToDelete);
      setData(prev => prev.filter(item => item.id !== rupToDelete));
      setIsDeleteConfirmOpen(false);
      setRupToDelete(null);
      await loadData();
    } catch (err) {
      console.error("Delete RUP Error:", err);
      alert("Gagal menghapus referensi RUP.");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredData = data.filter(item => {
    return (item.nama_paket.toLowerCase().includes(searchTerm.toLowerCase()) || 
            item.kode_rup.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Cari RUP atau nama paket..."
            className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm w-64 md:w-80 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {isAdmin && (
          <button 
            onClick={() => { setForm(initialForm); setIsModalOpen(true); }}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-md active:scale-95 transition-all"
          >
            <Plus size={18} />
            Tambah RUP
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Kode RUP</th>
                <th className="px-6 py-4">Paket Pekerjaan</th>
                <th className="px-6 py-4">Tipe</th>
                <th className="px-6 py-4 text-right">Nilai Pagu (Rp)</th>
                {isAdmin && <th className="px-6 py-4 text-center">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr><td colSpan={isAdmin ? 5 : 4} className="px-6 py-24 text-center text-slate-300 italic">Memuat database RUP...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan={isAdmin ? 5 : 4} className="px-6 py-24 text-center text-slate-300 italic">Belum ada data referensi RUP di database.</td></tr>
              ) : filteredData.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 font-mono font-bold text-blue-600">{item.kode_rup}</td>
                  <td className="px-6 py-4 font-bold text-slate-800">{item.nama_paket}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${item.jenis_pengadaan === Modul.SWAKELOLA ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
                      {item.jenis_pengadaan}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-slate-700">
                    {item.pagu.toLocaleString('id-ID')}
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => triggerRupDelete(item.id)} 
                          className={`p-2 rounded-lg transition-all text-slate-400 hover:text-red-600 hover:bg-red-50`} 
                          title="Hapus Referensi"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal for RUP Delete */}
      {isAdmin && isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 p-8 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
               <AlertTriangle size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Hapus RUP</h3>
            <p className="text-sm text-slate-500 mb-8 px-4">Apakah Anda yakin ingin menghapus referensi RUP ini? Laporan yang menggunakan kode ini mungkin akan kehilangan data nama paket.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="flex-1 py-3 text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all"
              >
                Batal
              </button>
              <button 
                onClick={confirmRupDelete}
                disabled={isDeleting}
                className="flex-1 py-3 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-2xl shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2"
              >
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isAdmin && isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3 text-blue-600">
                <Library size={24} />
                <h2 className="text-xl font-bold">Tambah Referensi RUP</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-200 rounded-full"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSave} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kode RUP</label>
                  <input type="text" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.kode_rup} onChange={(e) => setForm({ ...form, kode_rup: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Jenis Pengadaan</label>
                  <select required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" value={form.jenis_pengadaan} onChange={(e) => setForm({ ...form, jenis_pengadaan: e.target.value as Modul })}>
                    <option value={Modul.PENYEDIA}>Penyedia</option>
                    <option value={Modul.SWAKELOLA}>Swakelola</option>
                  </select>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nama Paket Pekerjaan</label>
                  <textarea required rows={2} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={form.nama_paket} onChange={(e) => setForm({ ...form, nama_paket: e.target.value })} />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nilai Pagu (Rp)</label>
                  <input type="number" required className="w-full p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm font-bold text-blue-700 outline-none" value={form.pagu} onChange={(e) => setForm({ ...form, pagu: Number(e.target.value) })} />
                </div>
              </div>
              <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all">Batal</button>
                <button type="submit" className="px-8 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl shadow-lg transition-all active:scale-95">
                  <CheckCircle2 className="inline mr-2" size={18} /> Simpan RUP
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReferensiRUPManager;
