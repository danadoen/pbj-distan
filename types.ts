
export enum Role {
  ADMIN = 'Admin',
  STAFF = 'Staff'
}

export enum Modul {
  PENYEDIA = 'Penyedia',
  SWAKELOLA = 'Swakelola'
}

export interface User {
  id: number;
  username: string;
  password?: string; // Password unik untuk setiap user
  role: Role;
  bidang?: string; // Menampung bidang spesifik user (Staff)
}

export interface ReferensiRUP {
  id?: number;
  kode_rup: string;
  nama_paket: string;
  pagu: number;
  jenis_pengadaan: Modul;
  satuan_kerja?: string;
  metode_pengadaan?: string;
  sumber_dana?: string;
}

export interface LaporanPBJ {
  id?: number;
  modul: Modul;
  bidang: string;
  kode_rup: string;
  satuan_kerja: string;
  nama_paket: string;
  metode_pengadaan: string;
  sumber_dana: string;
  pagu: number;
  hps: number;
  kontrak_nomor: string;
  kontrak_nilai: number;
  kontrak_tanggal: string;
  penyedia: string;
  realisasi_keuangan: number;
  fisik_rencana: number;
  fisik_realisasi: number;
  nomor_sp2d: string;
  tgl_sp2d: string;
  sisa_kontrak?: number;
  persen_keuangan?: number;
  deviasi_fisik?: number;
}
