import { LaporanPBJ, ReferensiRUP, User, Modul } from '../types';
import { api } from './api';

const cleanLaporanData = (entry: LaporanPBJ): Partial<LaporanPBJ> => {
  const { sisa_kontrak, persen_keuangan, deviasi_fisik, ...cleanData } = entry;
  return {
    ...cleanData,
    kontrak_tanggal: cleanData.kontrak_tanggal || '',
    tgl_sp2d: cleanData.tgl_sp2d || ''
  };
};

export const dbService = {
  // Bidang
  getBidang: async (): Promise<string[]> => {
    return api.getBidang();
  },

  addBidang: async (nama: string): Promise<void> => {
    await api.addBidang(nama);
  },

  addBidangBulk: async (namaList: string[]): Promise<void> => {
    await api.addBidangBulk(namaList);
  },

  deleteBidang: async (nama: string): Promise<void> => {
    await api.deleteBidang(nama);
  },

  // Laporan PBJ
  getLaporan: async (modul: Modul, bidang?: string): Promise<LaporanPBJ[]> => {
    return api.getLaporanPBJ(bidang, modul);
  },

  getAllLaporanForDashboard: async (bidang?: string): Promise<LaporanPBJ[]> => {
    return api.getLaporanPBJ(bidang);
  },

  addLaporan: async (entry: LaporanPBJ): Promise<void> => {
    const dataToInsert = cleanLaporanData(entry) as LaporanPBJ;
    await api.createLaporanPBJ(dataToInsert);
  },

  importLaporan: async (entries: LaporanPBJ[], syncToRUP = true): Promise<void> => {
    const cleanedEntries = entries.map((e) => cleanLaporanData(e) as LaporanPBJ);
    await api.importLaporanPBJ(cleanedEntries);

    if (syncToRUP) {
      const rupItems: ReferensiRUP[] = cleanedEntries
        .filter((e) => e.kode_rup && e.nama_paket)
        .map((e) => ({
          kode_rup: String(e.kode_rup).trim(),
          nama_paket: e.nama_paket,
          pagu: Number(e.pagu) || 0,
          jenis_pengadaan: e.modul,
          satuan_kerja: e.satuan_kerja || 'Dinas Pertanian Lombok Barat',
          metode_pengadaan: e.metode_pengadaan || '-',
          sumber_dana: e.sumber_dana || 'APBD',
        }));

      if (rupItems.length > 0) {
        try {
          await api.importRUP(rupItems);
        } catch (err) {
          console.warn('Gagal sinkronisasi otomatis ke RUP:', err);
        }
      }
    }
  },

  updateLaporan: async (entry: LaporanPBJ): Promise<void> => {
    const cleaned = cleanLaporanData(entry);
    const { id, ...updateData } = cleaned;
    if (!id) throw new Error('ID Laporan tidak valid');
    await api.updateLaporanPBJ(id, updateData);
  },

  deleteLaporan: async (id: number): Promise<void> => {
    if (!id) throw new Error('ID Laporan tidak valid');
    await api.deleteLaporanPBJ(id);
  },

  // Referensi RUP
  getReferensiRUP: async (params?: { q?: string; jenis?: string; limit?: number; offset?: number }): Promise<ReferensiRUP[]> => {
    return api.getRUP(params);
  },

  addReferensiRUP: async (entry: ReferensiRUP): Promise<void> => {
    await api.addRUP(entry);
  },

  deleteReferensiRUP: async (id: number): Promise<void> => {
    if (!id) throw new Error('ID RUP tidak valid');
    await api.deleteRUP(id);
  },

  clearAllReferensiRUP: async (): Promise<void> => {
    await api.clearAllRUP();
  },

  importReferensiRUP: async (entries: ReferensiRUP[]): Promise<void> => {
    await api.importRUP(entries);
  },

  // Users
  getUsers: async (): Promise<User[]> => {
    return api.getUsers();
  },

  addUser: async (user: Omit<User, 'id'>): Promise<void> => {
    await api.addUser(user);
  },

  updateUser: async (user: User): Promise<void> => {
    await api.updateUser(user);
  },

  deleteUser: async (id: number): Promise<void> => {
    if (!id) throw new Error('ID User tidak valid');
    await api.deleteUser(id);
  }
};

export default dbService;
