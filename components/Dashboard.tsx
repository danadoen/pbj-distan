
import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, DollarSign, Target, AlertTriangle, Loader2, Award, 
  Briefcase, Filter, Calendar, MapPin, ChevronRight, X, 
  PieChart as PieIcon, ArrowDownRight, ArrowUpRight, Search
} from 'lucide-react';
import { dbService } from '../services/dbService';
import { User, Role, LaporanPBJ, ReferensiRUP, Modul } from '../types';

const Dashboard: React.FC<{ user: User }> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<LaporanPBJ[]>([]);
  const [rupData, setRupData] = useState<ReferensiRUP[]>([]);
  const [bidangList, setBidangList] = useState<string[]>([]);
  
  // Filter States
  const [selectedBidang, setSelectedBidang] = useState<string>(user.role === Role.STAFF ? user.bidang || '' : '');
  const [selectedMonth, setSelectedMonth] = useState<string>('Semua');
  const [selectedKecamatan, setSelectedKecamatan] = useState<string | null>(null);

  const MONTHS_NAME = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const KECAMATAN_LOBAR = [
    'Gerung', 'Kediri', 'Narmada', 'Lingsar', 'Gunungsari', 
    'Batulayar', 'Kuripan', 'Labuapi', 'Lembar', 'Sekotong'
  ];

  useEffect(() => {
    loadInitialData();
  }, [user]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const bFilter = user.role === Role.STAFF ? user.bidang : undefined;
      const [laporan, masterBidang, referensi] = await Promise.all([
        dbService.getAllLaporanForDashboard(bFilter),
        dbService.getBidang(),
        dbService.getReferensiRUP()
      ]);
      setRawData(laporan);
      setBidangList(masterBidang);
      setRupData(referensi);
    } catch (err) {
      console.error("Dashboard Load Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Derived Filtered Data
  const filteredData = useMemo(() => {
    return rawData.filter(item => {
      const matchesBidang = selectedBidang === '' || item.bidang === selectedBidang;
      
      let matchesMonth = true;
      if (selectedMonth !== 'Semua') {
        const date = item.tgl_sp2d ? new Date(item.tgl_sp2d) : null;
        if (date) {
          const monthIdx = date.getMonth();
          matchesMonth = MONTHS_NAME[monthIdx] === selectedMonth;
        } else {
          matchesMonth = false;
        }
      }
      
      return matchesBidang && matchesMonth;
    });
  }, [rawData, selectedBidang, selectedMonth]);

  // Statistics Calculation
  const stats = useMemo(() => {
    // Total Pagu RUP Master filtered by Bidang keywords if needed
    // In many cases, we check if the Satuan Kerja or Nama Paket matches the Bidang context
    const totalPaguRUP = rupData
      .filter(r => selectedBidang === '' || (r.satuan_kerja && r.satuan_kerja.includes(selectedBidang)))
      .reduce((acc, curr) => acc + Number(curr.pagu), 0);
      
    const totalPaguTerlapor = filteredData.reduce((acc, curr) => acc + Number(curr.pagu), 0);
    const totalRealisasi = filteredData.reduce((acc, curr) => acc + Number(curr.realisasi_keuangan), 0);
    const avgFisik = filteredData.length > 0 ? filteredData.reduce((acc, curr) => acc + Number(curr.fisik_realisasi), 0) / filteredData.length : 0;
    const avgRencana = filteredData.length > 0 ? filteredData.reduce((acc, curr) => acc + Number(curr.fisik_rencana), 0) / filteredData.length : 0;
    
    return { totalPaguRUP, totalPaguTerlapor, totalRealisasi, avgFisik, avgRencana };
  }, [filteredData, rupData, selectedBidang]);

  // Chart: Kinerja Bidang (Visualisasi Komparatif)
  const bidangPerformanceData = useMemo(() => {
    return bidangList.map(bidang => {
      const items = rawData.filter(d => d.bidang === bidang);
      const pagu = items.reduce((s, i) => s + Number(i.pagu), 0);
      const realisasi = items.reduce((s, i) => s + Number(i.realisasi_keuangan), 0);
      return {
        name: bidang,
        Pagu: pagu,
        Realisasi: realisasi
      };
    }).filter(d => d.Pagu > 0).sort((a, b) => b.Pagu - a.Pagu);
  }, [rawData, bidangList]);

  // Chart: Komposisi Modul (Penyedia vs Swakelola)
  const modulCompositionData = useMemo(() => {
    const penyedia = filteredData.filter(d => d.modul === Modul.PENYEDIA);
    const swakelola = filteredData.filter(d => d.modul === Modul.SWAKELOLA);
    
    return [
      { name: 'Penyedia', value: penyedia.reduce((s, i) => s + Number(i.realisasi_keuangan), 0), count: penyedia.length },
      { name: 'Swakelola', value: swakelola.reduce((s, i) => s + Number(i.realisasi_keuangan), 0), count: swakelola.length }
    ];
  }, [filteredData]);

  // Chart: Tren Kumulatif
  const trendChartData = useMemo(() => {
    return MONTHS_NAME.map((month, idx) => {
      const realizedUpToMonth = rawData.filter(item => {
        const date = item.tgl_sp2d ? new Date(item.tgl_sp2d) : null;
        const matchesBidang = selectedBidang === '' || item.bidang === selectedBidang;
        return matchesBidang && date && date.getMonth() <= idx;
      }).reduce((sum, item) => sum + Number(item.realisasi_keuangan), 0);

      const targetUpToMonth = rawData.filter(item => {
        const matchesBidang = selectedBidang === '' || item.bidang === selectedBidang;
        return matchesBidang;
      }).reduce((sum, item) => sum + (Number(item.pagu) * ((idx + 1) / 12)), 0);

      return {
        bulan: month.substring(0, 3),
        "Realisasi Kumulatif": realizedUpToMonth,
        "Target Kumulatif": targetUpToMonth
      };
    });
  }, [rawData, selectedBidang]);

  // Geospasial: Sebaran Wilayah (Simulasi berdasarkan teks nama paket)
  const sebaranWilayahData = useMemo(() => {
    return KECAMATAN_LOBAR.map(kec => {
      const items = filteredData.filter(d => 
        d.nama_paket.toLowerCase().includes(kec.toLowerCase()) || 
        d.satuan_kerja.toLowerCase().includes(kec.toLowerCase())
      );
      return {
        name: kec,
        count: items.length,
        value: items.reduce((s, i) => s + Number(i.pagu), 0),
        items: items
      };
    }).sort((a, b) => b.count - a.count);
  }, [filteredData]);

  // Deviasi Fisik (Top 10)
  const deviationChartData = useMemo(() => {
    return filteredData
      .map(item => ({
        nama: item.nama_paket.substring(0, 30) + '...',
        fullName: item.nama_paket,
        deviasi: Number(item.fisik_rencana) - Number(item.fisik_realisasi)
      }))
      .filter(item => item.deviasi > 0)
      .sort((a, b) => b.deviasi - a.deviasi)
      .slice(0, 10);
  }, [filteredData]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  if (loading) return (
    <div className="h-96 flex flex-col items-center justify-center gap-4 text-slate-400">
      <Loader2 className="animate-spin text-blue-600" size={40} />
      <p className="font-black text-xs uppercase tracking-widest animate-pulse">Menyiapkan Analitika...</p>
    </div>
  );

  const totalDeviasi = stats.avgRencana - stats.avgFisik;
  const serapanPersen = stats.totalPaguTerlapor > 0 ? (stats.totalRealisasi / stats.totalPaguTerlapor) * 100 : 0;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      
      {/* Global Interactive Filters */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
            <Filter size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">Analisa Dashboard</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Visualisasi Realisasi PBJ</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {user.role === Role.ADMIN && (
            <div className="relative flex-1 md:flex-none">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <select 
                className="pl-9 pr-8 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] font-black uppercase outline-none focus:ring-4 focus:ring-blue-500/10 appearance-none min-w-[180px]"
                value={selectedBidang}
                onChange={(e) => { setSelectedBidang(e.target.value); setSelectedKecamatan(null); }}
              >
                <option value="">Seluruh Bidang</option>
                {bidangList.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          )}
          
          <div className="relative flex-1 md:flex-none">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <select 
              className="pl-9 pr-8 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] font-black uppercase outline-none focus:ring-4 focus:ring-blue-500/10 appearance-none min-w-[180px]"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              <option value="Semua">Seluruh Bulan</option>
              {MONTHS_NAME.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Main Stats Cards (5 Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard 
          title="Pagu RUP Master" 
          value={formatCurrency(stats.totalPaguRUP)} 
          subValue="Total Seluruh Bidang"
          icon={<Award size={16} />} 
          color="indigo"
        />
        <StatCard 
          title="Pagu Terlapor" 
          value={formatCurrency(stats.totalPaguTerlapor)} 
          subValue="Dana Terkelola"
          icon={<DollarSign size={16} />} 
          color="blue"
        />
        <StatCard 
          title="Realisasi Keu" 
          value={`${serapanPersen.toFixed(1)}%`} 
          subValue={formatCurrency(stats.totalRealisasi)}
          icon={<TrendingUp size={16} />} 
          color="emerald"
        />
        <StatCard 
          title="Progres Fisik" 
          value={`${stats.avgFisik.toFixed(1)}%`} 
          subValue="Rata-rata Realisasi" 
          icon={<Target size={16} />} 
          color="amber"
        />
        <StatCard 
          title="Deviasi Fisik" 
          value={`${totalDeviasi > 0 ? '+' : ''}${totalDeviasi.toFixed(1)}%`} 
          subValue={totalDeviasi > 10 ? "⚠️ Kritis" : totalDeviasi > 0 ? "🕒 Terlambat" : "✅ Sesuai"} 
          icon={<AlertTriangle size={16} />} 
          color={totalDeviasi > 10 ? "rose" : totalDeviasi > 0 ? "orange" : "emerald"}
          isCritical={totalDeviasi > 10}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tren Kumulatif */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-2">
            <TrendingUp size={14} className="text-blue-600" /> Tren Realisasi Kumulatif
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendChartData}>
                <defs>
                  <linearGradient id="colorRealisasi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="bulan" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}} 
                  formatter={(val: number) => formatCurrency(val)}
                />
                <Area type="monotone" dataKey="Target Kumulatif" stroke="#3b82f6" strokeWidth={3} fill="transparent" dot={false} />
                <Area type="monotone" dataKey="Realisasi Kumulatif" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRealisasi)" dot={{r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff'}} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Kinerja Bidang (Visualisasi) */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-2">
            <Award size={14} className="text-indigo-600" /> Komparasi Kinerja per Bidang
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bidangPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 800, fill: '#64748b'}} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}} 
                  formatter={(val: number) => formatCurrency(val)}
                />
                <Legend iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: 'bold', paddingTop: '20px'}} />
                <Bar dataKey="Pagu" fill="#e2e8f0" radius={[6, 6, 0, 0]} barSize={20} />
                <Bar dataKey="Realisasi" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Komposisi Modul (Penyedia vs Swakelola) */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-2">
            <PieIcon size={14} className="text-emerald-600" /> Analisa Penyedia vs Swakelola
          </h3>
          <div className="flex flex-col md:flex-row items-center justify-center gap-10">
             <div className="h-56 w-56 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={modulCompositionData}
                      cx="50%" cy="50%"
                      innerRadius={60} outerRadius={80}
                      paddingAngle={8}
                      dataKey="value"
                    >
                      {modulCompositionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: number) => formatCurrency(val)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                   <span className="text-xs font-black text-slate-400 uppercase tracking-tighter">Total</span>
                   <span className="text-lg font-black text-slate-900 leading-none">{formatCurrency(stats.totalRealisasi).split(',')[0]}</span>
                </div>
             </div>
             <div className="space-y-4">
                {modulCompositionData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-4">
                     <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[i]}}></div>
                     <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.name}</p>
                        <p className="text-sm font-black text-slate-900">{formatCurrency(item.value)}</p>
                        <p className="text-[9px] font-bold text-slate-400 italic">{item.count} Paket Pekerjaan</p>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        </div>

        {/* Peta Sebaran Paket (Geospasial Simulasi) */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-2">
            <MapPin size={14} className="text-rose-600" /> Sebaran Paket per Kecamatan
          </h3>
          <div className="grid grid-cols-2 gap-3 max-h-[250px] overflow-y-auto pr-2 scrollbar-hide">
             {sebaranWilayahData.map((kec) => (
               <button 
                 key={kec.name} 
                 onClick={() => setSelectedKecamatan(selectedKecamatan === kec.name ? null : kec.name)}
                 className={`p-4 rounded-2xl text-left transition-all border group ${selectedKecamatan === kec.name ? 'bg-slate-900 border-slate-900 text-white shadow-xl' : 'bg-slate-50 border-slate-100 hover:border-slate-300'}`}
               >
                  <div className="flex justify-between items-start mb-1">
                     <span className={`text-[10px] font-black uppercase tracking-widest ${selectedKecamatan === kec.name ? 'text-blue-400' : 'text-slate-400'}`}>{kec.name}</span>
                     <ChevronRight size={14} className={selectedKecamatan === kec.name ? 'text-blue-400' : 'text-slate-200 group-hover:text-slate-400'} />
                  </div>
                  <div className="text-lg font-black leading-none mb-1">{kec.count} <span className="text-[10px] opacity-60">Paket</span></div>
                  <div className={`text-[9px] font-bold truncate ${selectedKecamatan === kec.name ? 'text-slate-300' : 'text-slate-400'}`}>{formatCurrency(kec.value)}</div>
               </button>
             ))}
          </div>
          
          {selectedKecamatan && (
            <div className="mt-6 p-5 bg-blue-50/50 rounded-2xl border border-blue-100 animate-in slide-in-from-top-2">
               <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Daftar Paket di {selectedKecamatan}</h4>
                  <button onClick={() => setSelectedKecamatan(null)} className="text-blue-400 hover:text-blue-600"><X size={14}/></button>
               </div>
               <div className="space-y-2 max-h-[100px] overflow-y-auto pr-1">
                  {sebaranWilayahData.find(k => k.name === selectedKecamatan)?.items.map((it, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-[10px] font-bold text-slate-600 bg-white p-2 rounded-lg border border-blue-50 shadow-sm">
                       <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></div>
                       <span className="truncate flex-1">{it.nama_paket}</span>
                       <span className="text-blue-600 shrink-0 font-mono font-black">{formatCurrency(it.realisasi_keuangan).split(',')[0]}</span>
                    </div>
                  ))}
                  {sebaranWilayahData.find(k => k.name === selectedKecamatan)?.items.length === 0 && (
                    <p className="text-[9px] text-slate-400 italic text-center py-2">Tidak ada data terdeteksi.</p>
                  )}
               </div>
            </div>
          )}
        </div>
      </div>

      {/* Deviasi Fisik Kritis (Bottom) */}
      <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
           <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                <AlertTriangle size={20} className="text-rose-600" /> Analisa Deviasi Fisik Kritis
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Daftar 10 Paket dengan keterlambatan tertinggi</p>
           </div>
           <div className="flex gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 rounded-full border border-rose-100">
                 <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                 <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest">Kritis (&gt;10%)</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-full border border-amber-100">
                 <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                 <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Waspada (&lt;10%)</span>
              </div>
           </div>
        </div>
        <div className="h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={deviationChartData} layout="vertical" margin={{ left: 20, right: 40 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" hide />
              <YAxis 
                dataKey="nama" 
                type="category" 
                axisLine={false} 
                tickLine={false} 
                width={150} 
                tick={{fontSize: 9, fontWeight: 800, fill: '#64748b'}} 
              />
              <Tooltip 
                 contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.1)'}}
                 cursor={{fill: '#f8fafc'}}
                 labelStyle={{fontWeight: 'bold', fontSize: '11px', marginBottom: '8px'}}
              />
              <Bar dataKey="deviasi" radius={[0, 10, 10, 0]} barSize={20}>
                {deviationChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.deviasi > 10 ? '#ef4444' : '#f59e0b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ 
  title: string; 
  value: string; 
  subValue: string; 
  icon: React.ReactNode; 
  color: string;
  isCritical?: boolean;
}> = ({ title, value, subValue, icon, color, isCritical }) => {
  return (
    <div className={`relative bg-white p-6 rounded-[2.25rem] shadow-sm flex flex-col justify-between overflow-hidden transition-all border border-slate-100 group hover:border-${color}-200 ${isCritical ? 'bg-rose-50/50 border-rose-100 animate-pulse' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-2xl bg-${color}-50 flex items-center justify-center text-${color}-600 group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
        <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest">{title}</p>
      </div>

      <div className="mt-2">
        <h4 className={`text-xl font-black ${isCritical ? 'text-rose-600' : 'text-slate-900'} leading-none tracking-tight`}>
          {value}
        </h4>
        <div className="flex items-center gap-1.5 mt-2">
           {isCritical ? <ArrowDownRight size={10} className="text-rose-500" /> : <ArrowUpRight size={10} className="text-emerald-500" />}
           <p className={`text-[9px] font-bold truncate ${isCritical ? 'text-rose-500' : 'text-slate-400 opacity-80'}`}>
            {subValue}
           </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
