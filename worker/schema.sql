-- ====================================================================
-- SKEMA CLOUDFLARE D1 (SQLITE) UNTUK REALISASI PBJ DINAS PERTANIAN
-- Database: realisasipbj (1a9d87c0-3fef-4066-aecd-d50ed8ee8dca)
-- ====================================================================

-- 1. TABEL USERS
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Admin', 'Staff')),
    bidang TEXT
);

-- 2. TABEL MASTER BIDANG
CREATE TABLE IF NOT EXISTS master_bidang (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama_bidang TEXT UNIQUE NOT NULL,
    keterangan TEXT
);

-- 3. TABEL REFERENSI RUP
CREATE TABLE IF NOT EXISTS referensi_rup (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    kode_rup TEXT UNIQUE NOT NULL,
    nama_paket TEXT NOT NULL,
    pagu REAL NOT NULL DEFAULT 0,
    jenis_pengadaan TEXT NOT NULL CHECK (jenis_pengadaan IN ('Penyedia', 'Swakelola')),
    satuan_kerja TEXT,
    metode_pengadaan TEXT,
    sumber_dana TEXT
);

-- 4. TABEL LAPORAN PBJ
CREATE TABLE IF NOT EXISTS laporan_pbj (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    modul TEXT NOT NULL CHECK (modul IN ('Penyedia', 'Swakelola')),
    bidang TEXT,
    kode_rup TEXT,
    satuan_kerja TEXT,
    nama_paket TEXT,
    metode_pengadaan TEXT,
    sumber_dana TEXT,
    pagu REAL DEFAULT 0,
    hps REAL DEFAULT 0,
    kontrak_nomor TEXT,
    kontrak_nilai REAL DEFAULT 0,
    kontrak_tanggal TEXT,
    penyedia TEXT,
    realisasi_keuangan REAL DEFAULT 0,
    fisik_rencana REAL DEFAULT 0,
    fisik_realisasi REAL DEFAULT 0,
    nomor_sp2d TEXT,
    tgl_sp2d TEXT
);

-- Indeks untuk performa query cepat
CREATE INDEX IF NOT EXISTS idx_laporan_modul ON laporan_pbj(modul);
CREATE INDEX IF NOT EXISTS idx_laporan_bidang ON laporan_pbj(bidang);
CREATE INDEX IF NOT EXISTS idx_rup_jenis ON referensi_rup(jenis_pengadaan);

-- SEED DATA AWAL: MASTER BIDANG
INSERT OR IGNORE INTO master_bidang (nama_bidang) VALUES 
('BUN'), ('BITNAK'), ('TPH'), ('PSP'), ('KEUANGAN'), ('PROGRAM'), ('UMUM'), ('PPAT');

-- SEED DATA AWAL: DEFAULT ADMIN USER
INSERT OR IGNORE INTO users (username, password, role) 
VALUES ('admin', 'admin123', 'Admin');
