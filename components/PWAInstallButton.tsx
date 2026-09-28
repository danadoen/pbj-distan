import React, { useState } from 'react';
import { usePWAInstall } from './usePWAInstall';
import { Download, Smartphone, X, CheckCircle2, Share } from 'lucide-react';

interface PWAInstallButtonProps {
  variant?: 'header' | 'badge' | 'card';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'header', className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    setIsInstalling(true);
    await install();
    setIsInstalling(false);
  };

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    if (variant === 'badge') {
      return (
        <button
          onClick={handleInstallClick}
          disabled={isInstalling}
          className={`flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[11px] font-bold rounded-full shadow-md hover:from-emerald-700 hover:to-teal-700 transition active:scale-95 disabled:opacity-50 ${className}`}
          title="Install Aplikasi PBJ ke Perangkat"
        >
          <Download size={14} className="animate-bounce" />
          <span>Install Aplikasi (PWA)</span>
        </button>
      );
    }

    if (variant === 'card') {
      return (
        <div className={`p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl flex items-center justify-between gap-4 ${className}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
              <Smartphone size={20} />
            </div>
            <div>
              <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Pasang Aplikasi Realisasi PBJ</p>
              <p className="text-[11px] text-slate-500">Akses cepat tanpa browser dari layar utama smartphone atau laptop Anda.</p>
            </div>
          </div>
          <button
            onClick={handleInstallClick}
            disabled={isInstalling}
            className="shrink-0 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-blue-600/20 active:scale-95 transition"
          >
            <Download size={15} />
            <span>Install</span>
          </button>
        </div>
      );
    }

    // Default: header
    return (
      <button
        onClick={handleInstallClick}
        disabled={isInstalling}
        className={`flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black tracking-tight rounded-xl shadow-sm transition active:scale-95 ${className}`}
        title="Pasang Aplikasi ke Layar Utama"
      >
        <Download size={14} />
        <span className="hidden sm:inline">Install PWA</span>
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported by WebKit)
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition ${className}`}
          title="Pasang di iPhone/iPad"
        >
          <Share size={13} className="text-blue-600" />
          <span className="hidden sm:inline">Install di iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 relative">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/30">
                  <Smartphone size={24} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Install di iPhone / iPad</h3>
                  <p className="text-[11px] text-blue-600 font-bold">Aplikasi PBJ Dinas Pertanian</p>
                </div>
              </div>

              <div className="space-y-3 my-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs text-slate-600">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <span>Buka menu browser Safari lalu ketuk tombol <strong>Share</strong> (ikon kotak dengan panah ke atas <Share size={12} className="inline text-blue-600" />).</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <span>Gulir ke bawah dan pilih opsi <strong>Add to Home Screen</strong> (Tambah ke Layar Utama).</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <span>Ketuk <strong>Add</strong> di pojok kanan atas. Ikon aplikasi akan tampil di layar utama iPhone Anda!</span>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-3 rounded-2xl bg-blue-600 text-white text-xs font-black uppercase tracking-wider hover:bg-blue-700 transition shadow-lg shadow-blue-600/20"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
