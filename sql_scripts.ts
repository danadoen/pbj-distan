
export const SQL_INIT_SCRIPTS = `
-- 1. Tabel Users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('Admin', 'Staff')),
    bidang VARCHAR(100)
);

-- 2. Tabel Master Bidang
CREATE TABLE IF NOT EXISTS master_bidang (
    id SERIAL PRIMARY KEY,
    nama_bidang VARCHAR(100) UNIQUE NOT NULL,
    keterangan TEXT
);

-- 3. Tabel Referensi RUP
CREATE TABLE IF NOT EXISTS referensi_rup (
    id SERIAL PRIMARY KEY,
    kode_rup VARCHAR(50) UNIQUE NOT NULL,
    nama_paket TEXT NOT NULL,
    pagu DECIMAL(18,2) NOT NULL DEFAULT 0,
    jenis_pengadaan VARCHAR(20) NOT NULL CHECK (jenis_pengadaan IN ('Penyedia', 'Swakelola')),
    satuan_kerja TEXT,
    metode_pengadaan VARCHAR(100),
    sumber_dana VARCHAR(100)
);

-- 4. Tabel Laporan PBJ
CREATE TABLE IF NOT EXISTS laporan_pbj (
    id SERIAL PRIMARY KEY,
    modul VARCHAR(20) NOT NULL CHECK (modul IN ('Penyedia', 'Swakelola')),
    bidang VARCHAR(100),
    kode_rup VARCHAR(50),
    satuan_kerja TEXT,
    nama_paket TEXT,
    metode_pengadaan VARCHAR(100),
    sumber_dana VARCHAR(100),
    pagu DECIMAL(18,2) DEFAULT 0,
    hps DECIMAL(18,2) DEFAULT 0,
    kontrak_nomor TEXT,
    kontrak_nilai DECIMAL(18,2) DEFAULT 0,
    kontrak_tanggal DATE,
    penyedia TEXT,
    realisasi_keuangan DECIMAL(18,2) DEFAULT 0,
    fisik_rencana DECIMAL(5,2) DEFAULT 0,
    fisik_realisasi DECIMAL(5,2) DEFAULT 0,
    nomor_sp2d TEXT,
    tgl_sp2d DATE
);

-- PENTING: NONAKTIFKAN RLS SECARA TOTAL
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE master_bidang DISABLE ROW LEVEL SECURITY;
ALTER TABLE referensi_rup DISABLE ROW LEVEL SECURITY;
ALTER TABLE laporan_pbj DISABLE ROW LEVEL SECURITY;

-- BERIKAN IZIN AKSES
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Insert Default Bidang
INSERT INTO master_bidang (nama_bidang) VALUES 
('BUN'), ('BITNAK'), ('TPH'), ('PSP'), ('KEUANGAN'), ('PROGRAM'), ('UMUM'), ('PPAT')
ON CONFLICT (nama_bidang) DO NOTHING;

-- Insert Default User
INSERT INTO users (username, password, role) 
VALUES ('admin', 'admin123', 'Admin')
ON CONFLICT (username) DO NOTHING;
`;
