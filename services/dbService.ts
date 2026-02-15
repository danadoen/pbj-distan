
import { LaporanPBJ, ReferensiRUP, User, Role, Modul } from '../types';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ziyfssoaxjnjjnfsudkp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppeWZzc29heGpuampuZnN1ZGtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTY1OTAsImV4cCI6MjA4NjY3MjU5MH0.Hc1WeuFmItPXpTiStsHA5biTYVf6pi91_Gpg2DcnSr8'; 

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const cleanLaporanData = (entry: LaporanPBJ) => {
  const { sisa_kontrak, persen_keuangan, deviasi_fisik, ...cleanData } = entry;
  return {
    ...cleanData,
    kontrak_tanggal: cleanData.kontrak_tanggal || null,
    tgl_sp2d: cleanData.tgl_sp2d || null
  };
};

export const dbService = {
  // --- MASTER BIDANG ---
  getBidang: async (): Promise<string[]> => {
    const { data, error } = await supabase.from('master_bidang').select('nama_bidang').order('nama_bidang', { ascending: true });
    if (error) throw error;
    return (data || []).map(b => b.nama_bidang);
  },

  addBidang: async (nama: string): Promise<void> => {
    const { error } = await supabase.from('master_bidang').insert([{ nama_bidang: nama }]);
    if (error) throw error;
  },

  addBidangBulk: async (namaList: string[]): Promise<void> => {
    const payload = namaList.map(nama => ({ nama_bidang: nama.trim().toUpperCase() }));
    const { error } = await supabase.from('master_bidang').insert(payload);
    if (error) throw error;
  },

  deleteBidang: async (nama: string): Promise<void> => {
    const { error } = await supabase.from('master_bidang').delete().eq('nama_bidang', nama);
    if (error) throw error;
  },

  // --- LAPORAN PBJ ---
  getLaporan: async (modul: Modul, bidang?: string): Promise<LaporanPBJ[]> => {
    let query = supabase.from('laporan_pbj').select('*').eq('modul', modul);
    if (bidang) query = query.eq('bidang', bidang);
    const { data, error } = await query.order('id', { ascending: false });
    if (error) throw error;
    return (data || []).map((l: any) => ({
      ...l,
      pagu: Number(l.pagu),
      hps: Number(l.hps),
      kontrak_nilai: Number(l.kontrak_nilai),
      realisasi_keuangan: Number(l.realisasi_keuangan),
      fisik_rencana: Number(l.fisik_rencana),
      fisik_realisasi: Number(l.fisik_realisasi),
      sisa_kontrak: Number(l.pagu) - Number(l.realisasi_keuangan),
      persen_keuangan: Number(l.pagu) > 0 ? (Number(l.realisasi_keuangan) / Number(l.pagu)) * 100 : 0,
      deviasi_fisik: Number(l.fisik_realisasi) - Number(l.fisik_rencana)
    }));
  },

  getAllLaporanForDashboard: async (bidang?: string): Promise<LaporanPBJ[]> => {
    let query = supabase.from('laporan_pbj').select('*');
    if (bidang) query = query.eq('bidang', bidang);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((l: any) => ({
      ...l,
      pagu: Number(l.pagu),
      realisasi_keuangan: Number(l.realisasi_keuangan),
      fisik_rencana: Number(l.fisik_rencana),
      fisik_realisasi: Number(l.fisik_realisasi)
    }));
  },

  addLaporan: async (entry: LaporanPBJ): Promise<void> => {
    const dataToInsert = cleanLaporanData(entry);
    const { error } = await supabase.from('laporan_pbj').insert([dataToInsert]);
    if (error) throw error;
  },

  updateLaporan: async (entry: LaporanPBJ): Promise<void> => {
    const cleaned = cleanLaporanData(entry);
    const { id, ...updateData } = cleaned;
    const { error } = await supabase.from('laporan_pbj').update(updateData).eq('id', Number(id));
    if (error) throw error;
  },

  deleteLaporan: async (id: number): Promise<void> => {
    if (!id) throw new Error("ID Laporan tidak valid");
    const { error } = await supabase
      .from('laporan_pbj')
      .delete()
      .eq('id', Number(id));
    
    if (error) {
      console.error("Supabase Delete Laporan Error:", error);
      throw error;
    }
  },

  // --- REFERENSI RUP ---
  getReferensiRUP: async (): Promise<ReferensiRUP[]> => {
    const { data, error } = await supabase.from('referensi_rup').select('*').order('id', { ascending: false });
    if (error) throw error;
    return (data || []).map(r => ({ ...r, pagu: Number(r.pagu) }));
  },

  addReferensiRUP: async (entry: ReferensiRUP): Promise<void> => {
    const { error } = await supabase.from('referensi_rup').insert([entry]);
    if (error) throw error;
  },

  deleteReferensiRUP: async (id: number): Promise<void> => {
    if (!id) throw new Error("ID RUP tidak valid");
    const { error } = await supabase
      .from('referensi_rup')
      .delete()
      .eq('id', Number(id));
    
    if (error) {
      console.error("Supabase Delete RUP Error:", error);
      throw error;
    }
  },

  clearAllReferensiRUP: async (): Promise<void> => {
    const { error } = await supabase.from('referensi_rup').delete().neq('id', 0);
    if (error) throw error;
  },

  importReferensiRUP: async (entries: ReferensiRUP[]): Promise<void> => {
    const { error } = await supabase.from('referensi_rup').insert(entries);
    if (error) throw error;
  },

  // --- USERS ---
  getUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('*').order('id', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  addUser: async (user: Omit<User, 'id'>): Promise<void> => {
    const { error } = await supabase.from('users').insert([user]);
    if (error) throw error;
  },

  updateUser: async (user: User): Promise<void> => {
    const { id, ...updateData } = user;
    const { error } = await supabase.from('users').update(updateData).eq('id', Number(id));
    if (error) throw error;
  },

  deleteUser: async (id: number): Promise<void> => {
    if (!id) throw new Error("ID User tidak valid");
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', Number(id));
    
    if (error) {
      console.error("Supabase Delete User Error:", error);
      throw error;
    }
  }
};
