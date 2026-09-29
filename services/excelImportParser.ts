import * as XLSX from 'xlsx';
import { LaporanPBJ, Modul, ReferensiRUP } from '../types';

export interface ParsedLaporanResult {
  items: LaporanPBJ[];
  detectedHeaderInfo: string;
  headerRowIndex: number;
  dataStartRowIndex: number;
  mappedColumns: Record<string, number>;
  warnings: string[];
}

/**
 * Parse TSV (Tab-Separated Values) copied from Excel, properly handling
 * double-quoted cells that contain newlines (e.g. "PENYEDIA\n(PT, CV, UD, dll)")
 * and escaped double quotes ("").
 */
export function parseExcelTSV(rawText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += ch;
      }
    } else {
      if (ch === '"' && currentCell.trim() === '') {
        inQuotes = true;
      } else if (ch === '\t') {
        currentRow.push(currentCell.replace(/\s+/g, ' ').trim());
        currentCell = '';
      } else if (ch === '\n') {
        currentRow.push(currentCell.replace(/\s+/g, ' ').trim());
        if (currentRow.some((c) => c !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += ch;
      }
    }
  }

  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell.replace(/\s+/g, ' ').trim());
    if (currentRow.some((c) => c !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Convert an XLSX Worksheet into a 2D string grid while propagating merged header values
 * so multi-row/multi-column Excel headers are preserved cleanly.
 */
export function worksheetToGrid(worksheet: XLSX.WorkSheet): string[][] {
  const rawGrid = XLSX.utils.sheet_to_json<any[]>(worksheet, {
    header: 1,
    defval: '',
    raw: false,
  });

  const grid: string[][] = rawGrid.map((row) =>
    Array.isArray(row)
      ? row.map((cell) => String(cell ?? '').replace(/\s+/g, ' ').trim())
      : []
  );

  // Also check merges in the first 30 rows to help header propagation if needed
  const merges = worksheet['!merges'] || [];
  for (const merge of merges) {
    if (merge.s.r <= 30 && grid[merge.s.r]) {
      const topLeftVal = grid[merge.s.r][merge.s.c] || '';
      if (!topLeftVal) continue;
      // For horizontal merges in header rows, we keep them empty in grid or let smart parser carry forward
      // For vertical merges (e.g. Kode RUP merged across row 1 and row 2), keeping top row value is already standard
    }
  }

  return grid.filter((row) => row.some((c) => c !== ''));
}

/**
 * Normalize header text for fuzzy matching
 */
function norm(str: string): string {
  return (str || '')
    .toLowerCase()
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detect whether a row is the numbering row under the header:
 * e.g. `1 | 2 |  | 4 | 5 | ... | 14,00 | 15,00 | 16,00 | 17,00 | 18 | 19 | 20`
 * or `1 | 2 | 3 | 4 | ... | 20`
 */
export function isColumnNumberingRow(row: string[]): boolean {
  const nonEmpty = row.map((c) => c.trim()).filter((c) => c !== '');
  if (nonEmpty.length < 5) return false;

  let validCount = 0;
  let prevNum = 0;
  let increasingCount = 0;

  for (const cell of nonEmpty) {
    // Matches "1", "14,00", "14.00", "(1)", "[1]"
    const cleaned = cell.replace(/^[(\[]|[)\]]$/g, '').replace(',', '.');
    if (!/^\d+(\.0+)?$/.test(cleaned)) {
      return false;
    }
    const num = parseFloat(cleaned);
    if (num >= 1 && num <= 35) {
      validCount++;
      if (num > prevNum) {
        increasingCount++;
        prevNum = num;
      }
    } else {
      return false;
    }
  }

  return validCount === nonEmpty.length && increasingCount >= Math.floor(nonEmpty.length * 0.7);
}

/**
 * Parse Indonesian or international formatted currency strings into integer Rupiah
 */
export function parseRupiah(val: any): number {
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : Math.round(val);
  }
  let s = String(val ?? '')
    .replace(/Rp\.?/gi, '')
    .replace(/IDR/gi, '')
    .replace(/\s+/g, '')
    .trim();

  if (!s || s === '-' || s === 'nihil' || s.toLowerCase() === 'null') return 0;

  // Handle negative sign
  const isNegative = s.startsWith('-') || (s.startsWith('(') && s.endsWith(')'));
  s = s.replace(/^[-(]+|[)]+$/g, '');

  // Case 1: Ends with ,00 or ,XX and contains dots as thousands separator (e.g. 150.000.000,00)
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  // Case 2: Ends with .00 or .XX and contains commas as thousands separator (e.g. 150,000,000.00)
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    s = s.replace(/,/g, '');
  }
  // Case 3: Plain digits with comma decimal (e.g. 150000000,00)
  else if (/^\d+(,\d{1,2})$/.test(s)) {
    s = s.replace(',', '.');
  }
  // Case 4: Plain digits with dot decimal (e.g. 150000000.00)
  else if (/^\d+(\.\d{1,2})$/.test(s)) {
    // keep as is
  } else {
    // Fallback: strip all non-digits
    s = s.replace(/[^0-9]/g, '');
  }

  const num = parseFloat(s);
  if (isNaN(num)) return 0;
  return isNegative ? -Math.round(num) : Math.round(num);
}

/**
 * Parse percentage value (e.g. "14,00", "85,5%", "100.00", 85.5)
 */
export function parsePercent(val: any): number {
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : Math.round(val * 100) / 100;
  }
  let s = String(val ?? '')
    .replace(/%/g, '')
    .replace(/\s+/g, '')
    .trim();

  if (!s || s === '-') return 0;

  // Replace comma decimal with dot
  if (s.includes(',') && !s.includes('.')) {
    s = s.replace(',', '.');
  } else if (s.includes('.') && s.includes(',')) {
    // e.g. 1.000,00 or 1,000.00
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  }

  const num = parseFloat(s);
  if (isNaN(num)) return 0;
  return Math.round(num * 100) / 100;
}

/**
 * Score how much a row looks like Main Header Row 1:
 * Kode RUP | Satuan Kerja | Nama Paket | Metode Pengadaan | Jenis Pengadaan | Sumber Dana | Nilai Pagu (Rp) | HPS (Rp) | DATA KONTRAK AWAL DAN ADDENDUM | KEUANGAN | FISIK | SP2D | SISA ANGGARAN (Rp) | Bidang
 */
function scoreMainHeaderRow(row: string[]): number {
  let score = 0;
  const cells = row.map(norm);
  for (const c of cells) {
    if (!c) continue;
    if (c.includes('kode rup') || c === 'rup') score += 4;
    if (c.includes('satuan kerja') || c.includes('satker')) score += 3;
    if (c.includes('nama paket') || c.includes('paket pekerjaan')) score += 4;
    if (c.includes('metode pengadaan') || c === 'metode') score += 3;
    if (c.includes('jenis pengadaan')) score += 2;
    if (c.includes('sumber dana')) score += 3;
    if (c.includes('nilai pagu') || c.includes('pagu anggaran') || c.startsWith('pagu')) score += 3;
    if (c.includes('hps')) score += 3;
    if (c.includes('data kontrak') || c.includes('kontrak awal')) score += 3;
    if (c === 'keuangan' || c.includes('realisasi keuangan')) score += 2;
    if (c === 'fisik' || c.includes('fisik rencana')) score += 2;
    if (c.includes('sp2d') || c.includes('kuitansi')) score += 2;
    if (c.includes('sisa anggaran') || c.includes('sisa kontrak')) score += 2;
    if (c === 'bidang' || c.includes('bidang')) score += 2;
  }
  return score;
}

/**
 * Score how much a row looks like Sub Header Row 2:
 * NOMOR | NILAI (Rp,) | TANGGAL/MASA PELAKSANAAN | PENYEDIA (PT, CV, UD, dll) | REALISASI (Rp.) | % | RENCANA (%) | REALISASI (%) | DEVIASI (%) | NOMOR | TGL
 */
function scoreSubHeaderRow(row: string[]): number {
  let score = 0;
  const cells = row.map(norm);
  for (const c of cells) {
    if (!c) continue;
    if (c === 'nomor' || c.startsWith('nomor')) score += 2;
    if (c.includes('nilai') && c.includes('rp')) score += 3;
    if (c.includes('tanggal/masa') || c.includes('masa pelaksanaan') || c.includes('tgl/masa')) score += 4;
    if (c.includes('penyedia') || c.includes('pt, cv')) score += 4;
    if (c.includes('realisasi') && c.includes('rp')) score += 3;
    if (c === '%') score += 2;
    if (c.includes('rencana')) score += 3;
    if (c.includes('realisasi') && c.includes('%')) score += 3;
    if (c.includes('deviasi')) score += 3;
    if (c === 'tgl' || c === 'tanggal') score += 2;
  }
  return score;
}

/**
 * Build column index map from detected header row(s) or fallback to standard 21-column layout.
 */
function buildColumnMapping(
  grid: string[][],
  mainHeaderIdx: number,
  subHeaderIdx: number
): Record<string, number> {
  const map: Record<string, number> = {};

  if (mainHeaderIdx >= 0) {
    const h1 = grid[mainHeaderIdx] || [];
    let h2 = subHeaderIdx >= 0 ? [...(grid[subHeaderIdx] || [])] : [];

    // If h2 had its leading empty tabs stripped (e.g. starts with "NOMOR" at index 0 while h1 has "DATA KONTRAK" at index 8), realign h2
    const kontrakColInH1 = h1.findIndex((c) => norm(c).includes('kontrak'));
    if (h2.length > 0 && kontrakColInH1 > 0 && norm(h2[0]).startsWith('nomor') && h2.length <= h1.length - kontrakColInH1 + 2) {
      h2 = [...Array(kontrakColInH1).fill(''), ...h2];
    }

    const maxCols = Math.max(h1.length, h2.length);

    // Carry forward group headers across empty cells in H1 (for merged cells like DATA KONTRAK, KEUANGAN, FISIK, SP2D)
    const groupCarry: string[] = [];
    let currentGroup = '';
    for (let c = 0; c < maxCols; c++) {
      const top = norm(h1[c] || '');
      if (top) {
        currentGroup = top;
      }
      groupCarry[c] = currentGroup;
    }

    for (let c = 0; c < maxCols; c++) {
      const top = norm(h1[c] || '');
      const sub = norm(h2[c] || '');
      const grp = groupCarry[c] || '';

      // 1. Primary top-level columns
      if ((top.includes('kode') && top.includes('rup')) || top === 'rup' || (sub.includes('kode') && sub.includes('rup'))) {
        if (map.kode_rup === undefined) map.kode_rup = c;
        continue;
      }
      if (top.includes('satuan kerja') || top.includes('satker') || sub.includes('satuan kerja')) {
        if (map.satuan_kerja === undefined) map.satuan_kerja = c;
        continue;
      }
      if (top.includes('nama paket') || top.includes('paket pekerjaan') || sub.includes('nama paket')) {
        if (map.nama_paket === undefined) map.nama_paket = c;
        continue;
      }
      if (top.includes('metode') || sub.includes('metode')) {
        if (map.metode_pengadaan === undefined) map.metode_pengadaan = c;
        continue;
      }
      if (top.includes('jenis pengadaan') || sub.includes('jenis pengadaan')) {
        if (map.jenis_pengadaan === undefined) map.jenis_pengadaan = c;
        continue;
      }
      if (top.includes('sumber dana') || sub.includes('sumber dana')) {
        if (map.sumber_dana === undefined) map.sumber_dana = c;
        continue;
      }
      if (top.includes('pagu') || sub.includes('pagu')) {
        if (map.pagu === undefined) map.pagu = c;
        continue;
      }
      if (top.includes('hps') || sub.includes('hps')) {
        if (map.hps === undefined) map.hps = c;
        continue;
      }
      if (top === 'bidang' || top.includes('bidang') || sub === 'bidang' || sub.includes('bidang')) {
        if (map.bidang === undefined) map.bidang = c;
        continue;
      }
      if (top.includes('sisa anggaran') || top.includes('sisa kontrak') || sub.includes('sisa anggaran')) {
        if (map.sisa_kontrak === undefined) map.sisa_kontrak = c;
        continue;
      }

      // 2. Single-row exported Excel headers (e.g. from Export Excel button)
      if (top.includes('nomor kontrak') || top.includes('no kontrak')) {
        if (map.kontrak_nomor === undefined) map.kontrak_nomor = c;
        continue;
      }
      if (top.includes('nilai kontrak')) {
        if (map.kontrak_nilai === undefined) map.kontrak_nilai = c;
        continue;
      }
      if (top.includes('tanggal kontrak') || top.includes('tanggal/masa')) {
        if (map.kontrak_tanggal === undefined) map.kontrak_tanggal = c;
        continue;
      }
      if (top === 'penyedia' || top.startsWith('penyedia')) {
        if (map.penyedia === undefined) map.penyedia = c;
        continue;
      }
      if (top.includes('realisasi keuangan')) {
        if (map.realisasi_keuangan === undefined) map.realisasi_keuangan = c;
        continue;
      }
      if (top.includes('fisik rencana')) {
        if (map.fisik_rencana === undefined) map.fisik_rencana = c;
        continue;
      }
      if (top.includes('fisik realisasi')) {
        if (map.fisik_realisasi === undefined) map.fisik_realisasi = c;
        continue;
      }
      if (top.includes('nomor sp2d') || top.includes('no sp2d')) {
        if (map.nomor_sp2d === undefined) map.nomor_sp2d = c;
        continue;
      }
      if (top.includes('tanggal sp2d') || top.includes('tgl sp2d')) {
        if (map.tgl_sp2d === undefined) map.tgl_sp2d = c;
        continue;
      }

      // 3. Sub-headers under DATA KONTRAK AWAL DAN ADDENDUM / KEUANGAN / FISIK / SP2D
      if (sub) {
        if (sub.includes('penyedia') || sub.includes('pt, cv')) {
          if (map.penyedia === undefined) map.penyedia = c;
          continue;
        }
        if (sub.includes('tanggal/masa') || sub.includes('masa pelaksanaan') || sub.includes('tgl/masa')) {
          if (map.kontrak_tanggal === undefined) map.kontrak_tanggal = c;
          continue;
        }
        if (sub.includes('nilai') && (grp.includes('kontrak') || map.kontrak_nilai === undefined)) {
          if (map.kontrak_nilai === undefined) map.kontrak_nilai = c;
          continue;
        }
        if (sub.includes('rencana')) {
          if (map.fisik_rencana === undefined) map.fisik_rencana = c;
          continue;
        }
        if (sub.includes('deviasi')) {
          if (map.deviasi_fisik === undefined) map.deviasi_fisik = c;
          continue;
        }
        if (sub.includes('realisasi')) {
          if (grp.includes('fisik') || sub.includes('%') || map.realisasi_keuangan !== undefined) {
            if (map.fisik_realisasi === undefined) map.fisik_realisasi = c;
          } else {
            if (map.realisasi_keuangan === undefined) map.realisasi_keuangan = c;
          }
          continue;
        }
        if (sub === 'nomor' || sub.startsWith('nomor')) {
          if (grp.includes('sp2d') || grp.includes('kuitansi') || map.kontrak_nomor !== undefined) {
            if (map.nomor_sp2d === undefined) map.nomor_sp2d = c;
          } else {
            if (map.kontrak_nomor === undefined) map.kontrak_nomor = c;
          }
          continue;
        }
        if (sub === 'tgl' || sub === 'tanggal' || sub.startsWith('tgl')) {
          if (grp.includes('sp2d') || grp.includes('kuitansi') || map.kontrak_tanggal !== undefined) {
            if (map.tgl_sp2d === undefined) map.tgl_sp2d = c;
          } else {
            if (map.kontrak_tanggal === undefined) map.kontrak_tanggal = c;
          }
          continue;
        }
      }
    }

    // Special fallback if H1 was detected (e.g. DATA KONTRAK AWAL DAN ADDENDUM at col 8)
    // but H2 was not present or partially empty: fill known group offsets
    if (map.kode_rup !== undefined && map.kontrak_nomor === undefined) {
      const kontrakGroupCol = h1.findIndex((cell) => norm(cell).includes('kontrak'));
      if (kontrakGroupCol >= 0) {
        map.kontrak_nomor = kontrakGroupCol;
        map.kontrak_nilai = kontrakGroupCol + 1;
        map.kontrak_tanggal = kontrakGroupCol + 2;
        map.penyedia = kontrakGroupCol + 3;
      }
      const keuGroupCol = h1.findIndex((cell) => norm(cell) === 'keuangan' || norm(cell).includes('keuangan'));
      if (keuGroupCol >= 0 && map.realisasi_keuangan === undefined) {
        map.realisasi_keuangan = keuGroupCol;
      }
      const fisikGroupCol = h1.findIndex((cell) => norm(cell) === 'fisik' || norm(cell).includes('fisik'));
      if (fisikGroupCol >= 0 && map.fisik_rencana === undefined) {
        map.fisik_rencana = fisikGroupCol;
        map.fisik_realisasi = fisikGroupCol + 1;
      }
      const sp2dGroupCol = h1.findIndex((cell) => norm(cell).includes('sp2d') || norm(cell).includes('kuitansi'));
      if (sp2dGroupCol >= 0 && map.nomor_sp2d === undefined) {
        map.nomor_sp2d = sp2dGroupCol;
        map.tgl_sp2d = sp2dGroupCol + 1;
      }
    }

    return map;
  }

  // Case where ONLY Sub-Header Row 2 was copied (without Main Header Row 1)
  if (subHeaderIdx >= 0) {
    const h2 = grid[subHeaderIdx] || [];
    for (let c = 0; c < h2.length; c++) {
      const sub = norm(h2[c] || '');
      if (!sub) continue;
      if (sub === 'nomor' || sub.startsWith('nomor')) {
        if (map.kontrak_nomor === undefined) map.kontrak_nomor = c;
        else if (map.nomor_sp2d === undefined) map.nomor_sp2d = c;
      } else if (sub.includes('nilai')) {
        if (map.kontrak_nilai === undefined) map.kontrak_nilai = c;
      } else if (sub.includes('tanggal/masa') || sub.includes('masa pelaksanaan')) {
        if (map.kontrak_tanggal === undefined) map.kontrak_tanggal = c;
      } else if (sub.includes('penyedia') || sub.includes('pt, cv')) {
        if (map.penyedia === undefined) map.penyedia = c;
      } else if (sub.includes('realisasi') && sub.includes('rp')) {
        if (map.realisasi_keuangan === undefined) map.realisasi_keuangan = c;
      } else if (sub.includes('rencana')) {
        if (map.fisik_rencana === undefined) map.fisik_rencana = c;
      } else if (sub.includes('realisasi') && (sub.includes('%') || map.realisasi_keuangan !== undefined)) {
        if (map.fisik_realisasi === undefined) map.fisik_realisasi = c;
      } else if (sub === 'tgl' || sub === 'tanggal') {
        if (map.tgl_sp2d === undefined) map.tgl_sp2d = c;
      }
    }

    // Infer the 8 prefix columns before kontrak_nomor if kontrak_nomor >= 8
    const kn = map.kontrak_nomor;
    if (kn !== undefined && kn >= 8) {
      const offset = kn - 8;
      map.kode_rup = offset + 0;
      map.satuan_kerja = offset + 1;
      map.nama_paket = offset + 2;
      map.metode_pengadaan = offset + 3;
      map.jenis_pengadaan = offset + 4;
      map.sumber_dana = offset + 5;
      map.pagu = offset + 6;
      map.hps = offset + 7;
    }
    if (map.tgl_sp2d !== undefined) {
      map.sisa_kontrak = map.tgl_sp2d + 1;
      map.bidang = map.tgl_sp2d + 2;
    }
    return map;
  }

  // Fallback when no headers are present at all (pure data rows pasted from the 21-column Excel table)
  // Check if column 0 is a small sequential row number (1, 2, 3...) while column 1 is Kode RUP
  const sampleRows = grid.filter((r) => !isColumnNumberingRow(r)).slice(0, 5);
  let hasLeadingNoCol = false;
  if (sampleRows.length > 0 && (sampleRows[0]?.length || 0) >= 21) {
    const col0SmallInt = sampleRows.every((r) => /^\d{1,3}$/.test((r[0] || '').trim()));
    const col1LooksLikeRup = sampleRows.some((r) => /^\d{5,12}$/.test((r[1] || '').trim()));
    if (col0SmallInt && col1LooksLikeRup) {
      hasLeadingNoCol = true;
    }
  }

  const off = hasLeadingNoCol ? 1 : 0;
  return {
    kode_rup: off + 0,
    satuan_kerja: off + 1,
    nama_paket: off + 2,
    metode_pengadaan: off + 3,
    jenis_pengadaan: off + 4,
    sumber_dana: off + 5,
    pagu: off + 6,
    hps: off + 7,
    kontrak_nomor: off + 8,
    kontrak_nilai: off + 9,
    kontrak_tanggal: off + 10,
    penyedia: off + 11,
    realisasi_keuangan: off + 12,
    persen_keuangan: off + 13,
    fisik_rencana: off + 14,
    fisik_realisasi: off + 15,
    deviasi_fisik: off + 16,
    nomor_sp2d: off + 17,
    tgl_sp2d: off + 18,
    sisa_kontrak: off + 19,
    bidang: off + 20,
  };
}

/**
 * Match bidang string from Excel to existing master bidang list (case-insensitive)
 */
function resolveBidang(rawBidang: string, bidangList: string[], fallbackBidang: string): string {
  const cleaned = (rawBidang || '').trim();
  if (!cleaned || cleaned === '-') {
    return fallbackBidang;
  }
  const found = bidangList.find((b) => b.trim().toLowerCase() === cleaned.toLowerCase());
  return found || cleaned;
}

/**
 * Smart parser that takes a 2D grid (from Excel file or TSV copy-paste),
 * automatically locates the header row(s) and column numbering row,
 * and extracts LaporanPBJ records for Penyedia or Swakelola.
 */
export function smartParseLaporanGrid(
  grid: string[][],
  modul: Modul,
  options: {
    bidangList: string[];
    defaultBidang: string;
    referensiList?: ReferensiRUP[];
  }
): ParsedLaporanResult {
  const warnings: string[] = [];
  if (!grid || grid.length === 0) {
    return {
      items: [],
      detectedHeaderInfo: 'Data kosong',
      headerRowIndex: -1,
      dataStartRowIndex: 0,
      mappedColumns: {},
      warnings: ['Tidak ada baris data yang ditemukan.'],
    };
  }

  // 1. Scan first 30 rows to find Main Header (H1) and Sub Header (H2)
  const scanLimit = Math.min(grid.length, 30);
  let bestMainIdx = -1;
  let bestMainScore = 0;

  for (let r = 0; r < scanLimit; r++) {
    const score = scoreMainHeaderRow(grid[r]);
    if (score > bestMainScore) {
      bestMainScore = score;
      bestMainIdx = r;
    }
  }

  let mainHeaderIdx = bestMainScore >= 6 ? bestMainIdx : -1;
  let subHeaderIdx = -1;

  if (mainHeaderIdx >= 0) {
    // Check if the row immediately below mainHeaderIdx is the sub-header row (NOMOR, NILAI, TANGGAL/MASA, PENYEDIA, etc.)
    if (mainHeaderIdx + 1 < grid.length && scoreSubHeaderRow(grid[mainHeaderIdx + 1]) >= 4) {
      subHeaderIdx = mainHeaderIdx + 1;
    }
  } else {
    // Check if user only copied from Sub-Header Row 2
    for (let r = 0; r < Math.min(grid.length, 10); r++) {
      if (scoreSubHeaderRow(grid[r]) >= 6) {
        subHeaderIdx = r;
        break;
      }
    }
  }

  // Determine where data rows begin
  let dataStartRowIndex = 0;
  if (subHeaderIdx >= 0) {
    dataStartRowIndex = subHeaderIdx + 1;
  } else if (mainHeaderIdx >= 0) {
    dataStartRowIndex = mainHeaderIdx + 1;
  }

  // Skip any column numbering row(s) like `1  2  3  4 ... 20` immediately following the header
  while (
    dataStartRowIndex < grid.length &&
    isColumnNumberingRow(grid[dataStartRowIndex])
  ) {
    dataStartRowIndex++;
  }

  const mappedColumns = buildColumnMapping(grid, mainHeaderIdx, subHeaderIdx);

  let detectedHeaderInfo = '';
  if (mainHeaderIdx >= 0 && subHeaderIdx >= 0) {
    detectedHeaderInfo = `Header 2 tingkat terdeteksi otomatis pada baris ${mainHeaderIdx + 1}–${subHeaderIdx + 1} (Data mulai baris ${dataStartRowIndex + 1})`;
  } else if (mainHeaderIdx >= 0) {
    detectedHeaderInfo = `Header terdeteksi otomatis pada baris ${mainHeaderIdx + 1} (Data mulai baris ${dataStartRowIndex + 1})`;
  } else if (subHeaderIdx >= 0) {
    detectedHeaderInfo = `Sub-header terdeteksi pada baris ${subHeaderIdx + 1} (Data mulai baris ${dataStartRowIndex + 1})`;
  } else {
    detectedHeaderInfo = `Tanpa baris header — menggunakan urutan kolom standar ${modul} (20/21 kolom)`;
  }

  const items: LaporanPBJ[] = [];
  const refMap = new Map<string, ReferensiRUP>();
  if (options.referensiList) {
    for (const r of options.referensiList) {
      if (r.kode_rup) {
        refMap.set(String(r.kode_rup).trim().toLowerCase(), r);
      }
    }
  }

  const getCell = (row: string[], key: string): string => {
    const colIdx = mappedColumns[key];
    if (colIdx === undefined || colIdx < 0 || colIdx >= row.length) return '';
    return (row[colIdx] || '').trim();
  };

  for (let r = dataStartRowIndex; r < grid.length; r++) {
    const row = grid[r];
    if (!row || row.every((c) => !c || c.trim() === '')) continue;

    // Skip repeated header rows or column numbering rows inside the table
    if (isColumnNumberingRow(row)) continue;
    if (scoreMainHeaderRow(row) >= 8 || scoreSubHeaderRow(row) >= 8) continue;

    const rawKodeRup = getCell(row, 'kode_rup');
    const rawNamaPaket = getCell(row, 'nama_paket');
    const rawSatker = getCell(row, 'satuan_kerja');

    // Skip summary / total rows
    const firstFewText = `${rawKodeRup} ${rawSatker} ${rawNamaPaket}`.toLowerCase();
    if (
      /^(jumlah|total|sub\s*total|grand\s*total|rata-rata)\b/.test(rawKodeRup.toLowerCase()) ||
      /^(jumlah|total|sub\s*total|grand\s*total|rata-rata)\b/.test(rawNamaPaket.toLowerCase()) ||
      (/^(jumlah|total|sub\s*total|grand\s*total)\b/.test(firstFewText.trim()) && !rawNamaPaket)
    ) {
      continue;
    }

    // Look up in Referensi RUP if available
    const matchedRef = rawKodeRup ? refMap.get(rawKodeRup.toLowerCase()) : undefined;

    const nama_paket = rawNamaPaket || matchedRef?.nama_paket || '';
    const kode_rup = rawKodeRup || matchedRef?.kode_rup || '';

    // Skip row if both kode_rup and nama_paket are empty
    if (!kode_rup && !nama_paket) {
      continue;
    }

    const satuan_kerja = rawSatker || matchedRef?.satuan_kerja || 'Dinas Pertanian Lombok Barat';
    const metode_pengadaan = getCell(row, 'metode_pengadaan') || matchedRef?.metode_pengadaan || '-';
    const sumber_dana = getCell(row, 'sumber_dana') || matchedRef?.sumber_dana || 'APBD';

    const parsedPagu = parseRupiah(getCell(row, 'pagu'));
    const pagu = parsedPagu > 0 ? parsedPagu : (matchedRef?.pagu || 0);
    const hps = parseRupiah(getCell(row, 'hps'));

    const kontrak_nomor = getCell(row, 'kontrak_nomor');
    const kontrak_nilai = parseRupiah(getCell(row, 'kontrak_nilai'));
    const kontrak_tanggal = getCell(row, 'kontrak_tanggal');
    const penyedia = getCell(row, 'penyedia');

    const realisasi_keuangan = parseRupiah(getCell(row, 'realisasi_keuangan'));
    const fisik_rencana = parsePercent(getCell(row, 'fisik_rencana'));
    const fisik_realisasi = parsePercent(getCell(row, 'fisik_realisasi'));

    const nomor_sp2d = getCell(row, 'nomor_sp2d');
    const tgl_sp2d = getCell(row, 'tgl_sp2d');

    const rawBidang = getCell(row, 'bidang');
    const bidang = resolveBidang(rawBidang, options.bidangList, options.defaultBidang);

    items.push({
      modul,
      bidang,
      kode_rup,
      satuan_kerja,
      nama_paket: nama_paket || `Paket RUP ${kode_rup}`,
      metode_pengadaan,
      sumber_dana,
      pagu,
      hps,
      kontrak_nomor,
      kontrak_nilai,
      kontrak_tanggal,
      penyedia,
      realisasi_keuangan,
      fisik_rencana,
      fisik_realisasi,
      nomor_sp2d,
      tgl_sp2d,
    });
  }

  const missingBidangCount = items.filter((it) => !it.bidang).length;
  if (missingBidangCount > 0) {
    warnings.push(
      `${missingBidangCount} baris belum memiliki Bidang. Pilih "Default Bidang" di atas agar terisi otomatis.`
    );
  }

  return {
    items,
    detectedHeaderInfo,
    headerRowIndex: mainHeaderIdx,
    dataStartRowIndex,
    mappedColumns,
    warnings,
  };
}

/**
 * Smart parser for Referensi RUP (used in Pengaturan -> Bulk Import RUP)
 * Supports both the 6/7-column RUP table and the full 21-column Penyedia/Swakelola table!
 */
export function smartParseRUPGrid(grid: string[][], modul: Modul): ReferensiRUP[] {
  if (!grid || grid.length === 0) return [];

  const scanLimit = Math.min(grid.length, 25);
  let headerIdx = -1;
  let bestScore = 0;

  for (let r = 0; r < scanLimit; r++) {
    const score = scoreMainHeaderRow(grid[r]);
    if (score > bestScore) {
      bestScore = score;
      headerIdx = r;
    }
  }

  let dataStart = 0;
  const colMap: Record<string, number> = {};

  if (headerIdx >= 0 && bestScore >= 4) {
    const h1 = grid[headerIdx];
    for (let c = 0; c < h1.length; c++) {
      const cell = norm(h1[c]);
      if (!cell) continue;
      if (cell.includes('kode rup') || cell === 'rup') colMap.kode_rup = c;
      else if (cell.includes('satuan kerja') || cell.includes('satker')) colMap.satuan_kerja = c;
      else if (cell.includes('nama paket') || cell.includes('paket pekerjaan')) colMap.nama_paket = c;
      else if (cell.includes('metode')) colMap.metode_pengadaan = c;
      else if (cell.includes('jenis pengadaan')) colMap.jenis_pengadaan = c;
      else if (cell.includes('sumber dana')) colMap.sumber_dana = c;
      else if (cell.includes('pagu')) colMap.pagu = c;
    }
    dataStart = headerIdx + 1;
    if (dataStart < grid.length && scoreSubHeaderRow(grid[dataStart]) >= 4) {
      dataStart++;
    }
  } else {
    // Positional fallback
    colMap.kode_rup = 0;
    colMap.satuan_kerja = 1;
    colMap.nama_paket = 2;
    colMap.metode_pengadaan = 3;
    if (modul === Modul.PENYEDIA) {
      colMap.jenis_pengadaan = 4;
      colMap.sumber_dana = 5;
      colMap.pagu = 6;
    } else {
      // Check if 7+ columns (with Jenis Pengadaan at col 4) or 6 columns
      const firstRowCols = grid[0]?.length || 0;
      if (firstRowCols >= 7) {
        colMap.jenis_pengadaan = 4;
        colMap.sumber_dana = 5;
        colMap.pagu = 6;
      } else {
        colMap.sumber_dana = 4;
        colMap.pagu = 5;
      }
    }
  }

  while (dataStart < grid.length && isColumnNumberingRow(grid[dataStart])) {
    dataStart++;
  }

  const results: ReferensiRUP[] = [];
  for (let r = dataStart; r < grid.length; r++) {
    const row = grid[r];
    if (!row || row.every((c) => !c || c.trim() === '')) continue;
    if (isColumnNumberingRow(row) || scoreMainHeaderRow(row) >= 6 || scoreSubHeaderRow(row) >= 6) continue;

    const kode_rup = (row[colMap.kode_rup ?? 0] || '').trim();
    const nama_paket = (row[colMap.nama_paket ?? 2] || '').trim();
    if (!kode_rup || !nama_paket) continue;
    if (/^(jumlah|total|sub\s*total|kode\s*rup)/i.test(kode_rup)) continue;

    const satuan_kerja = (row[colMap.satuan_kerja ?? 1] || '').trim();
    const metode_pengadaan = (row[colMap.metode_pengadaan ?? 3] || '').trim();
    const sumber_dana = (row[colMap.sumber_dana ?? 5] || '').trim();
    const pagu = parseRupiah(row[colMap.pagu ?? 6]);

    results.push({
      kode_rup,
      satuan_kerja,
      nama_paket,
      metode_pengadaan,
      sumber_dana,
      pagu,
      jenis_pengadaan: modul,
    });
  }

  return results;
}

/**
 * Generate an official Excel template file matching the exact multi-row header structure
 * for Penyedia or Swakelola.
 */
export function downloadExcelTemplate(modul: Modul, defaultBidang?: string) {
  const bidangHeader = modul === Modul.SWAKELOLA ? 'BIDANG' : 'Bidang';
  const row1 = [
    'Kode RUP',
    'Satuan Kerja',
    'Nama Paket',
    'Metode Pengadaan',
    'Jenis Pengadaan',
    'Sumber Dana',
    'Nilai Pagu (Rp)',
    'HPS (Rp)',
    'DATA KONTRAK AWAL DAN ADDENDUM',
    '',
    '',
    '',
    'KEUANGAN',
    '',
    'FISIK',
    '',
    '',
    'SP2D',
    '',
    'SISA ANGGARAN (Rp)',
    bidangHeader,
  ];

  const row2 = [
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    'NOMOR',
    'NILAI (Rp,)',
    'TANGGAL/MASA PELAKSANAAN',
    'PENYEDIA\n(PT, CV, UD, dll)',
    'REALISASI (Rp.)',
    '%',
    'RENCANA (%)',
    'REALISASI (%)',
    'DEVIASI (%)',
    'NOMOR',
    'TGL',
    '',
    '',
  ];

  const row3 =
    modul === Modul.PENYEDIA
      ? ['1', '2', '', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14,00', '15,00', '16,00', '17,00', '18', '19', '20', '']
      : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', ''];

  const sampleRow = [
    '45901234',
    'Dinas Pertanian Lombok Barat',
    `Contoh Paket Pekerjaan ${modul} TA 2026`,
    modul === Modul.PENYEDIA ? 'Pengadaan Langsung' : 'Swakelola Tipe I',
    modul === Modul.PENYEDIA ? 'Barang' : 'Swakelola',
    'APBD',
    150000000,
    148500000,
    '600/01/SPK/DISTAN/2026',
    147000000,
    '10 Maret 2026 / 60 HK',
    modul === Modul.PENYEDIA ? 'CV. Karya Tani Mandiri' : 'Kelompok Tani Makmur',
    147000000,
    100,
    100,
    100,
    0,
    '00123/SP2D/2026',
    '2026-05-15',
    0,
    defaultBidang || 'Tanaman Pangan',
  ];

  const ws = XLSX.utils.aoa_to_sheet([row1, row2, row3, sampleRow]);

  // Configure merges matching the government PBJ Excel layout
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // Kode RUP
    { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // Satuan Kerja
    { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } }, // Nama Paket
    { s: { r: 0, c: 3 }, e: { r: 1, c: 3 } }, // Metode Pengadaan
    { s: { r: 0, c: 4 }, e: { r: 1, c: 4 } }, // Jenis Pengadaan
    { s: { r: 0, c: 5 }, e: { r: 1, c: 5 } }, // Sumber Dana
    { s: { r: 0, c: 6 }, e: { r: 1, c: 6 } }, // Nilai Pagu (Rp)
    { s: { r: 0, c: 7 }, e: { r: 1, c: 7 } }, // HPS (Rp)
    { s: { r: 0, c: 8 }, e: { r: 0, c: 11 } }, // DATA KONTRAK AWAL DAN ADDENDUM
    { s: { r: 0, c: 12 }, e: { r: 0, c: 13 } }, // KEUANGAN
    { s: { r: 0, c: 14 }, e: { r: 0, c: 16 } }, // FISIK
    { s: { r: 0, c: 17 }, e: { r: 0, c: 18 } }, // SP2D
    { s: { r: 0, c: 19 }, e: { r: 1, c: 19 } }, // SISA ANGGARAN (Rp)
    { s: { r: 0, c: 20 }, e: { r: 1, c: 20 } }, // Bidang
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Template_${modul}`);
  XLSX.writeFile(wb, `Template_Import_${modul}_2026.xlsx`);
}
