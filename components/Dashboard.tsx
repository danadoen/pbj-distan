
import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { TrendingUp, DollarSign, Target, AlertTriangle, Loader2, Award, Briefcase } from 'lucide-react';
import { dbService } from '../services/dbService';
import { User, Role, LaporanPBJ } from '../types';

const Dashboard: React.FC<{ user: User }> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPagu: 0,
    totalRealisasi: 0,
    avgFisik: 0,
    avgRencana: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [bidangChartData, setBidangChartData] = useState<any[]>([]);
  const [kritisData, setKritisData] = useState<LaporanPBJ[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const bidangFilter = user.role === Role.STAFF ? user.bidang : undefined;
      const [data, masterBidang] = await Promise.all([
        dbService.getAllLaporanForDashboard(bidangFilter),
        dbService.getBidang()
      ]);
      
      const totalPagu = data.reduce((acc, curr) => acc + Number(curr.pagu), 0);
      const totalRealisasi = data.reduce((acc, curr) => acc + Number(curr.realisasi_keuangan), 0);
      const avgFisik = data.length > 0 ? data.reduce((acc, curr) => acc + Number(curr.fisik_realisasi), 0) / data.length : 0;
      const avgRencana = data.length > 0 ? data.reduce((acc, curr) => acc + Number(curr.fisik_rencana), 0) / data.length : 0;

      setStats({ totalPagu, totalRealisasi, avgFisik, avgRencana });

      const penyedia = data.filter(d => d.modul === 'Penyedia');
      const swakelola = data.filter(d => d.modul === 'Swakelola');
      setChartData([
        {
          name: 'Penyedia',
          Pagu: penyedia.reduce((sum, d) => sum + Number(d.pagu), 0),
          Realisasi: penyedia.reduce((sum, d) => sum + Number(d.realisasi_keuangan), 0)
        },
        {
          name: 'Swakelola',
          Pagu: swakelola.reduce((sum, d) => sum + Number(d.pagu), 0),
          Realisasi: swakelola.reduce((sum, d) => sum + Number(d.realisasi_keuangan), 0)
        }
      ]);

      const bidangStats = masterBidang.map(bidang => {
        const items = data.filter(d => d.bidang === bidang);
        const avg = items.length > 0 ? items.reduce((sum, d) => sum + Number(d.fisik_realisasi), 0) / items.length : 0;
        return { name: bidang, Progres: parseFloat(avg.toFixed(1)) };
      }).filter(b => b.Progres > 0).sort((a, b) => b.Progres - a.Progres);
      setBidangChartData(bidangStats);

      const kritis = [...data]
        .map(item => ({ ...item, deviasi: Number(item.fisik_rencana) - Number(item.fisik_realisasi) }))
        .sort((a, b) => b.deviasi - a.deviasi)
        .slice(0, 5)
        .filter(item => item.deviasi > 0);
      setKritisData(kritis);

    } catch (err) {
      console.error("Dashboard Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrencyHighPrecision = (value: number) => {
    if (value >= 1000000000) {
      const val = value / 1000000000;
      return `Rp ${val.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} Miliar`;
    } else if (value >= 1000000) {
      const val = value / 1000000;
      return `Rp ${val.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} Juta`;
    }
    return `Rp ${value.toLocaleString('id-ID')}`;
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 text-slate-400 bg-white">
      <Loader2 className="animate-spin" size={40} />
      <p className="font-bold text-sm uppercase tracking-widest animate-pulse">Memuat Analitik...</p>
    </div>
  );

  const totalDeviasi = stats.avgRencana - stats.avgFisik;
  const serapanPersen = (stats.totalRealisasi / (stats.totalPagu || 1)) * 100;

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-slate-900 p-8 mb-8 rounded-[2.5rem] shadow-xl relative border-none">
        <div className="relative flex justify-between items-center">
          <div>
            <h2 className="text-white text-2xl font-black uppercase tracking-tight">Ringkasan Eksekutif</h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mt-2 block">Laporan Realisasi 2026</p>
          </div>
          <div className="hidden sm:flex bg-white/5 px-5 py-2.5 rounded-2xl items-center gap-2">
             <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
             <span className="text-[10px] font-black text-white uppercase tracking-widest">Sistem Aktif</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-1 md:px-0">
        <StatCard 
          title="Total Pagu" 
          value={formatCurrencyHighPrecision(stats.totalPagu)} 
          subValue={`Rp ${stats.totalPagu.toLocaleString('id-ID')}`}
          icon={<DollarSign size={16} />} 
          color="blue"
        />
        <StatCard 
          title="Keuangan" 
          value={`${serapanPersen.toFixed(1)}%`} 
          subValue={`Rp ${stats.totalRealisasi.toLocaleString('id-ID')}`}
          icon={<TrendingUp size={16} />} 
          color="emerald"
        />
        <StatCard 
          title="Progres Fisik" 
          value={`${stats.avgFisik.toFixed(1)}%`} 
          subValue="Capaian Lapangan" 
          icon={<Target size={16} />} 
          color="amber"
        />
        <StatCard 
          title="Deviasi" 
          value={`${totalDeviasi > 0 ? '+' : ''}${totalDeviasi.toFixed(1)}%`} 
          subValue={totalDeviasi > 0 ? "⚠️ Terlambat" : "✅ Lancar"} 
          icon={<AlertTriangle size={16} />} 
          color={totalDeviasi > 0 ? "rose" : "emerald"}
          isCritical={totalDeviasi > 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border-none">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-2">
            <Briefcase size={14} className="text-blue-600" /> Pelaksanaan Modul
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} hide />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="Pagu" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={20} />
                <Bar dataKey="Realisasi" fill="#10b981" radius={[6, 6, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border-none">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-2">
            <Award size={14} className="text-amber-600" /> Capaian Bidang
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={bidangChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="Progres">
                  {bidangChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{fontSize: '9px', fontWeight: 'bold', paddingTop: '10px'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm overflow-hidden border-none">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-600 mb-8 flex items-center gap-2">
          <AlertTriangle size={18} /> Top 5 Paket Kritis
        </h3>
        <div className="space-y-4">
          {kritisData.length === 0 ? (
            <div className="py-12 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 mb-4">
                <Target size={24} />
              </div>
              <p className="text-slate-400 font-medium text-xs">Semua paket berjalan sesuai rencana.</p>
            </div>
          ) : kritisData.map((item, idx) => (
            <div key={idx} className="p-6 bg-slate-50/50 rounded-3xl flex items-center justify-between border-none">
              <div className="max-w-[70%]">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.bidang}</p>
                <p className="text-xs font-bold text-slate-800 truncate">{item.nama_paket}</p>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-rose-600">+{((Number(item.fisik_rencana) - Number(item.fisik_realisasi))).toFixed(1)}%</span>
                <p className="text-[9px] font-black uppercase text-rose-400 tracking-tighter">Delay Fisik</p>
              </div>
            </div>
          ))}
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
    <div className={`relative bg-white p-6 rounded-[2.25rem] shadow-sm flex flex-col justify-between overflow-hidden transition-all border-none ${isCritical ? 'bg-rose-50/30' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-2xl bg-${color}-50 flex items-center justify-center text-${color}-600`}>
          {icon}
        </div>
        <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest">{title}</p>
      </div>

      <div className="mt-2">
        <h4 className={`text-xl md:text-2xl font-black ${isCritical ? 'text-rose-600' : 'text-slate-900'} leading-none tracking-tight`}>
          {value}
        </h4>
        <p className={`text-[9px] font-bold mt-2 truncate ${isCritical ? 'text-rose-400' : 'text-slate-400 opacity-80'}`}>
          {subValue}
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
