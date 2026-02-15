
import React, { useState } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Settings, LogOut, Menu, FileText, Library, Landmark, X
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
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(window.innerWidth > 1024);
  const [logoError, setLogoError] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'referensi', label: 'Referensi RUP', icon: Library },
    { id: 'penyedia', label: 'Modul Penyedia', icon: ShoppingCart },
    { id: 'swakelola', label: 'Modul Swakelola', icon: FileText },
    { id: 'pengaturan', label: 'Pengaturan', icon: Settings, adminOnly: true },
  ];

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden w-full">
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[40] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar - Cleanest possible approach */}
      <aside 
        className={`bg-slate-900 text-white flex-shrink-0 transition-all duration-300 ease-in-out z-[50] flex flex-col h-full 
          ${isSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full lg:w-20 lg:translate-x-0'} 
          fixed lg:relative border-none`}
      >
        <div className={`p-6 flex items-center justify-between gap-3 ${!isSidebarOpen && 'justify-center lg:px-0'}`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 flex-shrink-0 bg-white rounded-xl overflow-hidden p-1">
               {!logoError ? (
                  <img src={LOGO_URL} alt="Logo" className="w-full h-full object-contain" onError={() => setLogoError(true)} />
               ) : (
                  <Landmark className="text-blue-600 w-full h-full" />
               )}
            </div>
            {isSidebarOpen && (
              <div className="overflow-hidden">
                 <h1 className="text-xs font-black tracking-tighter text-white uppercase truncate">PBJ DISTAN</h1>
                 <p className="text-blue-400 text-[9px] font-black uppercase">Lombok Barat</p>
              </div>
            )}
          </div>
          
          {isSidebarOpen && window.innerWidth < 1024 && (
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all"
            >
              <X size={20} className="text-slate-400" />
            </button>
          )}
        </div>

        <nav className="p-4 space-y-1.5 overflow-y-auto flex-1 scrollbar-hide">
          {menuItems.map((item) => {
            if (item.adminOnly && user?.role !== Role.ADMIN) return null;
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center text-[11px] font-black uppercase tracking-tight transition-all group ${
                  isSidebarOpen 
                    ? `px-4 py-3 gap-3 rounded-2xl ${active ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}` 
                    : `p-3 justify-center ${active ? 'text-blue-500' : 'text-slate-500 hover:text-white'}`
                }`}
              >
                <Icon size={isSidebarOpen ? 18 : 22} />
                {isSidebarOpen && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-none">
           <button onClick={onLogout} className={`w-full flex items-center rounded-2xl text-[11px] font-black uppercase text-rose-400 hover:bg-rose-500/10 transition-all ${isSidebarOpen ? 'px-4 py-3 gap-3' : 'p-3 justify-center'}`}>
              <LogOut size={18} />
              {isSidebarOpen && <span>Keluar</span>}
           </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden w-full relative">
        <header className="h-14 bg-white flex items-center justify-between px-6 shrink-0 z-10 border-none shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              className="text-slate-500 hover:text-blue-600 transition-colors p-1" 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
               {isSidebarOpen && window.innerWidth < 1024 ? <X size={22} /> : <Menu size={22} />}
            </button>
            
            <div className="hidden xs:block">
               <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Kab. Lombok Barat</h2>
               <p className="text-xs font-black text-slate-800 uppercase tracking-tight mt-0.5">Dinas Pertanian</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-600/20">
             <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
             <span className="text-[10px] font-black uppercase tracking-widest">TA 2026</span>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50 w-full relative scrollbar-hide">
           <div className="max-w-full mx-auto">
              {children}
           </div>
        </section>
      </main>
    </div>
  );
};

export default Layout;
