import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import ModulPBJ from './components/ModulPBJ';
import Pengaturan from './components/Pengaturan';
import ReferensiRUPManager from './components/ReferensiRUPManager';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { Modul, Role, User } from './types';
import { api } from './services/api';
import { LogIn, ShieldAlert, Landmark, Loader2 } from 'lucide-react';

const LOGO_URL = "https://upload.wikimedia.org/wikipedia/commons/5/54/Lambang_Kabupaten_Lombok_Barat.jpeg";
const AUTH_STORAGE_KEY = 'pbj_distan_auth_user';
const TAB_STORAGE_KEY = 'pbj_distan_active_tab';

const App: React.FC = () => {
  // Pulihkan session pengguna dari localStorage jika ada sehingga tidak perlu login ulang saat refresh
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.username) {
          const role = String(parsed.role).toLowerCase() === 'admin' ? Role.ADMIN : Role.STAFF;
          return { ...parsed, role };
        }
      }
    } catch (e) {
      console.warn('Gagal membaca sesi login dari localStorage', e);
    }
    return null;
  });

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return !!(parsed && parsed.username);
      }
    } catch {
      // ignore
    }
    return false;
  });

  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      return localStorage.getItem(TAB_STORAGE_KEY) || 'dashboard';
    } catch {
      return 'dashboard';
    }
  });

  const [logoError, setLogoError] = useState(false);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    try {
      localStorage.setItem(TAB_STORAGE_KEY, tab);
    } catch {
      // ignore
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await api.login({
        username: loginData.username,
        password: loginData.password,
      });

      if (response && response.user) {
        setUser(response.user);
        setIsLoggedIn(true);
        // Simpan sesi ke localStorage agar tetap login saat di-refresh atau dibuka kembali
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(response.user));
        } catch (storageErr) {
          console.warn('Gagal menyimpan sesi login ke localStorage', storageErr);
        }
      } else {
        setError(response?.message || 'Login gagal.');
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal menghubungkan ke backend Cloudflare Worker.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(TAB_STORAGE_KEY);
    } catch (storageErr) {
      console.warn('Gagal menghapus sesi login', storageErr);
    }
    setIsLoggedIn(false);
    setUser(null);
    setActiveTab('dashboard');
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] relative">
        <OfflineIndicator />

        {/* PWA Install Banner at the top for easy installation before login */}
        <div className="fixed top-4 right-4 z-40">
          <PWAInstallButton variant="badge" />
        </div>

        <div className="bg-white/95 backdrop-blur-md w-full max-w-md p-10 rounded-[2.5rem] shadow-2xl border border-white/50 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-yellow-400 via-blue-600 to-green-500"></div>
          
          <div className="flex flex-col items-center mb-8">
            <div className="w-24 h-24 mb-6 drop-shadow-lg transform transition-transform hover:scale-110 duration-500 flex items-center justify-center bg-white rounded-3xl overflow-hidden p-2">
              {!logoError ? (
                <img 
                  src={LOGO_URL} 
                  alt="Logo Lombok Barat" 
                  className="w-full h-full object-contain" 
                  onError={() => setLogoError(true)}
                />
              ) : (
                <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center border-2 border-blue-100">
                  <Landmark size={48} className="text-blue-600" />
                </div>
              )}
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 text-center leading-tight uppercase">
              REALISASI PBJ
            </h1>
            <p className="text-blue-600 text-[10px] font-black uppercase tracking-[0.2em] mt-2 text-center">
              Dinas Pertanian Lombok Barat
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Login Identity</label>
              <input 
                type="text" 
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all text-sm font-medium"
                placeholder="Username"
                value={loginData.username}
                onChange={(e) => setLoginData({...loginData, username: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <input 
                type="password" 
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all text-sm font-medium"
                placeholder="Password"
                value={loginData.password}
                onChange={(e) => setLoginData({...loginData, password: e.target.value})}
              />
            </div>
            
            {error && (
              <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl text-[11px] font-bold flex items-center gap-2 border border-rose-100 animate-shake">
                <ShieldAlert size={16} />
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full py-4 bg-blue-700 text-white rounded-2xl font-black text-sm hover:bg-blue-800 transition-all shadow-xl shadow-blue-700/20 active:scale-95 flex items-center justify-center gap-3 mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} className="animate-spin" /> Memverifikasi...
                </>
              ) : (
                <>
                  <LogIn size={20} /> Masuk ke Panel
                </>
              )}
            </button>
          </form>

          {/* Quick PWA Info / Card */}
          <div className="mt-6">
            <PWAInstallButton variant="card" />
          </div>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
             <div className="flex justify-center gap-4 text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-2">
                <span>Pemerintah Kab. Lombok Barat</span>
             </div>
            <p className="text-[10px] text-slate-400 font-medium italic">Tahun Anggaran 2026</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <OfflineIndicator />
      <Layout 
        activeTab={activeTab} 
        setActiveTab={handleTabChange} 
        user={user} 
        onLogout={handleLogout}
      >
        {activeTab === 'dashboard' && <Dashboard user={user!} />}
        {activeTab === 'referensi' && <ReferensiRUPManager userRole={user!.role} />}
        {activeTab === 'penyedia' && <ModulPBJ type={Modul.PENYEDIA} user={user!} />}
        {activeTab === 'swakelola' && <ModulPBJ type={Modul.SWAKELOLA} user={user!} />}
        {activeTab === 'pengaturan' && <Pengaturan currentUserRole={user!.role} />}
      </Layout>
    </>
  );
};

export default App;
