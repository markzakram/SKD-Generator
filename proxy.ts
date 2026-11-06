import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

// Gerbang password seluruh situs (HTTP Basic Auth; nama pengguna boleh apa saja). Tanpa `config.matcher`, proxy berjalan pada setiap permintaan:
// halaman, /api/generate, _next/static, dan isi public/. Password hanya dibaca dari environment variable SITE_PASSWORD, tidak pernah ditulis di kode.
// Di Vercel, variabel yang belum diisi menutup situs (503) supaya situs tidak terbuka tanpa sengaja; di komputer lokal tanpa variabel ini tidak ada gerbang.
const digest = (value: string) => createHash('sha256').update(value).digest();

export function proxy(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return process.env.VERCEL ? new NextResponse('SITE_PASSWORD belum diisi di Vercel.', { status: 503 }) : NextResponse.next();
  const [scheme, encoded = ''] = (request.headers.get('authorization') ?? '').split(' ');
  const credentials = scheme === 'Basic' ? Buffer.from(encoded, 'base64').toString('utf8') : '';
  const colon = credentials.indexOf(':');
  if (colon >= 0 && timingSafeEqual(digest(credentials.slice(colon + 1)), digest(password))) return NextResponse.next();
  return new NextResponse('Masukkan password untuk membuka aplikasi.', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="SKD Studio", charset="UTF-8"' } });
}
