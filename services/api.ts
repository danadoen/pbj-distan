import { LaporanPBJ, ReferensiRUP, User, Role } from '../types';

export const API_BASE_URL = 'https://realisasi-pbj-dinas-pertanian-lombok-barat.wahyudarizki91.workers.dev';

export function getBaseUrl(): string {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) {
    return (import.meta as any).env.VITE_API_URL;
  }
  if (typeof window !== 'undefined' && window.location) {
    // Jika aplikasi dibuka langsung dari domain worker, gunakan relative path agar tanpa CORS preflight
    if (window.location.hostname.includes('realisasi-pbj-dinas-pertanian-lombok-barat') ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1') {
      return '';
    }
  }
  return API_BASE_URL;
}

export async function apiRequest<T = any>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any
): Promise<T> {
  const base = getBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = base ? `${base}${cleanEndpoint}` : cleanEndpoint;
  
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };

  if (body !== undefined && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  
  let data: any;
  try {
    data = await response.json();
  } catch {
    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    }
    return {} as T;
  }

  if (!response.ok) {
    const errorMsg = data?.message || data?.error || `Request gagal dengan status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

// Default initial bidang list
const DEFAULT_BIDANG = ['Sekretariat', 'Tanaman Pangan', 'Hortikultura', 'Perkebunan', 'Peternakan dan Keswan', 'PSP'];

export const api = {
  // Autentikasi
  login: async (credentials: { username: string; password?: string }): Promise<{ success: boolean; user: User; message?: string }> => {
    try {
      const res = await apiRequest<{ success: boolean; user: any; message?: string }>('/api/login', 'POST', credentials);
      if (res?.user) {
        const normalizedRole = String(res.user.role).toLowerCase() === 'admin' ? Role.ADMIN : Role.STAFF;
        res.user.role = normalizedRole;
      }
      return res as { success: boolean; user: User; message?: string };
    } catch (err: any) {
      const is405OrNetwork =
        err?.message?.includes('405') ||
        err?.message?.includes('Failed to fetch') ||
        err?.message?.includes('NetworkError');

      const u = (credentials.username || '').trim().toLowerCase();
      const p = (credentials.password || '').trim();

      // Fallback offline jika worker backend belum selesai di-deploy atau mengembalikan 405
      if (is405OrNetwork && (u === 'admin' || u === 'superadmin') && (p === 'admin123' || p === '123' || p === 'admin')) {
        return {
          success: true,
          user: {
            id: 1,
            username: u,
            role: Role.ADMIN,
            bidang: 'Sekretariat',
          },
          message: 'Login berhasil (mode offline/fallback). Silakan jalankan `npx wrangler deploy` untuk mengaktifkan Cloudflare D1.',
        };
      }
      throw err;
    }
  },

  // Master Data Bidang
  getBidang: async (): Promise<string[]> => {
    try {
      const res = await apiRequest<{ success: boolean; data: Array<{ nama_bidang: string }> | string[] }>('/api/bidang', 'GET');
      if (Array.isArray(res.data)) {
        return res.data.map((item: any) => (typeof item === 'string' ? item : item.nama_bidang));
      }
      return DEFAULT_BIDANG;
    } catch {
      return DEFAULT_BIDANG;
    }
  },

  addBidang: async (nama: string): Promise<any> => {
    return apiRequest('/api/bidang', 'POST', { nama_bidang: nama });
  },

  addBidangBulk: async (namaList: string[]): Promise<any> => {
    return apiRequest('/api/bidang', 'POST', namaList);
  },

  deleteBidang: async (nama: string): Promise<any> => {
    return apiRequest(`/api/bidang?nama=${encodeURIComponent(nama)}`, 'DELETE');
  },

  // Referensi RUP
  getRUP: async (params?: { q?: string; jenis?: string; limit?: number; offset?: number }): Promise<ReferensiRUP[]> => {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.set('q', params.q);
    if (params?.jenis) searchParams.set('jenis', params.jenis);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    
    const queryStr = searchParams.toString();
    const endpoint = queryStr ? `/api/rup?${queryStr}` : '/api/rup';
    try {
      const res = await apiRequest<{ success: boolean; data: ReferensiRUP[] }>(endpoint, 'GET');
      return (res.data || []).map((r: any) => ({ ...r, pagu: Number(r.pagu) }));
    } catch {
      return [];
    }
  },

  addRUP: async (payload: ReferensiRUP): Promise<any> => {
    return apiRequest('/api/rup', 'POST', payload);
  },

  importRUP: async (payload: ReferensiRUP[]): Promise<any> => {
    return apiRequest('/api/rup', 'POST', payload);
  },

  deleteRUP: async (id: number): Promise<any> => {
    return apiRequest(`/api/rup/${id}`, 'DELETE');
  },

  clearAllRUP: async (): Promise<any> => {
    return apiRequest('/api/rup', 'DELETE');
  },

  // Laporan PBJ CRUD
  getLaporanPBJ: async (filterBidang?: string, filterModul?: string): Promise<LaporanPBJ[]> => {
    const searchParams = new URLSearchParams();
    if (filterBidang) searchParams.set('bidang', filterBidang);
    if (filterModul) searchParams.set('modul', filterModul);
    const queryStr = searchParams.toString();
    const endpoint = queryStr ? `/api/laporan-pbj?${queryStr}` : '/api/laporan-pbj';
    
    try {
      const res = await apiRequest<{ success: boolean; data: LaporanPBJ[] }>(endpoint, 'GET');
      return (res.data || []).map((l: any) => ({
        ...l,
        pagu: Number(l.pagu),
        hps: Number(l.hps),
        kontrak_nilai: Number(l.kontrak_nilai),
        realisasi_keuangan: Number(l.realisasi_keuangan),
        fisik_rencana: Number(l.fisik_rencana),
        fisik_realisasi: Number(l.fisik_realisasi),
        sisa_kontrak: Number(l.pagu) - Number(l.realisasi_keuangan),
        persen_keuangan: Number(l.pagu) > 0 ? (Number(l.realisasi_keuangan) / Number(l.pagu)) * 100 : 0,
        deviasi_fisik: Number(l.fisik_rencana) - Number(l.fisik_realisasi)
      }));
    } catch {
      return [];
    }
  },

  createLaporanPBJ: async (payload: LaporanPBJ): Promise<any> => {
    return apiRequest('/api/laporan-pbj', 'POST', payload);
  },

  updateLaporanPBJ: async (id: number | string, payload: Partial<LaporanPBJ>): Promise<any> => {
    return apiRequest(`/api/laporan-pbj/${id}`, 'PUT', payload);
  },

  deleteLaporanPBJ: async (id: number | string): Promise<any> => {
    return apiRequest(`/api/laporan-pbj/${id}`, 'DELETE');
  },

  // User Management
  getUsers: async (): Promise<User[]> => {
    try {
      const res = await apiRequest<{ success: boolean; data: User[] }>('/api/users', 'GET');
      return res.data || [];
    } catch {
      return [
        { id: 1, username: 'admin', role: Role.ADMIN, bidang: 'Sekretariat' }
      ];
    }
  },

  addUser: async (user: Omit<User, 'id'>): Promise<any> => {
    return apiRequest('/api/users', 'POST', user);
  },

  updateUser: async (user: User): Promise<any> => {
    return apiRequest(`/api/users/${user.id}`, 'PUT', user);
  },

  deleteUser: async (id: number): Promise<any> => {
    return apiRequest(`/api/users/${id}`, 'DELETE');
  }
};
