import { NextRequest } from 'next/server';
import { proxy } from '../proxy';

// Gerbang password situs (proxy.ts): tertutup di Vercel bila SITE_PASSWORD kosong, dan hanya password yang tepat yang lolos.
type Check = (condition: unknown, message: string) => void;
const basic = (user: string, password: string) => 'Basic ' + Buffer.from(user + ':' + password).toString('base64');
const statusOf = (authorization?: string) => proxy(new NextRequest('https://skd.test/', authorization ? { headers: { authorization } } : undefined)).status;

export function runProxyChecks(check: Check) {
  const saved = { password: process.env.SITE_PASSWORD, vercel: process.env.VERCEL };
  try {
    delete process.env.SITE_PASSWORD; delete process.env.VERCEL;
    check(statusOf() === 200, 'Lokal tanpa SITE_PASSWORD: tidak ada gerbang.');
    process.env.VERCEL = '1';
    check(statusOf() === 503 && statusOf(basic('a', 'b')) === 503, 'Vercel tanpa SITE_PASSWORD: situs tertutup, bukan terbuka.');
    process.env.SITE_PASSWORD = 'uji:gerbang';
    check(statusOf() === 401, 'Tanpa password: 401.');
    check(proxy(new NextRequest('https://skd.test/')).headers.get('www-authenticate')?.startsWith('Basic '), 'Respons 401 meminta Basic Auth.');
    check(statusOf(basic('admin', 'salah')) === 401 && statusOf(basic('admin', '')) === 401, 'Password salah atau kosong: 401.');
    check(statusOf('Basic ' + Buffer.from('uji:gerbang').toString('base64')) === 401, 'Nama pengguna saja bukan password.');
    check(statusOf('Bearer uji:gerbang') === 401 && statusOf('Basic bukan-base64') === 401, 'Skema lain atau kredensial rusak: 401.');
    check(statusOf(basic('siapa-saja', 'uji:gerbang')) === 200 && statusOf(basic('', 'uji:gerbang')) === 200, 'Password tepat lolos dengan nama pengguna apa pun, termasuk password bertitik dua.');
  } finally {
    if (saved.password === undefined) delete process.env.SITE_PASSWORD; else process.env.SITE_PASSWORD = saved.password;
    if (saved.vercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = saved.vercel;
  }
}
