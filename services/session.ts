import { User, Role } from '../types';

const AUTH_KEY = 'pbj_distan_auth_user';
const TAB_KEY = 'pbj_distan_active_tab';

export const sessionManager = {
  getUser: (): User | null => {
    try {
      let raw = typeof localStorage !== 'undefined' ? localStorage.getItem(AUTH_KEY) : null;
      if (!raw && typeof sessionStorage !== 'undefined') {
        raw = sessionStorage.getItem(AUTH_KEY);
      }
      if (!raw && typeof document !== 'undefined') {
        const match = document.cookie.match(new RegExp('(^| )' + AUTH_KEY + '=([^;]+)'));
        if (match) raw = decodeURIComponent(match[2]);
      }
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.username || parsed.id)) {
          const role = String(parsed.role || '').toLowerCase() === 'admin' ? Role.ADMIN : Role.STAFF;
          return {
            id: parsed.id || 1,
            username: parsed.username || 'admin',
            role,
            bidang: parsed.bidang || ''
          };
        }
      }
    } catch (e) {
      console.warn('Gagal membaca sesi pengguna:', e);
    }
    return null;
  },

  setUser: (user: User) => {
    try {
      const serialized = JSON.stringify(user);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(AUTH_KEY, serialized);
      }
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(AUTH_KEY, serialized);
      }
      if (typeof document !== 'undefined') {
        const maxAge = 60 * 60 * 24 * 30; // 30 hari
        document.cookie = `${AUTH_KEY}=${encodeURIComponent(serialized)}; path=/; max-age=${maxAge}; SameSite=Lax`;
      }
    } catch (e) {
      console.warn('Gagal menyimpan sesi pengguna:', e);
    }
  },

  clearUser: () => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(AUTH_KEY);
        localStorage.removeItem(TAB_KEY);
      }
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(AUTH_KEY);
        sessionStorage.removeItem(TAB_KEY);
      }
      if (typeof document !== 'undefined') {
        document.cookie = `${AUTH_KEY}=; path=/; max-age=0; SameSite=Lax`;
      }
    } catch (e) {
      console.warn('Gagal menghapus sesi:', e);
    }
  },

  getActiveTab: (): string => {
    try {
      if (typeof localStorage !== 'undefined') {
        const val = localStorage.getItem(TAB_KEY);
        if (val) return val;
      }
      if (typeof sessionStorage !== 'undefined') {
        const val = sessionStorage.getItem(TAB_KEY);
        if (val) return val;
      }
    } catch {
      // ignore
    }
    return 'dashboard';
  },

  setActiveTab: (tab: string) => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(TAB_KEY, tab);
      }
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(TAB_KEY, tab);
      }
    } catch {
      // ignore
    }
  }
};
