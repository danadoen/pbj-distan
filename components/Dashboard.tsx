
import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, TooltipProps
} from 'recharts';
import { TrendingUp, DollarSign, Target, AlertTriangle, Loader2 } from 'lucide-react';
import { dbService } from '../services/dbService';
import { User, Role } from '../types';

const Dashboard: React.FC<{ user: User }> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPagu: 0,
    totalRealisasi: 0,
    avgFisik: 0,
    avgDeviasi: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);

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

      setStats({
        totalPagu,
        totalRealisasi,
        avgFisik,
        avgDeviasi: avgFisik - avgRencana
      });

      // Olah data untuk Chart secara dinamis
      if (user.role === Role.ADMIN) {
        // Gunakan daftar bidang dari database (masterBidang)
        const grouped = masterBidang.map(bidang => {
          const items = data.filter(d => d.bidang === bidang);
          return {
            name: bidang,
            Pagu: items.reduce((sum, d) => sum + Number(d.pagu), 0),
            Realisasi: items.reduce((sum, d) => sum + Number(d.realisasi_keuangan), 0)
          };
        }).filter(item => item.Pagu > 0 || item.Realisasi > 0);
        
        // Jika data kosong, beri placeholder agar grafik tidak error
        setChartData(grouped.length > 0 ? grouped : [{ name: 'Belum Ada Data', Pagu: 0, Realisasi: 0 }]);
      } else {
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
      }
    } catch (err) {
      console.error("Dashboard Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const dataBidang = [
    { name: 'Terpakai', value: stats.totalRealisasi },
    { name: 'Sisa', value: Math.max(0, stats.totalPagu - stats.totalRealisasi) },
  ];

  const COLORS = ['#10b981', '#f1f5f9'];

  const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-xl">
          <p className="font-bold text-slate-900 mb-2">{label}</p>
          {payload.map((p: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between gap-8 mb-1">
              <span className="text-xs text-slate-500 font-bold uppercase">{p.name}:</span>
              <span className="text-xs font-mono font-bold text-slate-800">Rp {p.value.toLocaleString('id-ID')}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) return (
    <div className="h-96 flex flex-col items-center justify-center gap-4 text-slate-400">
      <Loader2 className="animate-spin" size={40} />
      <p className="font-bold text-sm">Menganalisis Data...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Pagu Anggaran" 
          value={`Rp ${stats.totalPagu.toLocaleString('id-ID')}`} 
          subValue={user.role === Role.ADMIN ? "Seluruh Bidang" : `Bidang ${user.bidang}`} 
          icon={<DollarSign className="text-blue-600" />} 
          color="blue"
        />
        <StatCard 
          title="Realisasi Keuangan" 
          value={`Rp ${stats.totalRealisasi.toLocaleString('id-ID')}`} 
          subValue={`${((stats.totalRealisasi / (stats.totalPagu || 1)) * 100).toFixed(1)}% Penyerapan`} 
          icon={<TrendingUp className="text-emerald-600" />} 
          color="emerald"
        />
        <StatCard 
          title="Progres Fisik" 
          value={`${stats.avgFisik.toFixed(1)}%`} 
          subValue="Rata-rata Pekerjaan" 
          icon={<Target className="text-amber-600" />} 
          color="amber"
        />
        <StatCard 
          title="Deviasi Progres" 
          value={`${stats.avgDeviasi.toFixed(1)}%`} 
          subValue={stats.avgDeviasi < 0 ? "Kritik (Terlambat)" : "On Schedule"} 
          icon={<AlertTriangle className={stats.avgDeviasi < 0 ? "text-rose-600" : "text-emerald-600"} />} 
          color={stats.avgDeviasi < 0 ? "rose" : "emerald"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold">Analisis Capaian Realisasi</h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-blue-500"></span>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Pagu</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-emerald-500"></span>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Realisasi</span>
              </div>
            </div>
          </div>
          
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                  dy={10}
                />
                <YAxis hide={true} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="Pagu" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />
                <Bar dataKey="Realisasi" fill="#10b981" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
          <h3 className="text-lg font-bold mb-8 w-full">Total Serapan Anggaran</h3>
          <div className="h-64 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dataBidang}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {dataBidang.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
               <p className="text-4xl font-black text-slate-800 tracking-tighter">
                  {((stats.totalRealisasi / (stats.totalPagu || 1)) * 100).toFixed(1)}%
               </p>
               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Tercapai</p>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 w-full">
             <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Terpakai</p>
                <p className="text-xs font-bold text-emerald-600">Rp {stats.totalRealisasi.toLocaleString('id-ID')}</p>
             </div>
             <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Sisa Pagu</p>
                <p className="text-xs font-bold text-slate-700">Rp {(stats.totalPagu - stats.totalRealisasi).toLocaleString('id-ID')}</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: string; subValue: string; icon: React.ReactNode; color: string }> = ({ title, value, subValue, icon, color }) => {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
      <div className="flex justify-between items-start mb-6">
        <div className={`p-3 rounded-xl bg-${color}-50 border border-${color}-100 group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
      </div>
      <div>
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{title}</p>
        <h4 className="text-xl font-black mt-2 text-slate-800 truncate" title={value}>{value}</h4>
        <div className="flex items-center gap-1 mt-3">
           <span className={`w-1.5 h-1.5 rounded-full bg-${color}-500 animate-pulse`}></span>
           <p className="text-xs text-slate-400 font-medium italic">{subValue}</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
