
import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Upload, 
  Trash2,
  CheckCircle2,
  Info,
  X,
  UserPlus,
  ClipboardPaste,
  Table,
  Save,
  Trash,
  Edit,
  ShoppingCart,
  FileText,
  Eye,
  EyeOff,
  Loader2,
  AlertTriangle,
  Layers,
  Plus,
  Check
} from 'lucide-react';
import { User, ReferensiRUP, Role, Modul } from '../types';
import { dbService } from '../services/dbService';

const Pengaturan: React.FC<{ currentUserRole: Role }> = ({ currentUserRole }) => {
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'import' | 'bidang'>('users');
  const [importModul, setImportModul] = useState<Modul>(Modul.PENYEDIA);
  const [users, setUsers] = useState<User[]>([]);
  const [bidangList, setBidangList] = useState<string[]>([]);
  const [referensi, setReferensi] = useState<ReferensiRUP[]>([]);
  
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<number | null>(null);
  
  const [isBidangDeleteConfirmOpen, setIsBidangDeleteConfirmOpen] = useState(false);
  const [bidangToDelete, setBidangToDelete] = useState<string | null>(null);
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  const [userForm, setUserForm] = useState<{ username: string, password: string, role: Role, bidang?: string }>({ 
    username: '', 
    password: '',
    role: Role.STAFF, 
    bidang: '' 
  });

  const [newBidang, setNewBidang] = useState('');
  const [bulkBidang, setBulkBidang] = useState('');
  const [isAddingBidang, setIsAddingBidang] = useState(false);
  const [isAddingBulk, setIsAddingBulk] = useState(false);

  const [pasteContent, setPasteContent] = useState('');
  const [parsedData, setParsedData] = useState<ReferensiRUP[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [u, b, r] = await Promise.all([
        dbService.getUsers(),
        dbService.getBidang(),
        dbService.getReferensiRUP()
      ]);
      setUsers(u);
      setBidangList(b);
      setReferensi(r);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUserSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await dbService.updateUser({ ...editingUser, ...userForm });
      } else {
        await dbService.addUser(userForm);
      }
      setIsUserModalOpen(false);
      setEditingUser(null);
      setUserForm({ username: '', password: '', role: Role.STAFF, bidang: '' });
      await loadData();
    } catch (err) {
      alert("Gagal menyimpan pengguna: " + (err as any).message);
    }
  };

  const triggerUserDelete = (id: number) => {
    setUserToDelete(id);
    setIsDeleteConfirmOpen(true);
  };

  const confirmUserDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      await dbService.deleteUser(userToDelete);
      setUsers(prev => prev.filter(u => u.id !== userToDelete));
      setIsDeleteConfirmOpen(false);
      setUserToDelete(null);
      await loadData();
    } catch (err) {
      alert("Gagal menghapus pengguna: " + (err as any).message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddBidang = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBidang.trim()) return;
    setIsAddingBidang(true);
    try {
      await dbService.addBidang(newBidang.trim().toUpperCase());
      setNewBidang('');
      await loadData();
    } catch (err) {
      alert("Gagal menambah bidang: " + (err as any).message);
    } finally {
      setIsAddingBidang(false);
    }
  };

  const handleAddBulkBidang = async () => {
    if (!bulkBidang.trim()) return;
    setIsAddingBulk(true);
    try {
      const list = bulkBidang.split(/[,\n]/).map(b => b.trim()).filter(b => b !== "");
      if (list.length > 0) {
        await dbService.addBidangBulk(list);
        setBulkBidang('');
        alert(`Berhasil menambahkan ${list.length} bidang.`);
        await loadData();
      }
    } catch (err) {
      alert("Gagal menambah bidang masal: " + (err as any).message);
    } finally {
      setIsAddingBulk(false);
    }
  };

  const triggerBidangDelete = (nama: string) => {
    setBidangToDelete(nama);
    setIsBidangDeleteConfirmOpen(true);
  };

  const confirmBidangDelete = async () => {
    if (!bidangToDelete) return;
    setIsDeleting(true);
    try {
      await dbService.deleteBidang(bidangToDelete);
      setIsBidangDeleteConfirmOpen(false);
      setBidangToDelete(null);
      await loadData();
    } catch (err) {
      alert("Gagal menghapus bidang. Pastikan tidak ada data yang terkait.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleProcessPaste = () => {
    if (!pasteContent.trim()) {
      alert("Silakan tempel data dari Excel terlebih dahulu.");
      return;
    }
    setIsProcessing(true);
    try {
      const rows = pasteContent.trim().split('\n');
      const results: ReferensiRUP[] = [];
      rows.forEach((row) => {
        const cols = row.split('\t').map(c => c.trim());
        if (!cols[0] || cols[0].toLowerCase().includes('kode')) return;
        if (importModul === Modul.PENYEDIA) {
          if (cols.length >= 7) {
            const rawPagu = cols[6].replace(/[^0-9]/g, '');
            results.push({
              kode_rup: cols[0],
              satuan_kerja: cols[1],
              nama_paket: cols[2],
              metode_pengadaan: cols[3],
              sumber_dana: cols[5],
              pagu: Number(rawPagu) || 0,
              jenis_pengadaan: Modul.PENYEDIA
            });
          }
        } else {
          if (cols.length >= 6) {
            const rawPagu = cols[5].replace(/[^0-9]/g, '');
            results.push({
              kode_rup: cols[0],
              satuan_kerja: cols[1],
              nama_paket: cols[2],
              metode_pengadaan: cols[3],
              sumber_dana: cols[4],
              pagu: Number(rawPagu) || 0,
              jenis_pengadaan: Modul.SWAKELOLA
            });
          }
        }
      });
      if (results.length === 0) {
        alert(`Gagal memproses. Pastikan Anda meng-copy minimal ${importModul === Modul.PENYEDIA ? '7' : '6'} kolom dari Excel.`);
      } else {
        setParsedData(results);
      }
    } catch (err) {
      alert("Gagal memproses data.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (parsedData.length === 0) return;
    try {
      await dbService.importReferensiRUP(parsedData);
      alert(`Berhasil mengimpor ${parsedData.length} data RUP.`);
      setParsedData([]);
      setPasteContent('');
      await loadData();
    } catch (err) {
      alert("Gagal menyimpan ke database.");
    }
  };

  const clearRUPDatabase = async () => {
    if (window.confirm('PERINGATAN: Hapus SELURUH referensi RUP?')) {
      setIsClearing(true);
      try {
        await dbService.clearAllReferensiRUP();
        await loadData();
      } catch (err) {
        alert("Gagal mengosongkan database.");
      } finally {
        setIsClearing(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-1 p-1 bg-slate-200 w-fit rounded-lg mb-4 shadow-inner">
        <button onClick={() => setActiveSubTab('users')} className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-md transition-all ${activeSubTab === 'users' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}><Users size={16} /> Pengguna</button>
        <button onClick={() => setActiveSubTab('bidang')} className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-md transition-all ${activeSubTab === 'bidang' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}><Layers size={16} /> Manajemen Bidang</button>
        <button onClick={() => setActiveSubTab('import')} className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-md transition-all ${activeSubTab === 'import' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}><Upload size={16} /> Bulk Import RUP</button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-8">
        {activeSubTab === 'users' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Manajemen Akun Bidang</h3>
                <p className="text-xs text-slate-400 mt-1">Daftarkan akun staff dan tentukan kata sandi login.</p>
              </div>
              <button 
                onClick={() => { setEditingUser(null); setUserForm({ username: '', password: '', role: Role.STAFF, bidang: '' }); setIsUserModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-md active:scale-95"
              >
                <UserPlus size={16} /> Tambah User Bidang
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-4 border-b">Username</th>
                    <th className="px-4 py-4 border-b">Role</th>
                    <th className="px-4 py-4 border-b">Bidang</th>
                    <th className="px-4 py-4 border-b text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-4 font-bold text-slate-700">{u.username}</td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${u.role === Role.ADMIN ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>{u.role}</span>
                      </td>
                      <td className="px-4 py-4">
                        {u.role === Role.ADMIN ? <span className="text-slate-400 text-xs italic">Semua Bidang</span> : <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">{u.bidang}</span>}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => { setEditingUser(u); setUserForm({ username: u.username, password: u.password || '', role: u.role, bidang: u.bidang || '' }); setIsUserModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all"><Edit size={14} /></button>
                          <button onClick={() => triggerUserDelete(u.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all">
                             <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeSubTab === 'bidang' ? (
          <div className="space-y-8">
             <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Manajemen Daftar Bidang</h3>
                <p className="text-xs text-slate-400 mt-1">Kelola departemen/bidang yang tersedia di sistem.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Tambah Bidang Baru</h4>
                  <form onSubmit={handleAddBidang} className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Contoh: PSP" 
                      className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      value={newBidang}
                      onChange={(e) => setNewBidang(e.target.value)}
                    />
                    <button 
                      type="submit"
                      disabled={isAddingBidang}
                      className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50"
                    >
                      {isAddingBidang ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Tambah
                    </button>
                  </form>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                    <ClipboardPaste size={14} /> Tambah Banyak Bidang Sekaligus
                  </h4>
                  <p className="text-[10px] text-slate-400 mb-4 italic">Pisahkan nama bidang dengan koma (,) atau baris baru.</p>
                  <textarea 
                    rows={4}
                    placeholder="Contoh: Bidang A, Bidang B, Bidang C..."
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 mb-3 font-mono"
                    value={bulkBidang}
                    onChange={(e) => setBulkBidang(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <button 
                      onClick={handleAddBulkBidang}
                      disabled={isAddingBulk || !bulkBidang.trim()}
                      className="px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-blue-600 transition-all disabled:opacity-50"
                    >
                      {isAddingBulk ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Simpan Daftar Bidang
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col h-[500px]">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                   <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Daftar Terdaftar ({bidangList.length})</h4>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-left">
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {bidangList.map(b => (
                        <tr key={b} className="hover:bg-slate-50 group">
                          <td className="px-6 py-4 font-bold text-slate-700 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            {b}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => triggerBidangDelete(b)}
                              className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                              title="Hapus Bidang"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="flex flex-col gap-4">
                  <h3 className="text-lg font-bold flex items-center gap-2"><ClipboardPaste className="text-blue-600" size={20} /> Copy-Paste dari Excel</h3>
                  <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit border border-slate-200">
                    <button onClick={() => { setImportModul(Modul.PENYEDIA); setParsedData([]); }} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${importModul === Modul.PENYEDIA ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}><ShoppingCart size={14} /> Modul Penyedia</button>
                    <button onClick={() => { setImportModul(Modul.SWAKELOLA); setParsedData([]); }} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${importModul === Modul.SWAKELOLA ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}><FileText size={14} /> Modul Swakelola</button>
                  </div>
                </div>
                <textarea className="w-full h-64 p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-[11px] font-mono focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300" placeholder={`Tempel data ${importModul} di sini...`} value={pasteContent} onChange={(e) => setPasteContent(e.target.value)} />
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-2 text-[10px] text-slate-500 font-medium bg-blue-50 p-3 rounded-xl border border-blue-100">
                    <Info className="text-blue-600 shrink-0 mt-0.5" size={14} />
                    <div>
                      <p className="font-bold text-blue-800 mb-1">Urutan Kolom Harus Sesuai Gambar:</p>
                      {importModul === Modul.PENYEDIA ? <p>Kode RUP → Satuan Kerja → Nama Paket → Metode → Jenis Pengadaan → Sumber Dana → Nilai Pagu</p> : <p>Kode RUP → Satuan Kerja → Nama Paket → Metode → Sumber Dana → Nilai Pagu</p>}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button onClick={handleProcessPaste} disabled={isProcessing} className="px-8 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-blue-600 transition-all flex items-center gap-2 shadow-lg active:scale-95 disabled:opacity-50">{isProcessing ? <Loader2 size={16} className="animate-spin" /> : 'Proses Data'}</button>
                  </div>
                </div>
                <div className="pt-8 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-4">Database Management</h4>
                  <button onClick={clearRUPDatabase} disabled={isClearing} className="flex items-center gap-2 px-4 py-2.5 text-red-500 hover:bg-red-50 rounded-xl text-xs font-bold transition-all border border-red-100 disabled:opacity-50">{isClearing ? <Loader2 size={14} className="animate-spin" /> : <Trash size={14} />} Kosongkan Seluruh Referensi RUP</button>
                </div>
              </div>
              <div className="space-y-6 bg-slate-50 rounded-3xl p-6 border border-slate-200 min-h-[400px] flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold flex items-center gap-2 text-slate-700"><Table size={18} /> Pratinjau {importModul} ({parsedData.length} baris)</h3>
                  {parsedData.length > 0 && <button onClick={handleConfirmImport} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all shadow-md flex items-center gap-2"><Save size={14} /> Simpan ke Database</button>}
                </div>
                <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-inner">
                  {parsedData.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4"><ClipboardPaste size={32} /></div>
                      <p className="text-xs font-bold uppercase tracking-widest mb-2">Ready for paste</p>
                    </div>
                  ) : (
                    <table className="w-full text-left text-[9px] border-collapse">
                      <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10">
                        <tr><th className="px-3 py-3 font-bold uppercase text-slate-500">Kode RUP</th><th className="px-3 py-3 font-bold uppercase text-slate-500">Nama Paket</th><th className="px-3 py-3 font-bold uppercase text-slate-500 text-right">Nilai Pagu</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedData.map((item, idx) => (
                          <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                            <td className="px-3 py-2.5 font-mono text-blue-600 font-bold">{item.kode_rup}</td>
                            <td className="px-3 py-2.5 font-semibold text-slate-700 truncate max-w-[150px]">{item.nama_paket}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">Rp {item.pagu.toLocaleString('id-ID')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal for User Delete */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 p-8 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
               <AlertTriangle size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Hapus Pengguna</h3>
            <p className="text-sm text-slate-500 mb-8 px-4">Apakah Anda yakin ingin menghapus akun pengguna ini? Tindakan ini tidak dapat dibatalkan.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="flex-1 py-3 text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all"
              >
                Batal
              </button>
              <button 
                onClick={confirmUserDelete}
                disabled={isDeleting}
                className="flex-1 py-3 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-2xl shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2"
              >
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Bidang Delete */}
      {isBidangDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 p-8 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
               <AlertTriangle size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Hapus Bidang</h3>
            <p className="text-sm text-slate-500 mb-8 px-4">Apakah Anda yakin ingin menghapus bidang <b>{bidangToDelete}</b>? Pastikan tidak ada user atau laporan yang menggunakan bidang ini.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsBidangDeleteConfirmOpen(false)}
                className="flex-1 py-3 text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all"
              >
                Batal
              </button>
              <button 
                onClick={confirmBidangDelete}
                disabled={isDeleting}
                className="flex-1 py-3 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-2xl shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2"
              >
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
              <div className="flex items-center gap-3 text-blue-600"><Users size={24} /><h2 className="text-xl font-bold">{editingUser ? 'Edit User' : 'User Baru'}</h2></div>
              <button onClick={() => setIsUserModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-200 rounded-full transition-all"><X size={20} /></button>
            </div>
            <form onSubmit={handleUserSave} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Username Login</label>
                  <input type="text" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Kata Sandi</label>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} required placeholder="Input Password Baru" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Role</label>
                    <select required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value as Role })}>
                      <option value={Role.ADMIN}>Admin</option>
                      <option value={Role.STAFF}>Staff</option>
                    </select>
                  </div>
                  {userForm.role === Role.STAFF && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Bidang Kerja</label>
                      <select required className="w-full p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm font-bold text-blue-700 outline-none" value={userForm.bidang} onChange={(e) => setUserForm({ ...userForm, bidang: e.target.value })}>
                        <option value="">Pilih Bidang</option>
                        {bidangList.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </div>
              <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
                <button type="button" onClick={() => setIsUserModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all">Batal</button>
                <button type="submit" className="px-8 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl shadow-lg transition-all flex items-center gap-2 active:scale-95"><CheckCircle2 size={18} /> Simpan Akun</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pengaturan;
