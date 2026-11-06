// Gambar rumus disalin tanpa perubahan byte dari panduan akademik, kecuali tabel pecahan istimewa yang digambar ulang (QC akademik #2): nilai yang dibulatkan
// (1/3, 2/3, 1/6, 5/6) memakai ≈, bukan =. sha256 pada data/tiu-guide-images.json mengikuti gambar yang dipakai.
// Hanya ID terdaftar yang diterima; teks penjelas tersedia untuk pembaca layar/ekspor teks.
import guideImages from '@/data/tiu-guide-images.json';
import bankImages from '@/data/tryout-images.json';
const images = { ...guideImages, ...bankImages };
export type GuideImageId = keyof typeof images;
export const guideImage = (id: GuideImageId) => images[id];
export const guideLine = (id: GuideImageId) => '@acuan ' + id;
export function parseGuideLine(line: string): GuideImageId | undefined {
  const id = /^@acuan ([a-z0-9-]+)$/.exec(line.trim())?.[1];
  return id && Object.hasOwn(images, id) ? id as GuideImageId : undefined;
}
export function guideSvg(id: GuideImageId): string {
  const { title, width, height, url } = guideImage(id);
  return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '" role="img"><title>' + title + '</title><image width="' + width + '" height="' + height + '" href="' + url + '" xlink:href="' + url + '"/></svg>';
}
