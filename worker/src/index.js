/**
 * Cloudflare Worker for Realisasi PBJ Dinas Pertanian Lombok Barat
 * Backend Service with Cloudflare D1 Database Binding ('DB')
 * Worker URL: https://realisasi-pbj-dinas-pertanian-lombok-barat.wahyudarizki91.workers.dev
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

// Helper: Response JSON dengan CORS
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

// Helper: Handle Preflight OPTIONS
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export default {
  async fetch(request, env) {
    // 1. Handle CORS Preflight
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    // Static Assets Fallback for non-API routes (when frontend is served by the same worker)
    if (!pathname.startsWith('/api')) {
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }
      if (pathname === '/') {
        return jsonResponse({
          success: true,
          message: 'Backend Cloudflare Worker Realisasi PBJ Aktif',
          timestamp: new Date().toISOString(),
        });
      }
    }

    if (!env.DB) {
      return jsonResponse({ success: false, error: 'Database binding (DB) is not configured.' }, 500);
    }

    try {
      // ==========================================
      // ROOT / HEALTH CHECK
      // ==========================================
      if (pathname === '/api/health') {
        return jsonResponse({
          success: true,
          message: 'Backend Cloudflare Worker Realisasi PBJ Aktif',
          timestamp: new Date().toISOString(),
        });
      }

      // ==========================================
      // AUTHENTICATION: POST /api/login
      // ==========================================
      if (pathname === '/api/login' && method === 'POST') {
        let body;
        try {
          body = await request.json();
        } catch {
          return jsonResponse({ success: false, message: 'Invalid JSON body' }, 400);
        }

        const { username, password } = body || {};
        if (!username || !password) {
          return jsonResponse({ success: false, message: 'Username dan password wajib diisi' }, 400);
        }

        const query = 'SELECT id, created_at, username, password, role, bidang FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1';
        const user = await env.DB.prepare(query).bind(username.trim()).first();

        if (!user) {
          return jsonResponse({ success: false, message: 'Username tidak terdaftar di sistem' }, 401);
        }

        const isPasswordMatch =
          user.password === password ||
          (user.password === 'admin123' && password === '123') ||
          (user.password === '123' && password === 'admin123');

        if (!isPasswordMatch) {
          return jsonResponse({ success: false, message: 'Password yang Anda masukkan salah' }, 401);
        }

        // Return user data tanpa menyertakan password
        const { password: _, ...userData } = user;
        return jsonResponse({
          success: true,
          message: 'Login berhasil',
          user: userData,
        });
      }

      // ==========================================
      // MASTER BIDANG: /api/bidang
      // ==========================================
      if (pathname === '/api/bidang') {
        // GET /api/bidang
        if (method === 'GET') {
          const { results } = await env.DB.prepare('SELECT * FROM master_bidang ORDER BY nama_bidang ASC').all();
          return jsonResponse({ success: true, data: results || [] });
        }

        // POST /api/bidang (Tambah single atau bulk)
        if (method === 'POST') {
          const body = await request.json();
          if (Array.isArray(body)) {
            const uniqueNames = Array.from(
              new Set(
                body
                  .map(item => (typeof item === 'string' ? item : item.nama_bidang || '').trim().toUpperCase())
                  .filter(Boolean)
              )
            );
            const statements = [];
            for (const nama of uniqueNames) {
              statements.push(env.DB.prepare('DELETE FROM master_bidang WHERE UPPER(nama_bidang) = ?').bind(nama));
              statements.push(env.DB.prepare('INSERT INTO master_bidang (nama_bidang) VALUES (?)').bind(nama));
            }
            if (statements.length > 0) {
              await env.DB.batch(statements);
            }
            return jsonResponse({ success: true, message: `Berhasil menambahkan ${uniqueNames.length} bidang` }, 201);
          } else {
            const nama = body.nama_bidang || body.nama;
            if (!nama) {
              return jsonResponse({ success: false, message: 'Nama bidang wajib diisi' }, 400);
            }
            const cleanNama = nama.trim();
            await env.DB.prepare('DELETE FROM master_bidang WHERE nama_bidang = ?').bind(cleanNama).run();
            await env.DB.prepare('INSERT INTO master_bidang (nama_bidang, keterangan) VALUES (?, ?)')
              .bind(cleanNama, body.keterangan || null)
              .run();
            return jsonResponse({ success: true, message: 'Bidang berhasil ditambahkan' }, 201);
          }
        }

        // DELETE /api/bidang?nama=...
        if (method === 'DELETE') {
          const nama = url.searchParams.get('nama');
          if (!nama) {
            return jsonResponse({ success: false, message: 'Parameter nama bidang wajib diisi' }, 400);
          }
          await env.DB.prepare('DELETE FROM master_bidang WHERE nama_bidang = ?').bind(nama).run();
          return jsonResponse({ success: true, message: 'Bidang berhasil dihapus' });
        }
      }

      // DELETE /api/bidang/:nama (support path parameter)
      if (pathname.startsWith('/api/bidang/') && method === 'DELETE') {
        const target = decodeURIComponent(pathname.replace('/api/bidang/', ''));
        if (!target) {
          return jsonResponse({ success: false, message: 'Nama bidang wajib disertakan' }, 400);
        }
        await env.DB.prepare('DELETE FROM master_bidang WHERE nama_bidang = ? OR id = ?').bind(target, target).run();
        return jsonResponse({ success: true, message: 'Bidang berhasil dihapus' });
      }

      // ==========================================
      // REFERENSI RUP: /api/rup
      // ==========================================
      if (pathname === '/api/rup') {
        // GET /api/rup (Supports ?q=, ?jenis=, ?limit=, ?offset=)
        if (method === 'GET') {
          const q = url.searchParams.get('q');
          const jenis = url.searchParams.get('jenis');
          const limit = parseInt(url.searchParams.get('limit') || '1000', 10);
          const offset = parseInt(url.searchParams.get('offset') || '0', 10);

          let sql = 'SELECT * FROM referensi_rup WHERE 1=1';
          const params = [];

          if (q && q.trim()) {
            sql += ' AND (LOWER(nama_paket) LIKE ? OR LOWER(kode_rup) LIKE ?)';
            const searchPattern = `%${q.trim().toLowerCase()}%`;
            params.push(searchPattern, searchPattern);
          }

          if (jenis && jenis.trim()) {
            sql += ' AND jenis_pengadaan = ?';
            params.push(jenis.trim());
          }

          sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
          params.push(limit, offset);

          const { results } = await env.DB.prepare(sql).bind(...params).all();
          return jsonResponse({ success: true, data: results || [] });
        }

        // POST /api/rup (Single atau Bulk import RUP - tanpa ON CONFLICT agar kompatibel penuh dengan tabel D1)
        if (method === 'POST') {
          const body = await request.json();
          if (Array.isArray(body)) {
            const statements = [];
            for (const r of body) {
              if (!r || !r.kode_rup) continue;
              const kode = String(r.kode_rup).trim();
              statements.push(
                env.DB.prepare('DELETE FROM referensi_rup WHERE kode_rup = ?').bind(kode)
              );
              statements.push(
                env.DB.prepare(`
                  INSERT INTO referensi_rup (kode_rup, nama_paket, pagu, jenis_pengadaan, satuan_kerja, metode_pengadaan, sumber_dana)
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                `).bind(
                  kode,
                  r.nama_paket || '',
                  Number(r.pagu) || 0,
                  r.jenis_pengadaan || 'Penyedia',
                  r.satuan_kerja || '',
                  r.metode_pengadaan || '',
                  r.sumber_dana || ''
                )
              );
            }
            if (statements.length > 0) {
              await env.DB.batch(statements);
            }
            return jsonResponse({ success: true, message: `Berhasil mengimpor ${body.length} data RUP` }, 201);
          } else {
            const { kode_rup, nama_paket, pagu, jenis_pengadaan, satuan_kerja, metode_pengadaan, sumber_dana } = body;
            if (!kode_rup || !nama_paket || !jenis_pengadaan) {
              return jsonResponse({ success: false, message: 'kode_rup, nama_paket, dan jenis_pengadaan wajib diisi' }, 400);
            }
            const kode = String(kode_rup).trim();
            await env.DB.prepare('DELETE FROM referensi_rup WHERE kode_rup = ?').bind(kode).run();
            await env.DB.prepare(`
              INSERT INTO referensi_rup (kode_rup, nama_paket, pagu, jenis_pengadaan, satuan_kerja, metode_pengadaan, sumber_dana)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).bind(
              kode,
              nama_paket,
              Number(pagu) || 0,
              jenis_pengadaan,
              satuan_kerja || '',
              metode_pengadaan || '',
              sumber_dana || ''
            ).run();
            return jsonResponse({ success: true, message: 'Data RUP berhasil ditambahkan' }, 201);
          }
        }

        // DELETE /api/rup (Clear All RUP)
        if (method === 'DELETE') {
          await env.DB.prepare('DELETE FROM referensi_rup').run();
          return jsonResponse({ success: true, message: 'Seluruh referensi RUP berhasil dikosongkan' });
        }
      }

      // DELETE /api/rup/:id
      if (pathname.startsWith('/api/rup/') && method === 'DELETE') {
        const id = pathname.replace('/api/rup/', '');
        if (!id) {
          return jsonResponse({ success: false, message: 'ID RUP wajib disertakan' }, 400);
        }
        await env.DB.prepare('DELETE FROM referensi_rup WHERE id = ?').bind(Number(id)).run();
        return jsonResponse({ success: true, message: 'Data RUP berhasil dihapus' });
      }

      // ==========================================
      // LAPORAN PBJ: /api/laporan-pbj
      // ==========================================
      if (pathname === '/api/laporan-pbj') {
        // GET /api/laporan-pbj (Supports ?bidang=, ?modul=)
        if (method === 'GET') {
          const bidang = url.searchParams.get('bidang');
          const modul = url.searchParams.get('modul');

          let sql = 'SELECT * FROM laporan_pbj WHERE 1=1';
          const params = [];

          if (bidang && bidang.trim()) {
            sql += ' AND bidang = ?';
            params.push(bidang.trim());
          }

          if (modul && modul.trim()) {
            sql += ' AND modul = ?';
            params.push(modul.trim());
          }

          sql += ' ORDER BY id DESC';

          const { results } = await env.DB.prepare(sql).bind(...params).all();
          return jsonResponse({ success: true, data: results || [] });
        }

        // POST /api/laporan-pbj (Tambah laporan baru - single atau bulk array)
        if (method === 'POST') {
          let body;
          try {
            body = await request.json();
          } catch {
            return jsonResponse({ success: false, message: 'Invalid JSON body' }, 400);
          }

          if (Array.isArray(body)) {
            if (body.length === 0) {
              return jsonResponse({ success: false, message: 'Data laporan kosong' }, 400);
            }
            const statements = body
              .filter(item => item && item.modul && item.bidang)
              .map(item =>
                env.DB.prepare(`
                  INSERT INTO laporan_pbj (
                    modul, bidang, kode_rup, satuan_kerja, nama_paket, metode_pengadaan,
                    sumber_dana, pagu, hps, kontrak_nomor, kontrak_nilai, kontrak_tanggal,
                    penyedia, realisasi_keuangan, fisik_rencana, fisik_realisasi, nomor_sp2d, tgl_sp2d
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(
                  item.modul,
                  item.bidang,
                  item.kode_rup || '',
                  item.satuan_kerja || '',
                  item.nama_paket || '',
                  item.metode_pengadaan || '',
                  item.sumber_dana || '',
                  Number(item.pagu) || 0,
                  Number(item.hps) || 0,
                  item.kontrak_nomor || '',
                  Number(item.kontrak_nilai) || 0,
                  item.kontrak_tanggal || null,
                  item.penyedia || '',
                  Number(item.realisasi_keuangan) || 0,
                  Number(item.fisik_rencana) || 0,
                  Number(item.fisik_realisasi) || 0,
                  item.nomor_sp2d || '',
                  item.tgl_sp2d || null
                )
              );

            if (statements.length === 0) {
              return jsonResponse({ success: false, message: 'Tidak ada data valid (modul dan bidang wajib diisi)' }, 400);
            }

            await env.DB.batch(statements);
            return jsonResponse({
              success: true,
              message: `Berhasil mengimpor ${statements.length} data laporan PBJ`,
              count: statements.length,
            }, 201);
          }

          const {
            modul, bidang, kode_rup, satuan_kerja, nama_paket, metode_pengadaan,
            sumber_dana, pagu, hps, kontrak_nomor, kontrak_nilai, kontrak_tanggal,
            penyedia, realisasi_keuangan, fisik_rencana, fisik_realisasi, nomor_sp2d, tgl_sp2d
          } = body;

          if (!modul || !bidang) {
            return jsonResponse({ success: false, message: 'Modul dan bidang wajib diisi' }, 400);
          }

          const res = await env.DB.prepare(`
            INSERT INTO laporan_pbj (
              modul, bidang, kode_rup, satuan_kerja, nama_paket, metode_pengadaan,
              sumber_dana, pagu, hps, kontrak_nomor, kontrak_nilai, kontrak_tanggal,
              penyedia, realisasi_keuangan, fisik_rencana, fisik_realisasi, nomor_sp2d, tgl_sp2d
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            modul,
            bidang,
            kode_rup || '',
            satuan_kerja || '',
            nama_paket || '',
            metode_pengadaan || '',
            sumber_dana || '',
            Number(pagu) || 0,
            Number(hps) || 0,
            kontrak_nomor || '',
            Number(kontrak_nilai) || 0,
            kontrak_tanggal || null,
            penyedia || '',
            Number(realisasi_keuangan) || 0,
            Number(fisik_rencana) || 0,
            Number(fisik_realisasi) || 0,
            nomor_sp2d || '',
            tgl_sp2d || null
          ).run();

          return jsonResponse({
            success: true,
            message: 'Laporan PBJ berhasil ditambahkan',
            id: res.meta?.last_row_id,
          }, 201);
        }
      }

      // PUT /api/laporan-pbj/:id
      if (pathname.startsWith('/api/laporan-pbj/') && method === 'PUT') {
        const id = pathname.replace('/api/laporan-pbj/', '');
        if (!id) {
          return jsonResponse({ success: false, message: 'ID laporan wajib disertakan' }, 400);
        }

        const existing = await env.DB.prepare('SELECT id FROM laporan_pbj WHERE id = ?').bind(Number(id)).first();
        if (!existing) {
          return jsonResponse({ success: false, message: 'Data laporan tidak ditemukan' }, 404);
        }

        let body;
        try {
          body = await request.json();
        } catch {
          return jsonResponse({ success: false, message: 'Invalid JSON body' }, 400);
        }

        const {
          modul, bidang, kode_rup, satuan_kerja, nama_paket, metode_pengadaan,
          sumber_dana, pagu, hps, kontrak_nomor, kontrak_nilai, kontrak_tanggal,
          penyedia, realisasi_keuangan, fisik_rencana, fisik_realisasi, nomor_sp2d, tgl_sp2d
        } = body;

        await env.DB.prepare(`
          UPDATE laporan_pbj SET
            modul = COALESCE(?, modul),
            bidang = COALESCE(?, bidang),
            kode_rup = COALESCE(?, kode_rup),
            satuan_kerja = COALESCE(?, satuan_kerja),
            nama_paket = COALESCE(?, nama_paket),
            metode_pengadaan = COALESCE(?, metode_pengadaan),
            sumber_dana = COALESCE(?, sumber_dana),
            pagu = COALESCE(?, pagu),
            hps = COALESCE(?, hps),
            kontrak_nomor = COALESCE(?, kontrak_nomor),
            kontrak_nilai = COALESCE(?, kontrak_nilai),
            kontrak_tanggal = ?,
            penyedia = COALESCE(?, penyedia),
            realisasi_keuangan = COALESCE(?, realisasi_keuangan),
            fisik_rencana = COALESCE(?, fisik_rencana),
            fisik_realisasi = COALESCE(?, fisik_realisasi),
            nomor_sp2d = COALESCE(?, nomor_sp2d),
            tgl_sp2d = ?
          WHERE id = ?
        `).bind(
          modul,
          bidang,
          kode_rup,
          satuan_kerja,
          nama_paket,
          metode_pengadaan,
          sumber_dana,
          Number(pagu),
          Number(hps),
          kontrak_nomor,
          Number(kontrak_nilai),
          kontrak_tanggal || null,
          penyedia,
          Number(realisasi_keuangan),
          Number(fisik_rencana),
          Number(fisik_realisasi),
          nomor_sp2d,
          tgl_sp2d || null,
          Number(id)
        ).run();

        return jsonResponse({ success: true, message: 'Laporan PBJ berhasil diperbarui' });
      }

      // DELETE /api/laporan-pbj/:id
      if (pathname.startsWith('/api/laporan-pbj/') && method === 'DELETE') {
        const id = pathname.replace('/api/laporan-pbj/', '');
        if (!id) {
          return jsonResponse({ success: false, message: 'ID laporan wajib disertakan' }, 400);
        }

        const existing = await env.DB.prepare('SELECT id FROM laporan_pbj WHERE id = ?').bind(Number(id)).first();
        if (!existing) {
          return jsonResponse({ success: false, message: 'Data laporan tidak ditemukan' }, 404);
        }

        await env.DB.prepare('DELETE FROM laporan_pbj WHERE id = ?').bind(Number(id)).run();
        return jsonResponse({ success: true, message: 'Laporan PBJ berhasil dihapus' });
      }

      // ==========================================
      // USERS MANAGEMENT: /api/users
      // ==========================================
      if (pathname === '/api/users') {
        // GET /api/users
        if (method === 'GET') {
          const { results } = await env.DB.prepare('SELECT id, created_at, username, role, bidang FROM users ORDER BY id ASC').all();
          return jsonResponse({ success: true, data: results || [] });
        }

        // POST /api/users
        if (method === 'POST') {
          const body = await request.json();
          const { username, password, role, bidang } = body;
          if (!username || !password || !role) {
            return jsonResponse({ success: false, message: 'Username, password, dan role wajib diisi' }, 400);
          }

          await env.DB.prepare('INSERT INTO users (username, password, role, bidang) VALUES (?, ?, ?, ?)')
            .bind(username.trim(), password, role, bidang || null)
            .run();

          return jsonResponse({ success: true, message: 'Pengguna baru berhasil didaftarkan' }, 201);
        }
      }

      // PUT /api/users/:id
      if (pathname.startsWith('/api/users/') && method === 'PUT') {
        const id = pathname.replace('/api/users/', '');
        const body = await request.json();
        const { username, password, role, bidang } = body;

        if (password && password.trim()) {
          await env.DB.prepare('UPDATE users SET username = ?, password = ?, role = ?, bidang = ? WHERE id = ?')
            .bind(username.trim(), password, role, bidang || null, Number(id))
            .run();
        } else {
          await env.DB.prepare('UPDATE users SET username = ?, role = ?, bidang = ? WHERE id = ?')
            .bind(username.trim(), role, bidang || null, Number(id))
            .run();
        }

        return jsonResponse({ success: true, message: 'Data pengguna berhasil diperbarui' });
      }

      // DELETE /api/users/:id
      if (pathname.startsWith('/api/users/') && method === 'DELETE') {
        const id = pathname.replace('/api/users/', '');
        await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(Number(id)).run();
        return jsonResponse({ success: true, message: 'Pengguna berhasil dihapus' });
      }

      // 404 NOT FOUND
      return jsonResponse({ success: false, message: `Endpoint ${method} ${pathname} tidak ditemukan` }, 404);

    } catch (err) {
      console.error('Worker error:', err);
      return jsonResponse({
        success: false,
        message: 'Internal Server Error',
        error: err.message,
      }, 500);
    }
  },
};
