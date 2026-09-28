import React, { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [showRestored, setShowRestored] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline) {
      setShowRestored(true);
      const timer = setTimeout(() => {
        setShowRestored(false);
        setWasOffline(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (!isOnline) {
    return (
      <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-2xl bg-amber-500 text-white px-4 py-2.5 text-xs font-bold shadow-xl border border-amber-400/40 animate-pulse">
        <WifiOff size={16} />
        <span>Mode Offline — Aplikasi berjalan dengan data tersimpan di perangkat.</span>
      </div>
    );
  }

  if (showRestored) {
    return (
      <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-2xl bg-emerald-600 text-white px-4 py-2.5 text-xs font-bold shadow-xl border border-emerald-500/40">
        <Wifi size={16} />
        <span>Koneksi Pulih — Aplikasi kembali terhubung secara online.</span>
      </div>
    );
  }

  return null;
};
