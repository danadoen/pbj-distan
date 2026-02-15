import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Settings, 
  LogOut, 
  Menu, 
  FileText,
  Library,
  Briefcase,
  Landmark,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { Role, User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: User | null;
  onLogout: () => void;
}

const LOGO_URL = "https://upload.wikimedia.org/wikipedia/commons/5/54/Lambang_Kabupaten_Lombok_Barat.jpeg";

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, user, onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [logoError, setLogoError] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'referensi', label: 'Referensi RUP', icon: Library },
    { id: 'penyedia', label: 'Modul Penyedia', icon: ShoppingCart },
    { id: 'swakelola', label: 'Modul Swakelola', icon: FileText },
    { id: 'pengaturan', label: 'Pengaturan', icon: Settings, adminOnly: true },
  ];

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`bg-slate-900 text-white flex-shrink-0 transition-all duration-300 ease-in-out relative z-30 flex flex-col h-full shadow-2xl border-r border-slate-800 
          ${isSidebarOpen ? 'w-64' : 'w-20'} 
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} 
          absolute lg:relative`}
      >
        {/* Toggle Button (Nuget) */}
        <button 
          onClick={toggleSidebar}
          className="absolute -right-3 top-20 bg-blue-600 text-white p-1 rounded-full shadow-xl shadow-blue-600/40 hover:bg-blue-700 transition-all z-50 border-2 border-slate-900 hidden lg:flex"
        >
          {isSidebarOpen ? <ChevronsLeft size={14} /> : <ChevronsRight size={14} />}
        </button>

        {/* Sidebar Header */}
        <div className={`p-6 border-b border-slate-800 bg-slate-900/50 flex flex-col ${!isSidebarOpen && 'items-center'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 flex-shrink-0 drop-shadow-md flex items-center justify-center overflow-hidden rounded-lg bg-white">
              {!logoError ? (
                <img 
                  src={LOGO_URL} 
                  alt="Logo" 
                  className="w-full h-full object-contain p-1" 
                  onError={() => setLogoError(true)}
                />
              ) : (
                <Landmark size={24} className="text-blue-400" />
              )}
            </div>
            {isSidebarOpen && (
              <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                <h1 className="text-sm font-black tracking-tight leading-none text-white whitespace-nowrap">PBJ DISTAN</h1>
                <p className="text-blue-400 text-[10px] font-bold uppercase tracking-wider mt-1 whitespace-nowrap">Lombok Barat</p>
              </div>
            )}
          </div>
          {isSidebarOpen && (
            <div className="flex items-center gap-2 animate-in fade-in duration-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest whitespace-nowrap">Tahun Anggaran 2026</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1.5 overflow-y-auto flex-1 scrollbar-hide">
          {menuItems.map((item) => {
            if (item.adminOnly && user?.role !== Role.ADMIN) return null;
            
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={!isSidebarOpen ? item.label : ''}
                className={`w-full flex items-center rounded-xl text-xs font-bold transition-all group relative ${
                  active 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                } ${isSidebarOpen ? 'px-4 py-3 gap-3' : 'p-3 justify-center'}`}
              >
                <Icon size={18} className={`${active ? 'scale-110' : 'group-hover:scale-110'} transition-transform`} />
                {isSidebarOpen && (
                  <span className="animate-in fade-in slide-in-from-left-2 duration-300 whitespace-nowrap">
                    {item.label}
                  </span>
                )}
                {!isSidebarOpen && active && (
                  <div className="absolute left-0 w-1 h-6 bg-white rounded-r-full"></div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className={`p-4 border-t border-slate-800 bg-slate-900/30`}>
          {isSidebarOpen && (
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] mb-4 px-2">Identitas Login</p>
          )}
          
          <div className={`flex items-center rounded-2xl border border-slate-700/50 bg-slate-800/50 transition-all ${isSidebarOpen ? 'p-3 gap-3 mb-6' : 'p-2 justify-center mb-4'}`}>
            <div className="w-9 h-9 flex-shrink-0 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center border border-slate-600 shadow-inner">
              <span className="text-xs font-black">{user?.username.charAt(0).toUpperCase()}</span>
            </div>
            {isSidebarOpen && (
              <div className="overflow-hidden animate-in fade-in duration-300">
                <p className="text-xs font-bold truncate text-white uppercase">{user?.username}</p>
                <p className="text-[9px] text-blue-400 font-black flex items-center gap-1 mt-0.5 whitespace-nowrap uppercase">
                  <Briefcase size={8} /> {user?.role === Role.ADMIN ? 'ADMIN' : `BIDANG ${user?.bidang}`}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={onLogout}
            title={!isSidebarOpen ? 'Keluar Sistem' : ''}
            className={`w-full flex items-center rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition-colors group ${isSidebarOpen ? 'px-4 py-3 gap-3' : 'p-3 justify-center'}`}
          >
            <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
            {isSidebarOpen && <span>Keluar Sistem</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-10 shadow-sm shrink-0">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden text-slate-600 p-2 hover:bg-slate-100 rounded-lg transition-colors" 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <Menu size={20} />
            </button>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-600 rounded-full"></span>
                {activeTab === 'dashboard' ? 'Ringkasan Realisasi' : 
                 activeTab === 'referensi' ? 'Database RUP' :
                 activeTab === 'penyedia' ? 'Modul Penyedia' : 
                 activeTab === 'swakelola' ? 'Modul Swakelola' : 'Konfigurasi Sistem'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col items-end mr-2">
               <span className="text-[10px] font-black text-slate-900 leading-none uppercase tracking-tighter">Dinas Pertanian</span>
               <span className="text-[9px] font-bold text-slate-400 leading-tight">Kab. Lombok Barat</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-100 shadow-sm">
               <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
               <span className="text-[10px] font-black uppercase tracking-tighter">TA 2026</span>
            </div>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto p-6 bg-slate-50 relative">
          {/* Subtle Background Pattern */}
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none"></div>
          <div className="relative z-0">
            {children}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Layout;