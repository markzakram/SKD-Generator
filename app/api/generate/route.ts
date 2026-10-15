import { bankStats } from '@/lib/bank';
import { generate, normalizeSettings } from '@/lib/generate';
import { TIU_FAMILIES } from '@/lib/tiu';
import { auditPackages } from '@/lib/validate';
export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET() {
  return Response.json({ bank: bankStats(), families: TIU_FAMILIES, limits: { packages: 50, count: 200, apiTotal: 1000 } });
}
export async function POST(request: Request) {
  try {
    const body = await request.text();
    if (body.length > 10000) return Response.json({ error: 'Permintaan terlalu besar.' }, { status: 413 });
    const input = JSON.parse(body);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Kirim objek pengaturan dalam JSON.');
    const settings = normalizeSettings(input);
    if (settings.packages * settings.count > 1000) throw new Error('API dibatasi 1.000 soal per permintaan. Gunakan generator di halaman atau CLI untuk batch lebih besar.');
    const packages = generate(settings);
    return Response.json({ version: 2, settings, packages, audit: auditPackages(packages, settings), reviewStatus: 'draft' });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Permintaan tidak valid.' }, { status: 400 });
  }
}
